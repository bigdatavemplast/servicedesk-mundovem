-- ============================================================
-- Service Desk - áreas de atendimento atualizadas
-- Remove "Outros" da seleção e adiciona as áreas operacionais.
-- ============================================================

INSERT INTO public.segmentos (nome, ordem, ativo) VALUES
  ('TI', 1, TRUE),
  ('RH', 2, TRUE),
  ('Projetos', 3, TRUE),
  ('Financeiro', 4, TRUE),
  ('Marketing', 5, TRUE),
  ('Expedição', 6, TRUE),
  ('Comercial', 7, TRUE),
  ('E-commerce', 8, TRUE),
  ('Fábrica', 9, TRUE)
ON CONFLICT (nome) DO UPDATE
SET ativo = EXCLUDED.ativo,
    ordem = EXCLUDED.ordem;

UPDATE public.segmentos
SET ativo = FALSE
WHERE nome = 'Outros';
