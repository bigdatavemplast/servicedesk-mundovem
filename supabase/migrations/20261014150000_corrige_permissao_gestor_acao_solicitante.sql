-- Permite a ação estritamente limitada de retomar/resolver o próprio chamado do gestor.
-- O marcador só é definido pela RPC após validar papel, autoria e status atual.

create or replace function public.gestor_pode_ver_chamado(_gestor_id uuid, _chamado_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or _gestor_id is distinct from auth.uid() then
    return false;
  end if;

  if not public.has_role(auth.uid(), 'gestor'::public.app_role) then
    return false;
  end if;

  -- Exceção transitória, restrita ao chamado próprio em Aguardando usuário,
  -- durante a RPC validada acao_solicitante_chamado.
  if current_setting('app.gestor_acao_solicitante', true) = 'on'
     and exists (
       select 1
       from public.chamados c
       where c.id = _chamado_id
         and c.solicitante_id = auth.uid()
         and c.status = 'aguardando_usuario'::public.status_chamado
     ) then
    return true;
  end if;

  return exists (
    select 1
    from public.chamados c
    join public.profiles gestor on gestor.id = auth.uid()
    join public.areas area_gestor on area_gestor.id = gestor.area_id
    join public.segmentos segmento on segmento.id = c.segmento_id
    where c.id = _chamado_id
      and gestor.area_id is not null
      and gestor.departamento_id is not null
      and lower(trim(area_gestor.nome)) = lower(trim(segmento.nome))
  );
end;
$function$;

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

  -- O trigger de permissões aceita somente esta exceção temporária e de autoria própria.
  perform set_config('app.gestor_acao_solicitante', 'on', true);

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
