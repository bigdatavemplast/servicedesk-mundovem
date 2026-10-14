-- Permite que o próprio solicitante escolha aguardar o atendimento ou fechar
-- um chamado que esteja aguardando usuário. A exceção só existe dentro da RPC
-- depois de validar autenticação, papel, autoria e status.

create or replace function public.validar_permissoes_chamado_por_papel()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_evaluation_close boolean := false;
  v_reopen boolean := false;
  v_sla_interaction boolean := false;
  v_requester_action boolean := false;
begin
  if v_actor is null then return new; end if;
  select ur.role into v_role from public.user_roles ur where ur.user_id = v_actor limit 1;
  if v_role = 'admin' then return new; end if;

  -- Reavalia a condição sem precedência ambígua: só timestamps pertinentes podem mudar.
  v_requester_action :=
    current_setting('app.solicitante_acao_chamado', true) = 'on'
    and v_role in ('colaborador'::public.app_role, 'gestor'::public.app_role)
    and old.solicitante_id = v_actor
    and new.solicitante_id = v_actor
    and old.status = 'aguardando_usuario'
    and new.status in ('reaberto', 'fechado')
    and new.atendente_id is not distinct from old.atendente_id
    and new.grupo_atendimento_id is not distinct from old.grupo_atendimento_id
    and new.segmento_id is not distinct from old.segmento_id
    and new.categoria_id is not distinct from old.categoria_id
    and new.subcategoria_id is not distinct from old.subcategoria_id
    and new.prioridade is not distinct from old.prioridade
    and new.impacto is not distinct from old.impacto
    and new.urgencia is not distinct from old.urgencia
    and new.sla_id is not distinct from old.sla_id
    and new.sla_regra_id is not distinct from old.sla_regra_id
    and new.prazo_resposta is not distinct from old.prazo_resposta
    and new.prazo_resolucao is not distinct from old.prazo_resolucao
    and new.tipo_chamado_id is not distinct from old.tipo_chamado_id
    and new.sla_pausado is false
    and (
      (new.status = 'reaberto' and new.reaberto_em is not null and new.fechado_em is not distinct from old.fechado_em and new.resolvido_em is not distinct from old.resolvido_em)
      or
      (new.status = 'fechado' and new.fechado_em is not null and new.reaberto_em is not distinct from old.reaberto_em and new.resolvido_em is not null)
    );

  if v_requester_action then return new; end if;

  -- Uma resposta pública do solicitante pode retomar o SLA pausado.
  v_sla_interaction :=
    current_setting('app.service_desk_sla_interaction', true) = 'on'
    and v_role = 'colaborador'
    and old.solicitante_id = v_actor
    and new.solicitante_id = v_actor
    and old.sla_pausado is true
    and new.sla_pausado is false
    and old.sla_tempo_restante_segundos is not null
    and new.sla_tempo_restante_segundos is null
    and old.status in ('aguardando_usuario', 'aguardando_terceiro')
    and new.status in ('em_andamento', 'aguardando_terceiro', 'aguardando_usuario')
    and new.atendente_id is not distinct from old.atendente_id
    and new.grupo_atendimento_id is not distinct from old.grupo_atendimento_id
    and new.segmento_id is not distinct from old.segmento_id
    and new.categoria_id is not distinct from old.categoria_id
    and new.subcategoria_id is not distinct from old.subcategoria_id
    and new.prioridade is not distinct from old.prioridade
    and new.impacto is not distinct from old.impacto
    and new.urgencia is not distinct from old.urgencia
    and new.sla_id is not distinct from old.sla_id
    and new.sla_regra_id is not distinct from old.sla_regra_id
    and new.prazo_resposta is not distinct from old.prazo_resposta;

  if v_sla_interaction then return new; end if;

  v_evaluation_close := v_role = 'colaborador'
    and old.solicitante_id = v_actor and new.solicitante_id = v_actor
    and old.status = 'resolvido' and new.status = 'fechado'
    and old.avaliacao_nota is null and new.avaliacao_nota is not null;

  v_reopen := v_role = 'colaborador'
    and old.solicitante_id = v_actor and new.solicitante_id = v_actor
    and old.status in ('resolvido','fechado') and new.status = 'reaberto'
    and old.resolvido_em is not null and old.resolvido_em > now() - interval '48 hours';

  if v_role = 'colaborador' then
    if old.solicitante_id is distinct from v_actor then
      raise exception 'Colaborador só pode alterar os próprios chamados.';
    end if;
    if v_reopen then return new; end if;

    if not v_evaluation_close and (
      new.atendente_id is distinct from old.atendente_id or
      new.grupo_atendimento_id is distinct from old.grupo_atendimento_id or
      new.segmento_id is distinct from old.segmento_id or
      new.categoria_id is distinct from old.categoria_id or
      new.subcategoria_id is distinct from old.subcategoria_id or
      new.prioridade is distinct from old.prioridade or
      new.impacto is distinct from old.impacto or
      new.urgencia is distinct from old.urgencia or
      new.status is distinct from old.status or
      new.sla_id is distinct from old.sla_id or
      new.sla_regra_id is distinct from old.sla_regra_id or
      new.prazo_resposta is distinct from old.prazo_resposta or
      new.prazo_resolucao is distinct from old.prazo_resolucao
    ) then
      raise exception 'Colaborador não possui permissão para alterar a operação do chamado.';
    end if;
    return new;
  end if;

  if v_role = 'atendente' then
    if old.atendente_id is not null then
      raise exception 'Atendente só pode operar chamados que ainda não possuem atendente.';
    end if;
    if not exists (
      select 1 from public.grupo_atendentes ga
      join public.grupos_atendimento g on g.id = ga.grupo_id
      where ga.usuario_id = v_actor and ga.ativo = true and g.ativo = true
        and ((old.grupo_atendimento_id is not null and g.id = old.grupo_atendimento_id)
          or (old.grupo_atendimento_id is null and g.segmento_id = old.segmento_id))
    ) then
      raise exception 'Atendente só pode operar chamados sem atendente da própria área/grupo.';
    end if;
    if new.solicitante_id is distinct from old.solicitante_id or
       new.grupo_atendimento_id is distinct from old.grupo_atendimento_id or
       new.segmento_id is distinct from old.segmento_id or
       new.sla_id is distinct from old.sla_id or
       new.sla_regra_id is distinct from old.sla_regra_id or
       new.prazo_resposta is distinct from old.prazo_resposta or
       new.prazo_resolucao is distinct from old.prazo_resolucao or
       new.sla_tempo_resposta_segundos is distinct from old.sla_tempo_resposta_segundos or
       new.sla_tempo_resolucao_segundos is distinct from old.sla_tempo_resolucao_segundos or
       new.escalonamento_nivel is distinct from old.escalonamento_nivel or
       new.escalonado is distinct from old.escalonado then
      raise exception 'Atendente não pode alterar roteamento, setor ou regras de SLA.';
    end if;
    return new;
  end if;

  if v_role = 'gestor' then
    if not public.gestor_pode_ver_chamado(v_actor, old.id) then
      raise exception 'Gestor não possui permissão para operar este chamado.';
    end if;
    if new.segmento_id is distinct from old.segmento_id then
      raise exception 'Gestor não pode mover chamados para outro setor.';
    end if;
    return new;
  end if;
  raise exception 'Usuário não possui permissão para alterar chamados.';
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
  v_role_ok boolean;
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
    else 'fechado'::public.status_chamado
  end;

  perform set_config('app.solicitante_acao_chamado', 'on', true);
  if public.has_role(v_user_id, 'gestor'::public.app_role) then
    perform set_config('app.gestor_acao_solicitante', 'on', true);
  end if;

  update public.chamados
  set status = v_novo_status,
      reaberto_em = case when _acao = 'retomar' then v_agora else reaberto_em end,
      fechado_em = case when _acao = 'fechar' then v_agora else fechado_em end,
      resolvido_em = case when _acao = 'fechar' then coalesce(resolvido_em, v_agora) else resolvido_em end,
      sla_pausado = false
  where id = v_ticket.id;

  insert into public.historico_chamado
    (chamado_id, autor_id, acao, de, para, ator_role)
  values
    (v_ticket.id, v_user_id, 'status_alterado', 'aguardando_usuario', v_novo_status::text,
      case when public.has_role(v_user_id, 'gestor'::public.app_role) then 'gestor' else 'colaborador' end);

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
-- A exceção da ação do solicitante também precisa ser reconhecida pelos
-- validadores de fluxo/fechamento, sem alterar o fluxo normal de avaliação.
create or replace function public.impedir_fechamento_sem_avaliacao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'fechado'
     and (old.status is null or old.status <> 'fechado')
     and new.avaliacao_nota is null
     and not (
       current_setting('app.solicitante_acao_chamado', true) = 'on'
       and auth.uid() = new.solicitante_id
       and old.status = 'aguardando_usuario'
     ) then
    raise exception 'O chamado só pode ser fechado após a avaliação do colaborador.' using errcode = '42501';
  end if;
  return new;
