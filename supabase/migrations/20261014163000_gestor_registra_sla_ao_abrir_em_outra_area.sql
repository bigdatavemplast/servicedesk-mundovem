CREATE OR REPLACE FUNCTION public.registrar_evento_sla(
  p_chamado_id uuid,
  p_sla_regra_id uuid,
  p_tipo character varying,
  p_motivo text DEFAULT NULL::text,
  p_usuario_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_is_admin boolean;
  v_is_manager boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  v_is_manager := public.has_role(auth.uid(), 'gestor'::public.app_role);

  IF NOT (
    v_is_admin
    OR v_is_manager
    OR public.has_role(auth.uid(), 'atendente'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Perfil sem permissão para registrar eventos de SLA' USING ERRCODE = '42501';
  END IF;

  IF p_usuario_id IS NOT NULL AND p_usuario_id <> auth.uid() AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Não é permitido registrar evento em nome de outro usuário' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chamados c
    WHERE c.id = p_chamado_id
      AND (
        v_is_admin
        OR (
          v_is_manager
          AND (
            public.gestor_pode_ver_chamado(auth.uid(), c.id)
            OR (
              c.solicitante_id = auth.uid()
              AND p_tipo = 'iniciado'
              AND c.sla_regra_id IS NOT DISTINCT FROM p_sla_regra_id
            )
          )
        )
        OR (
          public.has_role(auth.uid(), 'atendente'::public.app_role)
          AND EXISTS (
            SELECT 1
            FROM public.profiles p
            JOIN public.areas a ON a.id = p.area_id
            JOIN public.segmentos s ON lower(trim(s.nome)) = lower(trim(a.nome))
            WHERE p.id = auth.uid()
              AND p.ativo = true
              AND a.ativo = true
              AND s.ativo = true
              AND s.id = c.segmento_id
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Chamado não encontrado ou fora do seu escopo de atendimento' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.sla_eventos (
    chamado_id, sla_regra_id, tipo, motivo, usuario_id
  )
  VALUES (
    p_chamado_id, p_sla_regra_id, p_tipo, p_motivo, COALESCE(p_usuario_id, auth.uid())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
