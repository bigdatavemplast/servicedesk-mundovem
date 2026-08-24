-- ============================================================
-- Service Desk - Reabertura de chamados
-- ============================================================

-- O status reaberto precisa existir no enum utilizado pela tabela.
ALTER TYPE public.status_chamado
  ADD VALUE IF NOT EXISTS 'reaberto';

-- Dados da reabertura.
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS reaberto_em TIMESTAMPTZ;

-- Controle de pausa do SLA.
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS sla_pausado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_chamados_reaberto_em
  ON public.chamados(reaberto_em);

-- ============================================================
-- RLS
--
-- A política antiga permite que o solicitante atualize somente
-- chamados em aberto ou aguardando usuário. Portanto, quando o
-- chamado está fechado, o UPDATE é filtrado pelo RLS e o Supabase
-- retorna zero linhas.
--
-- Esta política permite exclusivamente a transição:
--   fechado -> reaberto
-- para o próprio solicitante.
-- ============================================================

DROP POLICY IF EXISTS "Solicitante reabre chamados fechados"
  ON public.chamados;

CREATE POLICY "Solicitante reabre chamados fechados"
ON public.chamados
FOR UPDATE
TO authenticated
USING (
  auth.uid() = solicitante_id
  AND status = 'fechado'
)
WITH CHECK (
  auth.uid() = solicitante_id
  AND status = 'reaberto'
);

COMMENT ON COLUMN public.chamados.reaberto_em
  IS 'Data e hora em que o solicitante reabriu o chamado.';

COMMENT ON COLUMN public.chamados.sla_pausado
  IS 'Indica se a contagem do SLA está pausada.';
