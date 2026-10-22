-- Regra definitiva: gestor só pode reabrir o chamado que ele próprio abriu.
-- A validação é aplicada na RPC e no trigger; demais alterações seguem bloqueadas.
CREATE OR REPLACE FUNCTION public.reabrir_chamado(_chamado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chamado public.chamados%rowtype;
  v_agora timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  SELECT * INTO v_chamado FROM public.chamados WHERE id = _chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chamado não encontrado.'; END IF;
  IF v_chamado.solicitante_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Somente quem abriu o chamado pode reabri-lo.';
  END IF;
  IF v_chamado.resolvido_em IS NULL OR v_chamado.resolvido_em <= v_agora - interval '48 hours' THEN
    RAISE EXCEPTION 'O prazo de 48 horas para reabrir este chamado expirou. Abra um novo chamado para o mesmo problema.';
  END IF;
  IF v_chamado.status NOT IN ('resolvido', 'fechado') THEN
    RAISE EXCEPTION 'Somente chamados resolvidos ou fechados recentemente podem ser reabertos.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('colaborador','gestor')) THEN
    RAISE EXCEPTION 'Seu perfil não possui permissão para reabrir chamados.';
  END IF;
  PERFORM set_config('app.solicitante_reabre_chamado', 'on', true);
  UPDATE public.chamados SET status = 'reaberto', reaberto_em = v_agora, sla_pausado = false,
    sla_pausado_em = NULL, fechado_em = NULL, avaliacao_nota = NULL, avaliacao_comentario = NULL
  WHERE id = _chamado_id;
  INSERT INTO public.historico_chamado(chamado_id, autor_id, acao, de, para)
  VALUES (_chamado_id, auth.uid(), 'chamado_reaberto', v_chamado.status, 'reaberto');
  RETURN jsonb_build_object('ok', true, 'status', 'reaberto', 'reaberto_em', v_agora,
    'prazo_reabertura_expira_em', v_chamado.resolvido_em + interval '48 hours');
END;
$function$;

CREATE OR REPLACE FUNCTION public.bloquear_alteracao_chamado_por_gestor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF current_setting('app.solicitante_reabre_chamado', true) = 'on'
     AND auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(), 'gestor'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND OLD.solicitante_id = auth.uid()
     AND NEW.solicitante_id = auth.uid()
     AND OLD.status IN ('resolvido', 'fechado')
     AND NEW.status = 'reaberto'
     AND OLD.resolvido_em IS NOT NULL
     AND OLD.resolvido_em > now() - interval '48 hours'
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
     AND NEW.prazo_resposta IS NOT DISTINCT FROM OLD.prazo_resposta
     AND NEW.prazo_resolucao IS NOT DISTINCT FROM OLD.prazo_resolucao
     AND NEW.reaberto_em IS NOT NULL
     AND NEW.sla_pausado IS FALSE
     AND NEW.sla_pausado_em IS NULL
     AND NEW.fechado_em IS NULL
     AND NEW.avaliacao_nota IS NULL
     AND NEW.avaliacao_comentario IS NULL
     AND pg_trigger_depth() = 1
  THEN RETURN NEW; END IF;
  IF current_setting('app.avaliacao_chamado_validada', true) = 'on' THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(), 'gestor'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'Perfil Gestor: chamados não podem ser alterados. É permitido apenas adicionar comentários públicos.';
  END IF;
  RETURN NEW;
END;
$function$;
