-- Service Desk - catálogo inicial das novas áreas
-- Garante que as novas áreas tenham categoria e subcategoria disponíveis
-- na abertura de chamados. Não altera categorias existentes.

DO $$
DECLARE
  v_segmento RECORD;
  v_categoria_id UUID;
BEGIN
  FOR v_segmento IN
    SELECT id, nome
    FROM public.segmentos
    WHERE ativo = TRUE
      AND nome IN ('Marketing', 'Expedição', 'Comercial', 'E-commerce', 'Fábrica')
  LOOP
    -- Cria somente se ainda não existir uma categoria ativa "Geral"
    -- para a área. A categoria recebe o vínculo oficial segmento_id.
    SELECT c.id
      INTO v_categoria_id
    FROM public.categorias c
    WHERE c.segmento_id = v_segmento.id
      AND lower(trim(c.nome)) = 'geral'
    LIMIT 1;

    IF v_categoria_id IS NULL THEN
      INSERT INTO public.categorias (
        nome,
        descricao,
        ativo,
        ordem,
        segmento_id,
        segmento
      )
      VALUES (
        'Geral',
        'Categoria inicial para solicitações da área. Pode ser detalhada pelo administrador posteriormente.',
        TRUE,
        1,
        v_segmento.id,
        v_segmento.nome
      )
      RETURNING id INTO v_categoria_id;
    ELSE
      UPDATE public.categorias
         SET ativo = TRUE,
             segmento_id = v_segmento.id,
             segmento = v_segmento.nome
       WHERE id = v_categoria_id;
    END IF;

    -- Cria a subcategoria inicial somente se ela ainda não existir.
    IF NOT EXISTS (
      SELECT 1
      FROM public.subcategorias sc
      WHERE sc.categoria_id = v_categoria_id
        AND lower(trim(sc.nome)) = 'solicitação geral'
    ) THEN
      INSERT INTO public.subcategorias (
        categoria_id,
        nome,
        descricao,
        ativo,
        ordem
      )
      VALUES (
        v_categoria_id,
        'Solicitação geral',
        'Subcategoria inicial para solicitações da área. Pode ser detalhada pelo administrador posteriormente.',
        TRUE,
        1
      );
    END IF;
  END LOOP;
END $$;
