-- Regra de teste: TI / Hardware / Notebook -> Leonardo Neto
-- A regra só será aplicada enquanto Leonardo estiver ativo no grupo TI.
--
-- Os IDs abaixo pertencem aos dados existentes no ambiente original. Em uma
-- instalação limpa eles podem não existir (Auth/seed de dados são separados
-- das migrations), portanto a regra é criada somente quando todos os registros
-- necessários estiverem presentes.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.grupos_atendimento
    WHERE id = 'ea4acec6-7769-4d3e-93ce-97b09666e1a4'
  )
  AND EXISTS (
    SELECT 1 FROM public.categorias
    WHERE id = 'bbb8b0fe-e230-42af-8fee-79aa626c73bb'
  )
  AND EXISTS (
    SELECT 1 FROM public.subcategorias
    WHERE id = 'efbf66ee-1ebc-42dd-ad90-bb159764c95e'
  )
  AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = 'f8a5bd18-b4b1-4de9-a3b6-84af541ef7fa'
  ) THEN
    INSERT INTO public.regras_atribuicao_automatica (
      nome,
      grupo_atendimento_id,
      categoria_id,
      subcategoria_id,
      atendente_id,
      prioridade,
      ativo
    )
    VALUES (
      'TI - Hardware - Notebook -> Leonardo Neto',
      'ea4acec6-7769-4d3e-93ce-97b09666e1a4',
      'bbb8b0fe-e230-42af-8fee-79aa626c73bb',
      'efbf66ee-1ebc-42dd-ad90-bb159764c95e',
      'f8a5bd18-b4b1-4de9-a3b6-84af541ef7fa',
      10,
      TRUE
    )
    ON CONFLICT DO NOTHING;
  END IF;
END
$$;
