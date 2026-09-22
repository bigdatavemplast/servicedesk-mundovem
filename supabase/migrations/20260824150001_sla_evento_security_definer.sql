-- O registro de eventos SLA ocorre no servidor, mas a sessão autenticada não
-- deve precisar de INSERT direto na tabela protegida por RLS.
CREATE OR REPLACE FUNCTION public.registrar_evento_sla(
  p_chamado_id UUID,
  p_sla_regra_id UUID,
  p_tipo VARCHAR,
  p_motivo TEXT DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.sla_eventos (
    chamado_id,
    sla_regra_id,
    tipo,
    motivo,
    usuario_id
  )
  VALUES (
    p_chamado_id,
    p_sla_regra_id,
    p_tipo,
    p_motivo,
    COALESCE(p_usuario_id, auth.uid())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_evento_sla(UUID, UUID, VARCHAR, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_evento_sla(UUID, UUID, VARCHAR, TEXT, UUID) TO authenticated;
