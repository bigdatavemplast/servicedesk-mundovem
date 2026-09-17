-- ============================================================
-- Catálogo - exemplos por área operacional
-- RH, Projetos, E-commerce, Marketing, Fábrica, Expedição e Financeiro
-- ============================================================

-- 1) Segmentos adicionais solicitados.
INSERT INTO public.segmentos (nome, ativo, ordem)
VALUES
  ('E-commerce', TRUE, 5),
  ('Marketing', TRUE, 6),
  ('Fábrica', TRUE, 7),
  ('Expedição', TRUE, 8)
ON CONFLICT (nome) DO UPDATE
SET ativo = TRUE;

-- 2) Categorias para as áreas que ainda não possuíam classificação própria.
INSERT INTO public.categorias (nome, descricao, segmento_id, ativo, ordem)
SELECT v.nome, v.descricao, s.id, TRUE, v.ordem
FROM (VALUES
  ('E-commerce', 'Produtos, conteúdo e operação da loja virtual.', 'E-commerce', 1),
  ('Marketing', 'Campanhas, materiais e comunicação.', 'Marketing', 1),
  ('Fábrica', 'Produção, máquinas e operação fabril.', 'Fábrica', 1),
  ('Expedição', 'Pedidos, separação, embalagem e envio.', 'Expedição', 1)
) AS v(nome, descricao, segmento_nome, ordem)
JOIN public.segmentos s ON s.nome = v.segmento_nome
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias c
  WHERE c.segmento_id = s.id AND lower(c.nome) = lower(v.nome)
);

-- Categorias de RH, Projetos e Financeiro já existem no modelo base.
-- Garante apenas o vínculo correto ao respectivo segmento.
UPDATE public.categorias c
SET segmento_id = s.id
FROM public.segmentos s
WHERE (lower(c.nome) = 'rh' AND s.nome = 'RH')
   OR (lower(c.nome) = 'projetos' AND s.nome = 'Projetos')
   OR (lower(c.nome) = 'financeiro' AND s.nome = 'Financeiro');

-- 3) Subcategorias necessárias para os exemplos.
INSERT INTO public.subcategorias (categoria_id, nome, descricao, ativo, ordem)
SELECT c.id, v.subcategoria, v.descricao, TRUE, 1
FROM (VALUES
  ('E-commerce', 'Produto no site', 'Disponibilidade, cadastro ou exibição de produto.'),
  ('Marketing', 'Campanha', 'Solicitações relacionadas a campanhas e materiais.'),
  ('Fábrica', 'Produção', 'Ocorrências e solicitações ligadas à produção.'),
  ('Expedição', 'Pedidos e envio', 'Separação, embalagem e despacho de pedidos.')
) AS v(categoria, subcategoria, descricao)
JOIN public.categorias c ON lower(c.nome) = lower(v.categoria)
JOIN public.segmentos s ON s.id = c.segmento_id
WHERE s.nome IN ('E-commerce', 'Marketing', 'Fábrica', 'Expedição')
  AND NOT EXISTS (
    SELECT 1 FROM public.subcategorias sc
    WHERE sc.categoria_id = c.id AND lower(sc.nome) = lower(v.subcategoria)
  );

-- Exemplos já existentes no catálogo de RH/Projetos/Financeiro recebem
-- subcategorias existentes quando disponíveis.
-- Cria somente o que faltar, sem duplicar a estrutura atual.
INSERT INTO public.subcategorias (categoria_id, nome, descricao, ativo, ordem)
SELECT c.id, v.subcategoria, v.descricao, TRUE, 1
FROM (VALUES
  ('RH', 'Férias', 'Solicitações relacionadas a férias.'),
  ('Projetos', 'Novo Projeto', 'Abertura e estruturação de novos projetos.'),
  ('Financeiro', 'Pagamento', 'Dúvidas e solicitações relacionadas a pagamentos.')
) AS v(categoria, subcategoria, descricao)
JOIN public.categorias c ON lower(c.nome) = lower(v.categoria)
WHERE NOT EXISTS (
  SELECT 1 FROM public.subcategorias sc
  WHERE sc.categoria_id = c.id AND lower(sc.nome) = lower(v.subcategoria)
);

-- 4) Garante uma fila operacional para os novos segmentos.
DO $$
DECLARE
  r RECORD;
  v_grupo UUID;