end;
$function$;

create or replace function public.validar_fluxo_status_chamado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_is_requester boolean := new.solicitante_id = v_user;
  v_is_attendant boolean := exists (select 1 from public.user_roles ur where ur.user_id = v_user and ur.role = 'atendente');
  v_is_manager boolean := exists (select 1 from public.user_roles ur where ur.user_id = v_user and ur.role = 'gestor');
  v_is_admin boolean := exists (select 1 from public.user_roles ur where ur.user_id = v_user and ur.role = 'admin');
  v_is_evaluation_close boolean :=
    new.status = 'fechado' and old.status = 'resolvido'
    and old.avaliacao_nota is null and new.avaliacao_nota is not null and v_is_requester;
begin
  if current_setting('app.solicitante_acao_chamado', true) = 'on'
     and v_is_requester
     and old.status = 'aguardando_usuario'
     and new.status in ('fechado', 'reaberto')
     and (v_is_manager or exists (
       select 1 from public.user_roles ur where ur.user_id = v_user and ur.role = 'colaborador'
     )) then
    return new;
  end if;

  if new.status = 'fechado' and not (v_is_requester or v_is_admin or v_is_evaluation_close) then
    raise exception 'Somente o solicitante pode fechar o chamado.';
  end if;
  if new.status = 'resolvido' and v_is_requester and not (v_is_admin or v_is_manager) then
    raise exception 'O solicitante não pode resolver o chamado. Aguarde o atendimento.';
  end if;
  if new.status = 'fechado' and v_is_attendant and not (v_is_requester or v_is_admin or v_is_evaluation_close) then
    raise exception 'Atendente deve colocar o chamado como Resolvido. O fechamento é feito pelo solicitante.';
  end if;
  return new;
end;
$function$;
