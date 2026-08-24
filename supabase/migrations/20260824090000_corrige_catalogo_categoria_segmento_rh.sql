-- ============================================================
-- Service Desk - Correção do catálogo Categoria -> Segmento
--
-- Regra:
--   segmento_id é a fonte de verdade do relacionamento.
--   categorias.segmento é mantido sincronizado para compatibilidade
--   com consultas legadas.
--
-- Corrige especificamente o catálogo RH/Férias que estava permitindo
-- Categoria RH dentro do Segmento TI.
-- ============================================================

-- 1) Sincroniza o campo legado de texto com o relacionamento real.
DO $$
BEGIN
  IF to_regclass('public.categorias') IS NOT NULL
     AND to_regclass('public.segmentos') IS NOT NULL THEN
    UPDATE public.categorias c
       SET segmento = s.nome
      FROM public.segmentos s
     WHERE c.segmento_id = s.id
       AND (c.segmento IS DISTINCT FROM s.nome);
  END IF;
END $$;

-- 2) Corrige a categoria RH.
-- Não altera departamento do solicitante nem chamados existentes.
-- Se houver exatamente um segmento ativo chamado RH, o vínculo é
-- corrigido para esse segmento.
DO $$
DECLARE
  v_segmento_rh UUID;
  v_qtd INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER, MIN(id)
    INTO v_qtd, v_segmento_rh
    FROM public.segmentos
   WHERE ativo = TRUE
     AND UPPER(TRIM(nome)) = 'RH';

  IF v_qtd = 1 THEN
    UPDATE public.categorias
       SET segmento_id = v_segmento_rh,
           segmento = 'RH'
     WHERE UPPER(TRIM(nome)) = 'RH';
  ELSIF v_qtd = 0 THEN
    RAISE NOTICE 'Catálogo: segmento RH não encontrado; nenhuma categoria foi alterada.';
  ELSE
    RAISE EXCEPTION 'Catálogo inconsistente: existem % segmentos ativos chamados RH.', v_qtd;
  END IF;
END $$;

-- 3) Garante que a subcategoria Férias pertence à categoria RH.
-- A subcategoria não possui segmento próprio: o segmento é herdado
-- da categoria pai.
DO $$
DECLARE
  v_categoria_rh UUID;
  v_qtd INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER, MIN(id)
    INTO v_qtd, v_categoria_rh
    FROM public.categorias
   WHERE UPPER(TRIM(nome)) = 'RH'
     AND segmento_id = (
       SELECT id
         FROM public.segmentos
        WHERE ativo = TRUE
          AND UPPER(TRIM(nome)) = 'RH'
        LIMIT 1
     );

  IF v_qtd = 1 THEN
    UPDATE public.subcategorias
       SET categoria_id = v_categoria_rh
     WHERE UPPER(TRIM(nome)) = 'FÉRIAS'
       AND categoria_id <> v_categoria_rh;
  END IF;
END $$;

-- 4) Impede que o campo legado categorias.segmento volte a divergir
-- de segmento_id em novos inserts/updates.
CREATE OR REPLACE FUNCTION public.sincronizar_segmento_categoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_nome_segmento TEXT;
BEGIN
  IF NEW.segmento_id IS NULL THEN
    RAISE EXCEPTION 'A categoria deve possuir um segmento.';
  END IF;

  SELECT nome
    INTO v_nome_segmento
    FROM public.segmentos
   WHERE id = NEW.segmento_id;

  IF v_nome_segmento IS NULL THEN
    RAISE EXCEPTION 'O segmento informado para a categoria não existe.';
  END IF;

  NEW.segmento := v_nome_segmento;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_segmento_categoria
  ON public.categorias;

CREATE TRIGGER trg_sincronizar_segmento_categoria
BEFORE INSERT OR UPDATE OF segmento_id
ON public.categorias
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_segmento_categoria();

REVOKE ALL ON FUNCTION public.sincronizar_segmento_categoria() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sincronizar_segmento_categoria() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_segmento_categoria() TO service_role;

-- 5) Índices utilizados pelo catálogo de abertura.
CREATE INDEX IF NOT EXISTS idx_categorias_segmento_id
  ON public.categorias(segmento_id);

CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria_id
  ON public.subcategorias(categoria_id);
