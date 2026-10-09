-- Permite que o trigger de interação retome somente o SLA pausado
-- quando o próprio colaborador envia uma resposta pública.
-- Mantém bloqueadas as alterações manuais de status e campos operacionais.

CREATE OR REPLACE FUNCTION public.validar_permissoes_chamado_por_papel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_evaluation_close boolean := false;
  v_reopen boolean := false;
  v_sla_interaction boolean := false;
BEGIN
  IF v_actor IS NULL THEN RETURN NEW; END IF;
  SELECT ur.role INTO v_role FROM public.user_roles ur WHERE ur.user_id = v_actor LIMIT 1;
  IF v_role = 'admin' THEN RETURN NEW; END IF;

  IF current_setting('app.service_desk_automation_reopen', true) = 'on'
     AND v_role = 'colaborador'
     AND OLD.solicitante_id = v_actor AND NEW.solicitante_id = v_actor
     AND OLD.status = 'resolvido' AND NEW.status = 'aberto'
     AND NEW.resolvido_em IS NULL AND NEW.reaberto_em IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_sla_interaction :=
    current_setting('app.service_desk_sla_interaction', true) = 'on'
    AND v_role = 'colaborador'
    AND OLD.solicitante_id = v_actor AND NEW.solicitante_id = v_actor
    AND OLD.sla_pausado IS TRUE AND NEW.sla_pausado IS FALSE
    AND OLD.sla_tempo_restante_segundos IS NOT NULL
    AND NEW.sla_tempo_restante_segundos IS NULL
    AND OLD.status IN ('aguardando_usuario', 'aguardando_terceiro')
    AND NEW.status IN ('em_andamento', 'aguardando_terceiro', 'aguardando_usuario')
    AND NEW.atendente_id IS NOT DISTINCT FROM OLD.atendente_id
    AND NEW.grupo_atendimento_id IS NOT DISTINCT FROM OLD.grupo_atendimento_id
    AND NEW.segmento_id IS NOT DISTINCT FROM OLD.segmento_id
    AND NEW.categoria_id IS NOT DISTINCT FROM OLD.categoria_id
    AND NEW.subcategoria_id IS NOT DISTINCT FROM OLD.subcategoria_id
    AND NEW.prioridade IS NOT DISTINCT FROM OLD.prioridade
    AND NEW.impacto IS NOT DISTINCT FROM OLD.impacto
    AND NEW.urgencia IS NOT DISTINCT FROM OLD.urgencia
    AND NEW.sla_id IS NOT DISTINCT FROM OLD.sla_id
    AND NEW.sla_regra_id IS NOT DISTINCT FROM OLD.sla_regra_id
    AND NEW.prazo_resposta IS NOT DISTINCT FROM OLD.prazo_resposta;
  IF v_sla_interaction THEN RETURN NEW; END IF;

  v_evaluation_close := v_role = 'colaborador'
    AND OLD.solicitante_id = v_actor AND NEW.solicitante_id = v_actor
    AND OLD.status = 'resolvido' AND NEW.status = 'fechado'
    AND OLD.avaliacao_nota IS NULL AND NEW.avaliacao_nota IS NOT NULL;
  v_reopen := v_role = 'colaborador'
    AND OLD.solicitante_id = v_actor AND NEW.solicitante_id = v_actor
    AND OLD.status IN ('resolvido','fechado') AND NEW.status = 'reaberto'
    AND OLD.resolvido_em IS NOT NULL AND OLD.resolvido_em > now() - interval '48 hours';

  IF v_role = 'colaborador' THEN
    IF OLD.solicitante_id IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'Colaborador só pode alterar os próprios chamados.'; END IF;
    IF v_reopen THEN RETURN NEW; END IF;
    IF NOT v_evaluation_close AND (
      NEW.atendente_id IS DISTINCT FROM OLD.atendente_id OR
      NEW.grupo_atendimento_id IS DISTINCT FROM OLD.grupo_atendimento_id OR
      NEW.segmento_id IS DISTINCT FROM OLD.segmento_id OR
      NEW.categoria_id IS DISTINCT FROM OLD.categoria_id OR
      NEW.subcategoria_id IS DISTINCT FROM OLD.subcategoria_id OR
      NEW.prioridade IS DISTINCT FROM OLD.prioridade OR
      NEW.impacto IS DISTINCT FROM OLD.impacto OR
      NEW.urgencia IS DISTINCT FROM OLD.urgencia OR
      NEW.status IS DISTINCT FROM OLD.status OR
      NEW.sla_id IS DISTINCT FROM OLD.sla_id OR
      NEW.sla_regra_id IS DISTINCT FROM OLD.sla_regra_id OR
      NEW.prazo_resposta IS DISTINCT FROM OLD.prazo_resposta OR
      NEW.prazo_resolucao IS DISTINCT FROM OLD.prazo_resolucao
    ) THEN RAISE EXCEPTION 'Colaborador não possui permissão para alterar a operação do chamado.'; END IF;
    RETURN NEW;
  END IF;

  IF v_role = 'atendente' THEN
    IF OLD.atendente_id IS NOT NULL THEN RAISE EXCEPTION 'Atendente só pode operar chamados que ainda não possuem atendente.'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.grupo_atendentes ga JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
      WHERE ga.usuario_id = v_actor AND ga.ativo = TRUE AND g.ativo = TRUE
        AND ((OLD.grupo_atendimento_id IS NOT NULL AND g.id = OLD.grupo_atendimento_id)
          OR (OLD.grupo_atendimento_id IS NULL AND g.segmento_id = OLD.segmento_id))
    ) THEN RAISE EXCEPTION 'Atendente só pode operar chamados sem atendente da própria área/grupo.'; END IF;
    IF NEW.solicitante_id IS DISTINCT FROM OLD.solicitante_id OR
       NEW.grupo_atendimento_id IS DISTINCT FROM OLD.grupo_atendimento_id OR
       NEW.segmento_id IS DISTINCT FROM OLD.segmento_id OR
       NEW.sla_id IS DISTINCT FROM OLD.sla_id OR
       NEW.sla_regra_id IS DISTINCT FROM OLD.sla_regra_id OR
       NEW.prazo_resposta IS DISTINCT FROM OLD.prazo_resposta OR
       NEW.prazo_resolucao IS DISTINCT FROM OLD.prazo_resolucao OR
       NEW.sla_tempo_resposta_segundos IS DISTINCT FROM OLD.sla_tempo_resposta_segundos OR
       NEW.sla_tempo_resolucao_segundos IS DISTINCT FROM OLD.sla_tempo_resolucao_segundos OR
       NEW.escalonamento_nivel IS DISTINCT FROM OLD.escalonamento_nivel OR
       NEW.escalonado IS DISTINCT FROM OLD.escalonado THEN
      RAISE EXCEPTION 'Atendente não pode alterar roteamento, setor ou regras de SLA.';
    END IF;
    RETURN NEW;
  END IF;
  IF v_role = 'gestor' THEN
    IF NOT public.gestor_pode_ver_chamado(v_actor, OLD.id) THEN RAISE EXCEPTION 'Gestor não possui permissão para operar este chamado.'; END IF;
    IF NEW.segmento_id IS DISTINCT FROM OLD.segmento_id THEN RAISE EXCEPTION 'Gestor não pode mover chamados para outro setor.'; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Usuário não possui permissão para alterar chamados.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.atualizar_sla_por_interacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chamado public.chamados%ROWTYPE;
  v_staff BOOLEAN;
  v_agora TIMESTAMPTZ := COALESCE(NEW.criado_em, NOW());
  v_restante BIGINT;
  v_override_anterior text;
