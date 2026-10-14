-- Registra o motivo obrigatório ao solicitar mais ajuda, sem alterar o fluxo de fechamento.
-- A validação existe no servidor para não depender apenas do formulário.

drop function if exists public.acao_solicitante_chamado(uuid, text);
create or replace function public.acao_solicitante_chamado(_chamado_id uuid, _acao text, _motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.chamados%rowtype;
  v_novo_status public.status_chamado;
  v_agora timestamptz := now();
  v_role_ok boolean;
  v_motivo text := nullif(btrim(_motivo), '');
begin
  if v_user_id is null then
    raise exception 'É necessário estar autenticado.';
  end if;

  if public.has_role(v_user_id, 'admin'::public.app_role)
     or not (public.has_role(v_user_id, 'colaborador'::public.app_role)
          or public.has_role(v_user_id, 'gestor'::public.app_role)) then
    raise exception 'Esta ação está disponível apenas para solicitantes.';
  end if;

  if _acao not in ('retomar', 'fechar') then
    raise exception 'Ação inválida.';
  end if;
  if _acao = 'retomar' and v_motivo is null then
    raise exception 'Informe por que você precisa de mais ajuda.';
  end if;
  if length(coalesce(v_motivo, '')) > 2000 then
    raise exception 'O motivo deve ter no máximo 2000 caracteres.';
  end if;

  select * into v_ticket
  from public.chamados
  where id = _chamado_id
  for update;

  if not found then
    raise exception 'Chamado não encontrado.';
  end if;
  if v_ticket.solicitante_id is distinct from v_user_id then
    raise exception 'Você só pode executar esta ação em um chamado que registrou.';
  end if;
  if v_ticket.status <> 'aguardando_usuario'::public.status_chamado then
    raise exception 'Estas ações só estão disponíveis quando o chamado está aguardando o usuário.';
  end if;

  v_novo_status := case
    when _acao = 'retomar' then 'aberto'::public.status_chamado
    else 'fechado'::public.status_chamado
  end;

  perform set_config('app.solicitante_acao_chamado', 'on', true);
  if public.has_role(v_user_id, 'gestor'::public.app_role) then
    perform set_config('app.gestor_acao_solicitante', 'on', true);
  end if;

  update public.chamados
  set status = v_novo_status,
      reaberto_em = reaberto_em,
      fechado_em = case when _acao = 'fechar' then v_agora else fechado_em end,
      resolvido_em = case when _acao = 'fechar' then coalesce(resolvido_em, v_agora) else resolvido_em end,
      sla_pausado = false
  where id = v_ticket.id;

  insert into public.historico_chamado
    (chamado_id, autor_id, acao, de, para, ator_role)
  values
    (v_ticket.id, v_user_id, 'status_alterado', 'aguardando_usuario', v_novo_status::text,
      case when public.has_role(v_user_id, 'gestor'::public.app_role) then 'gestor' else 'colaborador' end);

  if _acao = 'retomar' then
    insert into public.historico_chamado
      (chamado_id, autor_id, acao, de, para, ator_role)
    values
      (v_ticket.id, v_user_id, 'solicitante_pediu_mais_ajuda', null, v_motivo,
        case when public.has_role(v_user_id, 'gestor'::public.app_role) then 'gestor' else 'colaborador' end);
  end if;

  return jsonb_build_object(
    'id', v_ticket.id,
    'status', v_novo_status::text,
    'numero', v_ticket.numero,
    'atendente_id', v_ticket.atendente_id,
    'motivo', v_motivo
  );
end;
$$;


revoke all on function public.acao_solicitante_chamado(uuid, text, text) from public, anon;
grant execute on function public.acao_solicitante_chamado(uuid, text, text) to authenticated;
