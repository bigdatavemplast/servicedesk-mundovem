-- ============================================================
-- Service Desk - Admin pode assumir qualquer chamado
--
-- Regra operacional:
-- 1. Admin pode assumir para si qualquer chamado, mesmo que seu
--    usuario nao esteja cadastrado em um grupo do segmento.
-- 2. Depois de assumir, o admin pode direcionar o chamado para
--    um atendente/gestor pertencente ao grupo ativo correto.
-- 3. A validacao de grupo/segmento continua valendo para todos
--    os demais usuarios de atendimento.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validar_atendente_chamado_por_segmento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Chamado sem atendente continua permitido.
  IF NEW.atendente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Chamados sem segmento nao podem receber um atendente operacional.
  IF NEW.segmento_id IS NULL THEN
    RAISE EXCEPTION 'Não é possível atribuir atendente a chamado sem segmento.';
  END IF;

  -- Admin pode assumir qualquer chamado para si.
  -- A excecao e baseada no perfil do destinatario da atribuicao.
  IF public.has_role(NEW.atendente_id, 'admin') THEN
    RETURN NEW;
  END IF;

  -- Para qualquer outro atendente/gestor, permanece obrigatorio
  -- pertencer a um grupo ativo do mesmo segmento.
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
