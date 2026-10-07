-- Corrige avaliação do colaborador: 72h, fechamento atômico e permissão específica
-- para a transição Resolvido -> Fechado causada pela avaliação.

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

  IF v_role = 'colaborador' THEN
    IF OLD.solicitante_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Colaborador só pode alterar os próprios chamados.';
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

CREATE OR REPLACE FUNCTION public.avaliar_chamado(
  _chamado_id uuid,
  _nota integer,
  _comentario text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_chamado public.chamados%rowtype;
  v_agora timestamptz := now();
  v_nota integer;
  v_comentario text;
  v_automatica boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  IF _nota < 1 OR _nota > 5 THEN RAISE EXCEPTION 'A nota deve estar entre 1 e 5.'; END IF;

  SELECT * INTO v_chamado
  FROM public.chamados
  WHERE id = _chamado_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Chamado não encontrado.'; END IF;
  IF v_chamado.solicitante_id <> auth.uid() THEN RAISE EXCEPTION 'Somente o solicitante pode avaliar o chamado.'; END IF;
  IF v_chamado.status <> 'resolvido' THEN RAISE EXCEPTION 'O chamado precisa estar resolvido para ser avaliado.'; END IF;
  IF v_chamado.avaliacao_nota IS NOT NULL THEN RAISE EXCEPTION 'Este chamado já foi avaliado.'; END IF;
  IF v_chamado.resolvido_em IS NULL THEN RAISE EXCEPTION 'O chamado não possui data de resolução válida.'; END IF;

  IF v_chamado.resolvido_em <= v_agora - interval '72 hours' THEN
    v_nota := 5;
    v_comentario := 'Avaliação automática: o colaborador não avaliou o chamado dentro de 72 horas após a resolução.';
    v_automatica := true;
  ELSE
    v_nota := _nota;
    v_comentario := nullif(trim(coalesce(_comentario, '')), '');
  END IF;

  UPDATE public.chamados
     SET avaliacao_nota = v_nota,
         avaliacao_comentario = v_comentario,
         status = 'fechado',
         fechado_em = v_agora,
         sla_pausado = false
   WHERE id = _chamado_id;

  INSERT INTO public.historico_chamado (chamado_id, autor_id, acao, de, para)
  VALUES (
    _chamado_id,
    CASE WHEN v_automatica THEN NULL ELSE auth.uid() END,
    CASE WHEN v_automatica THEN 'avaliacao_automatica' ELSE 'avaliacao_registrada' END,
    'resolvido',
    CASE WHEN v_automatica THEN 'fechado — 5 estrelas automáticas'
         ELSE format('fechado — %s estrelas', v_nota) END
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'fechado',
    'avaliacao_nota', v_nota,
    'avaliacao_automatica', v_automatica,
    'fechado_em', v_agora
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_avaliar_chamados_expirados()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_chamado public.chamados%rowtype;
  v_agora timestamptz := now();
BEGIN
  FOR v_chamado IN
    SELECT *
    FROM public.chamados
    WHERE status = 'resolvido'
      AND avaliacao_nota IS NULL
      AND resolvido_em IS NOT NULL
      AND resolvido_em <= v_agora - interval '72 hours'
    FOR UPDATE
  LOOP
    UPDATE public.chamados
       SET avaliacao_nota = 5,
           avaliacao_comentario = 'Avaliação automática: o colaborador não avaliou o chamado dentro de 72 horas após a resolução.',
           status = 'fechado',
           fechado_em = COALESCE(fechado_em, v_agora),
           sla_pausado = false
     WHERE id = v_chamado.id;

    INSERT INTO public.historico_chamado (chamado_id, autor_id, acao, de, para)
    VALUES (v_chamado.id, NULL, 'avaliacao_automatica', 'resolvido', 'fechado — 5 estrelas automáticas');
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.auto_avaliar_chamados_expirados() FROM PUBLIC;