BEGIN
  FOR r IN
    SELECT id, nome
    FROM public.segmentos
    WHERE ativo = TRUE
      AND nome IN ('E-commerce', 'Marketing', 'Fábrica', 'Expedição')
  LOOP
    SELECT g.id INTO v_grupo
    FROM public.grupos_atendimento g
    WHERE g.segmento_id = r.id
    ORDER BY g.ordem, g.criado_em
    LIMIT 1;

    IF v_grupo IS NULL THEN
      INSERT INTO public.grupos_atendimento (segmento_id, nome, descricao, ativo, ordem)
      VALUES (r.id, r.nome, 'Fila operacional do segmento ' || r.nome, TRUE, 1)
      RETURNING id INTO v_grupo;
    END IF;
  END LOOP;
END $$;

UPDATE public.grupos_atendimento g
SET prefixo = CASE s.nome
  WHEN 'E-commerce' THEN 'SD-ECOM'
  WHEN 'Marketing' THEN 'SD-MKT'
  WHEN 'Fábrica' THEN 'SD-FAB'
  WHEN 'Expedição' THEN 'SD-EXP'
  ELSE g.prefixo
END
FROM public.segmentos s
WHERE g.segmento_id = s.id
  AND g.ativo = TRUE
  AND s.nome IN ('E-commerce', 'Marketing', 'Fábrica', 'Expedição');

-- 5) Itens publicados: um exemplo funcional para cada área solicitada.
-- A inserção é idempotente para não duplicar os exemplos em novos deploys.
INSERT INTO public.itsm_itens_catalogo (
  nome, descricao, instrucoes,
  segmento_id, categoria_id, subcategoria_id, tipo_chamado_id,
  ativo, publicado, requer_aprovacao, campos_formulario, ordem
)
SELECT
  v.item_nome,
  v.descricao,
  v.instrucoes,
  s.id,
  c.id,
  sc.id,
  t.id,
  TRUE,
  TRUE,
  FALSE,
  '{}'::jsonb,
  v.ordem
FROM (VALUES
  ('RH', 'RH', 'Férias', 'Exemplo: Solicitar férias', 'Solicitação de férias pelo colaborador.', 'Informe o período desejado e observações relevantes.', 'Solicitação', 1),
  ('Projetos', 'Projetos', 'Novo Projeto', 'Exemplo: Abrir novo projeto', 'Solicitação de abertura e estruturação de um novo projeto.', 'Informe objetivo, área envolvida, prazo esperado e responsável.', 'Projeto', 2),
  ('E-commerce', 'E-commerce', 'Produto no site', 'Exemplo: Produto não aparece no site', 'Produto cadastrado que não está sendo exibido na loja virtual.', 'Informe o produto, código/SKU e onde deveria aparecer.', 'Incidente', 3),
  ('Marketing', 'Marketing', 'Campanha', 'Exemplo: Criar material para campanha', 'Solicitação de material para uma campanha de marketing.', 'Informe campanha, formato, público e prazo desejado.', 'Solicitação', 4),
  ('Fábrica', 'Fábrica', 'Produção', 'Exemplo: Máquina com problema na produção', 'Registro de problema que impacta a operação da produção.', 'Informe a máquina/equipamento, setor e o problema observado.', 'Incidente', 5),
  ('Expedição', 'Expedição', 'Pedidos e envio', 'Exemplo: Pedido aguardando envio', 'Solicitação para verificar um pedido que ainda não foi enviado.', 'Informe o número do pedido e a situação esperada.', 'Solicitação', 6),
  ('Financeiro', 'Financeiro', 'Pagamento', 'Exemplo: Dúvida sobre pagamento', 'Dúvida ou solicitação relacionada a um pagamento.', 'Informe fornecedor, documento ou número do pedido e o que precisa ser verificado.', 'Dúvida', 7)
) AS v(segmento_nome, categoria_nome, subcategoria_nome, item_nome, descricao, instrucoes, tipo_nome, ordem)
JOIN public.segmentos s ON s.nome = v.segmento_nome AND s.ativo = TRUE
JOIN public.categorias c ON c.segmento_id = s.id AND lower(c.nome) = lower(v.categoria_nome) AND c.ativo = TRUE
JOIN public.subcategorias sc ON sc.categoria_id = c.id AND lower(sc.nome) = lower(v.subcategoria_nome) AND sc.ativo = TRUE
JOIN public.tipos_chamado t ON lower(t.nome) = lower(v.tipo_nome) AND t.ativo = TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.itsm_itens_catalogo i
  WHERE lower(i.nome) = lower(v.item_nome)
    AND i.segmento_id = s.id
);
