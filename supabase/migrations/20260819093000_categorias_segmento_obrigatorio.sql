-- ============================================================
-- Categorias: segmento obrigatório
-- Fonte oficial da classificação: public.categorias.segmento
-- ============================================================

ALTER TABLE public.categorias
ADD COLUMN IF NOT EXISTS segmento varchar(50);

COMMENT ON COLUMN public.categorias.segmento IS
'Segmento responsável pela categoria. Obrigatório. Ex.: TI, Projetos, RH, Financeiro, Outros.';

-- Migra dados da estrutura anterior, caso ainda exista.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categorias'
      AND column_name = 'segmento_id'
  ) AND to_regclass('public.segmentos') IS NOT NULL THEN
    UPDATE public.categorias c
       SET segmento = s.nome
      FROM public.segmentos s
     WHERE c.segmento IS NULL
       AND c.segmento_id = s.id;
  END IF;
END $$;

-- Classificação inicial para categorias conhecidas.
UPDATE public.categorias
SET segmento = 'TI'
WHERE segmento IS NULL
  AND nome IN ('Sistemas', 'Suporte', 'Acessos e Permissões', 'Hardware');

UPDATE public.categorias
SET segmento = 'Projetos'
WHERE segmento IS NULL
  AND nome = 'Projetos';

UPDATE public.categorias
SET segmento = 'RH'
WHERE segmento IS NULL
  AND nome = 'RH';

UPDATE public.categorias
SET segmento = 'Financeiro'
WHERE segmento IS NULL
  AND nome = 'Financeiro';

-- Não atribui segmento automaticamente a novas categorias.
-- Aqui apenas protege dados legados ainda sem classificação.
UPDATE public.categorias
SET segmento = 'Outros'
WHERE segmento IS NULL;

ALTER TABLE public.categorias
ALTER COLUMN segmento SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categorias_segmento_texto
ON public.categorias(segmento);