BEGIN
  SELECT * INTO v_chamado FROM public.chamados WHERE id = NEW.chamado_id FOR UPDATE;
  IF NOT FOUND OR NEW.interno THEN RETURN NEW; END IF;
  v_staff := public.has_any_role(NEW.autor_id, ARRAY['atendente','gestor','admin']::public.app_role[]);

  IF v_staff THEN
    IF NOT COALESCE(v_chamado.sla_pausado, FALSE)
       AND v_chamado.status NOT IN ('resolvido','fechado','cancelado') THEN
      v_restante := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(v_chamado.prazo_resolucao, v_agora) - v_agora)))::BIGINT);
      UPDATE public.chamados
      SET sla_pausado = TRUE, sla_pausado_em = v_agora, sla_tempo_restante_segundos = v_restante,
          status = CASE WHEN status IN ('aberto','em_andamento') THEN 'aguardando_usuario'::public.status_chamado ELSE status END
      WHERE id = NEW.chamado_id;
      INSERT INTO public.historico_sla_chamado(chamado_id,tipo,autor_id,criado_em,tempo_restante_segundos,prazo_anterior,novo_prazo,observacao)
      VALUES (NEW.chamado_id,'pausa',NEW.autor_id,v_agora,v_restante,v_chamado.prazo_resolucao,v_chamado.prazo_resolucao,'SLA pausado após resposta pública da equipe.');
    END IF;
  ELSE
    IF v_chamado.sla_pausado AND v_chamado.sla_tempo_restante_segundos IS NOT NULL
       AND v_chamado.status NOT IN ('resolvido','fechado','cancelado') THEN
      v_restante := GREATEST(v_chamado.sla_tempo_restante_segundos, 0);
      v_override_anterior := current_setting('app.service_desk_sla_interaction', true);
      PERFORM set_config('app.service_desk_sla_interaction', 'on', true);
      UPDATE public.chamados
      SET sla_pausado = FALSE, sla_pausado_em = NULL, sla_tempo_restante_segundos = NULL,
          prazo_resolucao = v_agora + make_interval(secs => v_restante),
          status = CASE WHEN status = 'aguardando_usuario' THEN 'em_andamento'::public.status_chamado ELSE status END
      WHERE id = NEW.chamado_id;
      PERFORM set_config('app.service_desk_sla_interaction', COALESCE(NULLIF(v_override_anterior, ''), 'off'), true);
      INSERT INTO public.historico_sla_chamado(chamado_id,tipo,autor_id,criado_em,tempo_restante_segundos,prazo_anterior,novo_prazo,observacao)
      VALUES (NEW.chamado_id,'retomada',NEW.autor_id,v_agora,v_restante,v_chamado.prazo_resolucao,v_agora + make_interval(secs => v_restante),'SLA retomado após resposta do solicitante.');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
