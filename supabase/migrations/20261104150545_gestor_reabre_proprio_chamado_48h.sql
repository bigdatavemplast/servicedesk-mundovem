-- Permite ao gestor reabrir qualquer chamado que ele próprio abriu em até 48 horas,
-- independentemente da área do chamado. Mantém as permissões anteriores do gestor da área/admin.

CREATE OR REPLACE FUNCTION public.reabrir_chamado(_chamado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chamado public.chamados%rowtype;
  v_agora timestamptz := now();
  v_is_admin boolean := false;
  v_is_manager boolean := false;
  v_is_manager_area boolean := false;
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

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ) INTO v_is_admin;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'
  ) INTO v_is_manager;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    JOIN public.areas a ON a.id = p.area_id
    JOIN public.segmentos s ON s.id = v_chamado.segmento_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'gestor'
      AND lower(regexp_replace(trim(a.nome), '[^a-zA-Z0-9]', '', 'g'))
          = lower(regexp_replace(trim(s.nome), '[^a-zA-Z0-9]', '', 'g'))
  ) INTO v_is_manager_area;

  -- Gestor pode reabrir qualquer chamado que ele próprio abriu, mesmo fora da sua área.
  -- Mantém também a permissão existente do gestor da área e do admin.
  IF v_chamado.solicitante_id IS DISTINCT FROM auth.uid()
     AND NOT v_is_manager_area
     AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Somente o solicitante, o gestor da área ou o admin pode reabrir este chamado.';
  END IF;

  IF v_chamado.resolvido_em IS NULL
     OR v_chamado.resolvido_em <= v_agora - interval '48 hours' THEN
    RAISE EXCEPTION 'O prazo de 48 horas para reabrir este chamado expirou. Abra um novo chamado para o mesmo problema.';
  END IF;

  IF v_chamado.status NOT IN ('resolvido', 'fechado') THEN
    RAISE EXCEPTION 'Somente chamados resolvidos ou fechados recentemente podem ser reabertos.';
  END IF;

  IF NOT v_is_admin
     AND NOT v_is_manager_area
     AND NOT (v_is_manager AND v_chamado.solicitante_id = auth.uid())
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role = 'colaborador'
     ) THEN
    RAISE EXCEPTION 'Seu perfil não possui permissão para reabrir chamados.';
  END IF;

  PERFORM set_config('app.solicitante_reabre_chamado', 'on', true);

  UPDATE public.chamados
  SET status = 'reaberto',
      reaberto_em = v_agora,
      sla_pausado = false,
      sla_pausado_em = NULL,
      fechado_em = NULL,
      avaliacao_nota = NULL,
      avaliacao_comentario = NULL
  WHERE id = _chamado_id;

  INSERT INTO public.historico_chamado(chamado_id, autor_id, acao, de, para)
  VALUES (_chamado_id, auth.uid(), 'chamado_reaberto', v_chamado.status, 'reaberto');

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'reaberto',
    'reaberto_em', v_agora,
    'prazo_reabertura_expira_em', v_chamado.resolvido_em + interval '48 hours'
  );
END;
$function$;

COMMENT ON FUNCTION public.reabrir_chamado(uuid)
IS 'Permite ao solicitante, gestor que abriu o chamado, gestor da área ou admin reabrir chamados resolvidos/fechados em até 48 horas, preservando descrição original e histórico.';
