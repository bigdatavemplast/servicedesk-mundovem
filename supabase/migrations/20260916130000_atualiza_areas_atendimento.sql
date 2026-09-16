-- Service Desk - atualiza áreas de atendimento
-- Adiciona as novas áreas e desativa "Outros".

INSERT INTO public.segmentos (nome, ordem, ativo) VALUES
  ('Marketing', 5, TRUE),
  ('Expedição', 6, TRUE),
  ('Comercial', 7, TRUE),
  ('E-commerce', 8, TRUE),
  ('Fábrica', 9, TRUE)
ON CONFLICT (nome) DO UPDATE
SET ativo = TRUE,
    ordem = EXCLUDED.ordem;

UPDATE public.segmentos
SET ativo = FALSE
WHERE nome = 'Outros';
