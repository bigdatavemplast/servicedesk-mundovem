-- Identifica o papel do usuário no momento em que cada evento do chamado foi registrado.
ALTER TABLE public.historico_chamado
  ADD COLUMN IF NOT EXISTS ator_role VARCHAR(20);

ALTER TABLE public.historico_chamado
  DROP CONSTRAINT IF EXISTS historico_chamado_ator_role_check;

ALTER TABLE public.historico_chamado
  ADD CONSTRAINT historico_chamado_ator_role_check
  CHECK (ator_role IS NULL OR ator_role IN ('colaborador', 'atendente', 'gestor', 'admin'));
