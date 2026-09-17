-- Adiciona E-commerce e Financeiro ao cadastro de áreas
-- usado na criação e edição de usuários.

INSERT INTO public.areas (nome, ativo)
VALUES
  ('E-commerce', TRUE),
  ('Financeiro', TRUE)
ON CONFLICT (nome) DO UPDATE
SET ativo = TRUE;
