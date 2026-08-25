-- A atribuição automática é determinada pela fila e classificação,
-- não pelo status atual do chamado.

CREATE OR REPLACE FUNCTION public.aplicar_atribuicao_automatica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regra public.regras_atribuicao_automatica%ROWTYPE;
BEGIN
  -- Nunca sobrescreve uma atribuição manual/existente.
  IF NEW.atendente_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Sem fila não há como decidir o responsável.
  IF NEW.grupo_atendimento_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.*
    INTO v_regra
    FROM public.regras_atribuicao_automatica r
   WHERE r.ativo = TRUE
     AND r.grupo_atendimento_id = NEW.grupo_atendimento_id
     AND (r.categoria_id IS NULL OR r.categoria_id = NEW.categoria_id)
     AND (r.subcategoria_id IS NULL OR r.subcategoria_id = NEW.subcategoria_id)
     AND (r.tipo_chamado_id IS NULL OR r.tipo_chamado_id = NEW.tipo_chamado_id)
     AND EXISTS (
       SELECT 1
         FROM public.grupo_atendentes ga
        WHERE ga.grupo_id = r.grupo_atendimento_id
          AND ga.usuario_id = r.atendente_id
          AND ga.ativo = TRUE
     )
   ORDER BY
     CASE WHEN r.subcategoria_id IS NOT NULL THEN 1 ELSE 0 END DESC,
     CASE WHEN r.categoria_id IS NOT NULL THEN 1 ELSE 0 END DESC,
     CASE WHEN r.tipo_chamado_id IS NOT NULL THEN 1 ELSE 0 END DESC,
     r.prioridade ASC,
     r.criado_em ASC
   LIMIT 1;

  IF FOUND THEN
    NEW.atendente_id := v_regra.atendente_id;
    NEW.status := 'aberto';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_atribuicao_automatica ON public.chamados;

CREATE TRIGGER trg_aplicar_atribuicao_automatica
BEFORE INSERT OR UPDATE OF grupo_atendimento_id, categoria_id, subcategoria_id, tipo_chamado_id, status
ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.aplicar_atribuicao_automatica();

REVOKE ALL ON FUNCTION public.aplicar_atribuicao_automatica() FROM PUBLIC, anon, authenticated;
