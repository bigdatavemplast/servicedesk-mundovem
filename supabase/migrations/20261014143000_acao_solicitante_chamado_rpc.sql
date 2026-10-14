-- Permite ao gestor retomar ou resolver somente chamados que ele próprio registrou
-- e que estejam aguardando resposta do usuário. A função altera apenas campos de status.
create or replace function public.acao_solicitante_chamado(_chamado_id uuid, _acao text)
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
begin
  if v_user_id is null then
    raise exception 'É necessário estar autenticado.';
  end if;

  if not public.has_role(v_user_id, 'gestor'::public.app_role)
     or public.has_role(v_user_id, 'admin'::public.app_role) then
    raise exception 'Esta ação está disponível apenas para gestores.';
  end if;

  if _acao not in ('retomar', 'resolver') then
    raise exception 'Ação inválida.';
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
    when _acao = 'retomar' then 'reaberto'::public.status_chamado
    else 'resolvido'::public.status_chamado
  end;

  update public.chamados
  set status = v_novo_status,
      reaberto_em = case when _acao = 'retomar' then v_agora else reaberto_em end,
      resolvido_em = case when _acao = 'resolver' then v_agora else resolvido_em end,
      sla_pausado = false
  where id = v_ticket.id;

  insert into public.historico_chamado
    (chamado_id, autor_id, acao, de, para, ator_role)
  values
    (v_ticket.id, v_user_id, 'status_alterado', 'aguardando_usuario', v_novo_status::text, 'gestor');

  return jsonb_build_object(
    'id', v_ticket.id,
    'status', v_novo_status::text,
    'numero', v_ticket.numero,
    'atendente_id', v_ticket.atendente_id
  );
end;
$$;

revoke all on function public.acao_solicitante_chamado(uuid, text) from public, anon;
grant execute on function public.acao_solicitante_chamado(uuid, text) to authenticated;
