-- ============================================================
-- Service Desk - Integridade geral do catálogo
-- Segmento -> Categoria -> Subcategoria -> Fila
-- ============================================================

-- categorias.segmento_id é a relação oficial com segmentos.
-- categorias.segmento é mantido sincronizado para compatibilidade.

-- 1) Corrige todos os campos textuais existentes a partir do vínculo real.
UPDATE public.categorias c
SET segmento = s.nome
FROM public.segmentos s
WHERE c.segmento_id = s.id
  AND c.segmento IS DISTINCT FROM s.nome;

-- 2) Categorias legadas sem segmento_id: usa o campo textual somente
-- quando houver exatamente um segmento correspondente.
UPDATE public.categorias c
SET segmento_id = s.id
FROM public.segmentos s
WHERE c.segmento_id IS NULL
  AND c.segmento IS NOT NULL
  AND UPPER(TRIM(c.segmento)) = UPPER(TRIM(s.nome))
  AND NOT EXISTS (
    SELECT 1
    FROM public.segmentos s2
    WHERE UPPER(TRIM(s2.nome)) = UPPER(TRIM(c.segmento))
      AND s2.id <> s.id
  );

-- 3) Corrige categorias conhecidas cuja classificação é inequívoca.
DO $$
DECLARE
  v_ti UUID;
  v_rh UUID;
  v_financeiro UUID;
  v_projetos UUID;
BEGIN
  SELECT id INTO v_ti FROM public.segmentos
   WHERE ativo = TRUE AND UPPER(TRIM(nome)) = 'TI' LIMIT 1;
  SELECT id INTO v_rh FROM public.segmentos
   WHERE ativo = TRUE AND UPPER(TRIM(nome)) = 'RH' LIMIT 1;
  SELECT id INTO v_financeiro FROM public.segmentos
   WHERE ativo = TRUE AND UPPER(TRIM(nome)) = 'FINANCEIRO' LIMIT 1;
  SELECT id INTO v_projetos FROM public.segmentos
   WHERE ativo = TRUE AND UPPER(TRIM(nome)) = 'PROJETOS' LIMIT 1;

  IF v_ti IS NOT NULL THEN
    UPDATE public.categorias
    SET segmento_id = v_ti, segmento = 'TI'
    WHERE UPPER(TRIM(nome)) IN ('SISTEMAS','SUPORTE','ACESSOS E PERMISSÕES','HARDWARE');
  END IF;

  IF v_rh IS NOT NULL THEN
    UPDATE public.categorias
    SET segmento_id = v_rh, segmento = 'RH'
    WHERE UPPER(TRIM(nome)) = 'RH';
  END IF;

  IF v_financeiro IS NOT NULL THEN
    UPDATE public.categorias
    SET segmento_id = v_financeiro, segmento = 'Financeiro'
    WHERE UPPER(TRIM(nome)) = 'FINANCEIRO';
  END IF;

  IF v_projetos IS NOT NULL THEN
    UPDATE public.categorias
    SET segmento_id = v_projetos, segmento = 'Projetos'
    WHERE UPPER(TRIM(nome)) = 'PROJETOS';
  END IF;
END $$;

-- 4) Subcategorias herdam o segmento através da categoria pai.
-- Corrige relações inequívocas conhecidas e não inventa relações
-- para nomes ambíguos.
DO $$
DECLARE
  v_categoria_rh UUID;
BEGIN
  SELECT id INTO v_categoria_rh
  FROM public.categorias
  WHERE UPPER(TRIM(nome)) = 'RH'
    AND segmento_id = (
      SELECT id FROM public.segmentos
      WHERE ativo = TRUE AND UPPER(TRIM(nome)) = 'RH'
      LIMIT 1
    )
  LIMIT 1;

  IF v_categoria_rh IS NOT NULL THEN
    UPDATE public.subcategorias
    SET categoria_id = v_categoria_rh
    WHERE UPPER(TRIM(nome)) IN ('FÉRIAS','FERIAS');
  END IF;
END $$;

-- 5) Integridade futura: categoria sempre sincroniza seu segmento textual.
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

  SELECT nome INTO v_nome_segmento
  FROM public.segmentos
  WHERE id = NEW.segmento_id;

  IF v_nome_segmento IS NULL THEN
    RAISE EXCEPTION 'O segmento informado para a categoria não existe.';
  END IF;

  NEW.segmento := v_nome_segmento;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_segmento_categoria ON public.categorias;
CREATE TRIGGER trg_sincronizar_segmento_categoria
BEFORE INSERT OR UPDATE OF segmento_id
ON public.categorias
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_segmento_categoria();

REVOKE ALL ON FUNCTION public.sincronizar_segmento_categoria() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sincronizar_segmento_categoria() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_segmento_categoria() TO service_role;

-- 6) Índices da hierarquia do catálogo.
CREATE INDEX IF NOT EXISTS idx_categorias_segmento_id
  ON public.categorias(segmento_id);

CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria_id
  ON public.subcategorias(categoria_id);
