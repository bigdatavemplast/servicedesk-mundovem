-- ============================================================
-- Seed das categorias/subcategorias das áreas do Service Desk
-- As áreas usadas pela abertura de chamado são os segmentos.
-- ============================================================

INSERT INTO public.segmentos (nome, ordem) VALUES
  ('Comercial', 10),
  ('E-commerce', 20),
  ('Expedição', 30),
  ('Fábrica', 40),
  ('Marketing', 50)
ON CONFLICT (nome) DO UPDATE SET ativo = TRUE;

-- Categorias
INSERT INTO public.categorias (nome, segmento, segmento_id, ativo)
SELECT v.nome, v.segmento, s.id, TRUE
FROM (VALUES
  ('Clientes','Comercial'),('Orçamentos','Comercial'),('Pedidos','Comercial'),('Preços e condições','Comercial'),('Propostas','Comercial'),('Relatórios','Comercial'),
  ('Produtos','E-commerce'),('Pedidos','E-commerce'),('Pagamento','E-commerce'),('Entrega','E-commerce'),('Site','E-commerce'),('Promoções','E-commerce'),('Marketplace','E-commerce'),
  ('Separação de pedidos','Expedição'),('Conferência','Expedição'),('Transporte','Expedição'),('Documentação','Expedição'),('Devoluções','Expedição'),('Ocorrências','Expedição'),
  ('Produção','Fábrica'),('Matéria-prima','Fábrica'),('Qualidade','Fábrica'),('Manutenção','Fábrica'),('Estoque','Fábrica'),('Processos','Fábrica'),
  ('Campanhas','Marketing'),('Materiais','Marketing'),('Conteúdo','Marketing'),('Redes sociais','Marketing'),('Eventos','Marketing'),('Marca','Marketing')
) AS v(nome, segmento)
JOIN public.segmentos s ON s.nome = v.segmento
ON CONFLICT DO NOTHING;

