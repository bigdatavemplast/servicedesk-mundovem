-- ============================================================
-- Service Desk - Reabertura de chamados
-- Permite ao solicitante reabrir um chamado fechado dentro de 48h.
-- ============================================================

-- 1) O status reaberto precisa existir no enum real do banco.
ALTER TYPE public.status_chamado
  ADD VALUE IF NOT EXISTS 'reaberto';

-- 2) Guarda o momento em que o chamado foi reaberto.
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS reaberto_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chamados_reaberto_em
  ON public.chamados(reaberto_em);

-- 3) Permite ao solicitante consultar o próprio registro de reabertura.
-- A política existente de chamados já controla o acesso ao chamado;
-- não é necessário criar uma política adicional para a nova coluna.
