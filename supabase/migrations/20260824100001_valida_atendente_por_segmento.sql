-- ============================================================
-- Service Desk - Integridade de atribuição
-- Chamado -> Segmento -> Grupo/Fila -> Atendente
--
-- Um atendente somente pode ser atribuído a um chamado se estiver
-- ativo em um grupo ativo pertencente ao mesmo segmento do chamado.
-- Chamados sem atendente continuam válidos.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validar_atendente_chamado_por_segmento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Não há validação quando o chamado está sem atendente.
  IF NEW.atendente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Chamados legados sem segmento não podem receber atribuição por
  -- segmento até que sua classificação seja regularizada.
  IF NEW.segmento_id IS NULL THEN
    RAISE EXCEPTION 'Não é possível atribuir atendente a chamado sem segmento.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.grupo_atendentes ga
      JOIN public.grupos_atendimento g
        ON g.id = ga.grupo_id
     WHERE ga.usuario_id = NEW.atendente_id
       AND ga.ativo = TRUE
       AND g.ativo = TRUE
       AND g.segmento_id = NEW.segmento_id
  ) THEN
    RAISE EXCEPTION 'O atendente selecionado não pertence a um grupo ativo do segmento deste chamado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_atendente_chamado_por_segmento
  ON public.chamados;

CREATE TRIGGER trg_validar_atendente_chamado_por_segmento
BEFORE INSERT OR UPDATE OF atendente_id, segmento_id
ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.validar_atendente_chamado_por_segmento();

REVOKE ALL ON FUNCTION public.validar_atendente_chamado_por_segmento() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validar_atendente_chamado_por_segmento() TO service_role;
