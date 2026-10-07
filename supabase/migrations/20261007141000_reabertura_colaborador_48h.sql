-- Permite ao colaborador reabrir o próprio chamado resolvido somente dentro das 48h.
-- Após 48h, o chamado deve seguir fechado por avaliação automática e um novo chamado deve ser aberto para novo problema.

CREATE OR REPLACE FUNCTION public.validar_permissoes_chamado_por_papel()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_depto text;
  v_segmento text;
  v_evaluation_close boolean := false;
  v_reopen boolean := false;
BEGIN
  IF v_actor IS NULL THEN RETURN NEW; END IF;

  SELECT ur.role INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_actor
  LIMIT 1;

  IF v_role = 'admin' THEN RETURN NEW; END IF;

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
    AND OLD.status = 'resolvido'
    AND NEW.status = 'reaberto'
    AND OLD.avaliacao_nota IS NULL
    AND OLD.resolvido_em IS NOT NULL
    AND OLD.resolvido_em > now() - interval '48 hours';

  IF v_role = 'colaborador' THEN
    IF OLD.solicitante_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Colaborador só pode alterar os próprios chamados.';
    END IF;

    IF v_reopen THEN
      RETURN NEW;
    END IF;

    IF NOT v_evaluation_close AND (
      NEW.atendente_id IS DISTINCT FROM OLD.atendente_id
      OR NEW.grupo_atendimento_id IS DISTINCT FROM OLD.grupo_atendimento_id
      OR NEW.segmento_id IS DISTINCT FROM OLD.segmento_id
      OR NEW.categoria_id IS DISTINCT FROM OLD.categoria_id
      OR NEW.subcategoria_id IS DISTINCT FROM OLD.subcategoria_id
      OR NEW.prioridade IS DISTINCT FROM OLD.prioridade
      OR NEW.impacto IS DISTINCT FROM OLD.impacto
      OR NEW.urgencia IS DISTINCT FROM OLD.urgencia
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.sla_id IS DISTINCT FROM OLD.sla_id
      OR NEW.sla_regra_id IS DISTINCT FROM OLD.sla_regra_id
      OR NEW.prazo_resposta IS DISTINCT FROM OLD.prazo_resposta
      OR NEW.prazo_resolucao IS DISTINCT FROM OLD.prazo_resolucao
    ) THEN
      RAISE EXCEPTION 'Colaborador não possui permissão para alterar a operação do chamado.';
    END IF;

    RETURN NEW;
  END IF;

  IF v_role = 'atendente' THEN
    IF OLD.atendente_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Atendente só pode operar chamados atribuídos a ele.';
    END IF;

    SELECT COALESCE(d.nome, NULLIF(trim(p.departamento), ''))
      INTO v_depto
    FROM public.profiles p
    LEFT JOIN public.departamentos d ON d.id = p.departamento_id
    WHERE p.id = v_actor;

    SELECT s.nome INTO v_segmento
    FROM public.segmentos s
    WHERE s.id = OLD.segmento_id AND s.ativo = TRUE;

    IF v_depto IS NULL OR v_segmento IS NULL
       OR lower(trim(v_depto)) <> lower(trim(v_segmento)) THEN
      RAISE EXCEPTION 'Atendente só pode operar chamados do próprio setor.';
    END IF;

    IF NEW.solicitante_id IS DISTINCT FROM OLD.solicitante_id
       OR NEW.atendente_id IS DISTINCT FROM OLD.atendente_id
       OR NEW.grupo_atendimento_id IS DISTINCT FROM OLD.grupo_atendimento_id
       OR NEW.segmento_id IS DISTINCT FROM OLD.segmento_id
       OR NEW.sla_id IS DISTINCT FROM OLD.sla_id
       OR NEW.sla_regra_id IS DISTINCT FROM OLD.sla_regra_id
       OR NEW.prazo_resposta IS DISTINCT FROM OLD.prazo_resposta
       OR NEW.prazo_resolucao IS DISTINCT FROM OLD.prazo_resolucao
       OR NEW.sla_tempo_resposta_segundos IS DISTINCT FROM OLD.sla_tempo_resposta_segundos
       OR NEW.sla_tempo_resolucao_segundos IS DISTINCT FROM OLD.sla_tempo_resolucao_segundos
       OR NEW.escalonamento_nivel IS DISTINCT FROM OLD.escalonamento_nivel
       OR NEW.escalonado IS DISTINCT FROM OLD.escalonado THEN
      RAISE EXCEPTION 'Atendente não pode alterar roteamento, responsável, setor ou regras de SLA.';
    END IF;

    RETURN NEW;
  END IF;

  IF v_role = 'gestor' THEN
    SELECT COALESCE(d.nome, NULLIF(trim(p.departamento), ''))
      INTO v_depto
    FROM public.profiles p
    LEFT JOIN public.departamentos d ON d.id = p.departamento_id
    WHERE p.id = v_actor;

    SELECT s.nome INTO v_segmento
    FROM public.segmentos s
    WHERE s.id = OLD.segmento_id AND s.ativo = TRUE;

    IF v_depto IS NULL OR v_segmento IS NULL
       OR lower(trim(v_depto)) <> lower(trim(v_segmento)) THEN
      RAISE EXCEPTION 'Gestor só pode operar chamados do próprio setor.';
    END IF;

    IF NEW.segmento_id IS DISTINCT FROM OLD.segmento_id THEN
      RAISE EXCEPTION 'Gestor não pode mover chamados para outro setor.';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Usuário não possui permissão para alterar chamados.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.reabrir_chamado(_chamado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_chamado public.chamados%rowtype;
  v_agora timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_chamado
  FROM public.chamados
  WHERE id = _chamado_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;

  IF v_chamado.solicitante_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o colaborador solicitante pode reabrir o chamado.';
  END IF;

  IF v_chamado.status <> 'resolvido' THEN
    RAISE EXCEPTION 'Somente chamados resolvidos podem ser reabertos.';
  END IF;

  IF v_chamado.avaliacao_nota IS NOT NULL THEN
    RAISE EXCEPTION 'Este chamado já foi avaliado e não pode ser reaberto.';
  END IF;

  IF v_chamado.resolvido_em IS NULL OR v_chamado.resolvido_em <= v_agora - interval '48 hours' THEN
    RAISE EXCEPTION 'O prazo de 48 horas para reabrir este chamado expirou. Abra um novo chamado para o mesmo problema.';
  END IF;

  UPDATE public.chamados
  SET status = 'reaberto',
      reaberto_em = v_agora,
      sla_pausado = false,
      sla_pausado_em = NULL,
      fechado_em = NULL
  WHERE id = _chamado_id;

  INSERT INTO public.historico_chamado(chamado_id, autor_id, acao, de, para)
  VALUES (_chamado_id, auth.uid(), 'chamado_reaberto', 'resolvido', 'reaberto');

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'reaberto',
    'reaberto_em', v_agora,
    'prazo_reabertura_expira_em', v_chamado.resolvido_em + interval '48 hours'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reabrir_chamado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reabrir_chamado(uuid) TO authenticated;
