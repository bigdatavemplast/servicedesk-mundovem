-- Garante que cada parâmetro de capacidade/custo possa ser associado à área correta.
ALTER TABLE public.gestao_capacidade
  ADD COLUMN IF NOT EXISTS segmento_id UUID REFERENCES public.segmentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gestao_capacidade_segmento
  ON public.gestao_capacidade(segmento_id, ativo);

-- Novos cadastros devem informar o segmento na aplicação. Registros legados
-- permanecem válidos para não quebrar dados existentes.
