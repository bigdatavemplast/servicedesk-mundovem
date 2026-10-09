-- Corrige a reabertura automática após comentário do solicitante.
-- A automação pode reabrir um chamado resolvido, mas o trigger de segurança
-- bloqueava a atualização feita pela própria automação como se fosse manual.

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
BEGIN
  IF v_actor IS NULL THEN RETURN NEW; END IF;

  SELECT ur.role INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_actor
  LIMIT 1;

  IF v_role = 'admin' THEN RETURN NEW; END IF;

  -- Exceção estrita: somente a automação disparada por comentário pode
  -- reabrir o chamado resolvido do próprio colaborador.
  IF current_setting('app.service_desk_automation_reopen', true) = 'on'
     AND v_role = 'colaborador'
     AND OLD.solicitante_id = v_actor
     AND NEW.solicitante_id = v_actor
     AND OLD.status = 'resolvido'
     AND NEW.status = 'aberto'
     AND NEW.resolvido_em IS NULL
     AND NEW.reaberto_em IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_evaluation_close :=
    v_role = 'colaborador'
    AND OLD.solicitante_id = v_actor
    AND NEW.solicitante_id = v_actor
    AND OLD.status = 'resolvido'
    AND NEW.status = 'fechado'
    AND OLD.avaliacao_nota IS NULL
    AND NEW.avaliacao_nota IS NOT NULL;

  v_reopen :=
    v_role = 'colaborador'
    AND OLD.solicitante_id = v_actor
    AND NEW.solicitante_id = v_actor
    AND OLD.status IN ('resolvido','fechado')
    AND NEW.status = 'reaberto'
    AND OLD.resolvido_em IS NOT NULL
    AND OLD.resolvido_em > now() - interval '48 hours';

  IF v_role = 'colaborador' THEN
    IF OLD.solicitante_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Colaborador só pode alterar os próprios chamados.';
    END IF;
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
    ) THEN
      RAISE EXCEPTION 'Colaborador não possui permissão para alterar a operação do chamado.';
    END IF;
    RETURN NEW;
  END IF;

  IF v_role = 'atendente' THEN
    IF OLD.atendente_id IS NOT NULL THEN
      RAISE EXCEPTION 'Atendente só pode operar chamados que ainda não possuem atendente.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.grupo_atendentes ga
      JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
      WHERE ga.usuario_id = v_actor
        AND ga.ativo = TRUE
        AND g.ativo = TRUE
        AND (
          (OLD.grupo_atendimento_id IS NOT NULL AND g.id = OLD.grupo_atendimento_id)
          OR (OLD.grupo_atendimento_id IS NULL AND g.segmento_id = OLD.segmento_id)
        )
    ) THEN
      RAISE EXCEPTION 'Atendente só pode operar chamados sem atendente da própria área/grupo.';
    END IF;

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
    IF NOT public.gestor_pode_ver_chamado(v_actor, OLD.id) THEN
      RAISE EXCEPTION 'Gestor não possui permissão para operar este chamado.';
    END IF;
    IF NEW.segmento_id IS DISTINCT FROM OLD.segmento_id THEN
      RAISE EXCEPTION 'Gestor não pode mover chamados para outro setor.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Usuário não possui permissão para alterar chamados.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.executar_automacoes_apos_comentario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chamado public.chamados%ROWTYPE;
  v_regra public.automacoes_service_desk%ROWTYPE;
  v_status_condicao text;
  v_override_anterior text;
BEGIN
  IF NEW.interno IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_chamado
  FROM public.chamados
  WHERE id = NEW.chamado_id;

  IF NOT FOUND OR NEW.autor_id IS DISTINCT FROM v_chamado.solicitante_id THEN
    RETURN NEW;
  END IF;

  FOR v_regra IN
    SELECT *
    FROM public.automacoes_service_desk
    WHERE ativo = TRUE AND evento = 'resposta_solicitante'
    ORDER BY ordem, criado_em
  LOOP
    v_status_condicao := NULLIF(v_regra.condicoes ->> 'status', '');
    IF v_status_condicao IS NOT NULL AND v_status_condicao <> v_chamado.status::text THEN
      CONTINUE;
    END IF;

    IF v_regra.acao = 'reabrir' AND v_chamado.status = 'resolvido' THEN
      v_override_anterior := current_setting('app.service_desk_automation_reopen', true);
      PERFORM set_config('app.service_desk_automation_reopen', 'on', true);

      UPDATE public.chamados
      SET status = 'aberto',
          resolvido_em = NULL,
          fechado_em = NULL,
          sla_pausado = FALSE,
          sla_pausado_em = NULL,
          reaberto_em = now(),
          atualizado_em = now()
      WHERE id = v_chamado.id;

      PERFORM set_config(
        'app.service_desk_automation_reopen',
        COALESCE(NULLIF(v_override_anterior, ''), 'off'),
        true
      );

      INSERT INTO public.historico_chamado (
        chamado_id, autor_id, acao, de, para
      ) VALUES (
        v_chamado.id, NEW.autor_id, 'automacao_reabertura', 'resolvido', 'aberto'
      );

      v_chamado.status := 'aberto';
      v_chamado.resolvido_em := NULL;
      v_chamado.fechado_em := NULL;
      v_chamado.sla_pausado := FALSE;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.executar_automacoes_apos_comentario()
  FROM PUBLIC, anon, authenticated;