-- Subcategorias
WITH dados(segmento, categoria, subcategoria) AS (
  VALUES
  ('Comercial','Clientes','Cadastro de cliente'),('Comercial','Clientes','Alteração de cadastro'),('Comercial','Clientes','Consulta de cliente'),('Comercial','Clientes','Inativação de cliente'),
  ('Comercial','Orçamentos','Criar orçamento'),('Comercial','Orçamentos','Alterar orçamento'),('Comercial','Orçamentos','Aprovar orçamento'),('Comercial','Orçamentos','Consultar orçamento'),
  ('Comercial','Pedidos','Criar pedido'),('Comercial','Pedidos','Alterar pedido'),('Comercial','Pedidos','Cancelar pedido'),('Comercial','Pedidos','Consultar pedido'),
  ('Comercial','Preços e condições','Consulta de preço'),('Comercial','Preços e condições','Alteração de preço'),('Comercial','Preços e condições','Condição comercial'),
  ('Comercial','Propostas','Criar proposta'),('Comercial','Propostas','Alterar proposta'),('Comercial','Propostas','Aprovar proposta'),
  ('Comercial','Relatórios','Relatório de vendas'),('Comercial','Relatórios','Relatório de clientes'),('Comercial','Relatórios','Relatório de pedidos'),
  ('E-commerce','Produtos','Cadastro de produto'),('E-commerce','Produtos','Alteração de produto'),('E-commerce','Produtos','Preço'),('E-commerce','Produtos','Estoque'),('E-commerce','Produtos','Imagens'),
  ('E-commerce','Pedidos','Pedido não localizado'),('E-commerce','Pedidos','Alteração de pedido'),('E-commerce','Pedidos','Cancelamento'),('E-commerce','Pedidos','Status do pedido'),
  ('E-commerce','Pagamento','Pagamento não aprovado'),('E-commerce','Pagamento','Pagamento pendente'),('E-commerce','Pagamento','Estorno'),('E-commerce','Pagamento','Divergência de pagamento'),
  ('E-commerce','Entrega','Frete'),('E-commerce','Entrega','Prazo de entrega'),('E-commerce','Entrega','Rastreamento'),('E-commerce','Entrega','Problema na entrega'),
  ('E-commerce','Site','Erro no site'),('E-commerce','Site','Alteração de conteúdo'),('E-commerce','Site','Alteração de layout'),('E-commerce','Site','Problema de acesso'),
  ('E-commerce','Promoções','Cadastro de promoção'),('E-commerce','Promoções','Cupom de desconto'),('E-commerce','Promoções','Alteração de promoção'),
  ('E-commerce','Marketplace','Cadastro'),('E-commerce','Marketplace','Integração'),('E-commerce','Marketplace','Pedido'),('E-commerce','Marketplace','Preço'),
  ('Expedição','Separação de pedidos','Solicitação de separação'),('Expedição','Separação de pedidos','Alteração de separação'),('Expedição','Separação de pedidos','Divergência na separação'),
  ('Expedição','Conferência','Conferência de pedido'),('Expedição','Conferência','Divergência de quantidade'),('Expedição','Conferência','Divergência de produto'),
  ('Expedição','Transporte','Solicitação de coleta'),('Expedição','Transporte','Transportadora'),('Expedição','Transporte','Rastreamento'),('Expedição','Transporte','Problema na entrega'),
  ('Expedição','Documentação','Nota fiscal'),('Expedição','Documentação','Romaneio'),('Expedição','Documentação','Documento de transporte'),
  ('Expedição','Devoluções','Solicitação de devolução'),('Expedição','Devoluções','Recebimento de devolução'),('Expedição','Devoluções','Conferência de devolução'),
  ('Expedição','Ocorrências','Atraso'),('Expedição','Ocorrências','Avaria'),('Expedição','Ocorrências','Extravio'),('Expedição','Ocorrências','Divergência'),
  ('Fábrica','Produção','Ordem de produção'),('Fábrica','Produção','Programação'),('Fábrica','Produção','Alteração de produção'),('Fábrica','Produção','Acompanhamento'),
  ('Fábrica','Matéria-prima','Solicitação de material'),('Fábrica','Matéria-prima','Falta de material'),('Fábrica','Matéria-prima','Divergência'),('Fábrica','Matéria-prima','Entrada de material'),
  ('Fábrica','Qualidade','Inspeção'),('Fábrica','Qualidade','Não conformidade'),('Fábrica','Qualidade','Liberação'),('Fábrica','Qualidade','Análise'),
  ('Fábrica','Manutenção','Manutenção preventiva'),('Fábrica','Manutenção','Manutenção corretiva'),('Fábrica','Manutenção','Falha de equipamento'),('Fábrica','Manutenção','Solicitação de manutenção'),
  ('Fábrica','Estoque','Consulta de estoque'),('Fábrica','Estoque','Movimentação'),('Fábrica','Estoque','Inventário'),('Fábrica','Estoque','Divergência de estoque'),
  ('Fábrica','Processos','Alteração de processo'),('Fábrica','Processos','Melhoria de processo'),('Fábrica','Processos','Padronização'),
  ('Marketing','Campanhas','Criação de campanha'),('Marketing','Campanhas','Alteração de campanha'),('Marketing','Campanhas','Divulgação'),
  ('Marketing','Materiais','Arte'),('Marketing','Materiais','Banner'),('Marketing','Materiais','Catálogo'),('Marketing','Materiais','Apresentação'),
  ('Marketing','Conteúdo','Criação de conteúdo'),('Marketing','Conteúdo','Revisão'),('Marketing','Conteúdo','Publicação'),
  ('Marketing','Redes sociais','Post'),('Marketing','Redes sociais','Stories'),('Marketing','Redes sociais','Vídeo'),('Marketing','Redes sociais','Calendário de conteúdo'),
  ('Marketing','Eventos','Planejamento'),('Marketing','Eventos','Divulgação'),('Marketing','Eventos','Material para evento'),
  ('Marketing','Marca','Identidade visual'),('Marketing','Marca','Material institucional'),('Marketing','Marca','Aplicação da marca')
)
INSERT INTO public.subcategorias (categoria_id, nome, ativo)
SELECT c.id, d.subcategoria, TRUE
FROM dados d
JOIN public.categorias c ON c.nome = d.categoria
JOIN public.segmentos s ON s.id = c.segmento_id AND s.nome = d.segmento
WHERE NOT EXISTS (
  SELECT 1 FROM public.subcategorias x WHERE x.categoria_id = c.id AND x.nome = d.subcategoria
);

-- Compatibilidade com a coluna texto usada pela classificação antiga.
UPDATE public.categorias c
SET segmento = s.nome
FROM public.segmentos s
WHERE c.segmento_id = s.id
  AND s.nome IN ('Comercial','E-commerce','Expedição','Fábrica','Marketing');
