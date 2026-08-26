-- Fase 5: garantir no banco os campos consultados pelo dashboard de Gestão.
-- Idempotente para ambientes onde a migration original não foi aplicada.
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS primeira_chamada_resolvida BOOLEAN,
  ADD COLUMN IF NOT EXISTS escalonado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS atendimento_abandonado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tempo_atendimento_minutos NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS custo_atendimento NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_chamados_fase5_escalonado ON public.chamados(escalonado);
CREATE INDEX IF NOT EXISTS idx_chamados_fase5_abandonado ON public.chamados(atendimento_abandonado);

CREATE TABLE IF NOT EXISTS public.gestao_capacidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  grupo_atendimento_id UUID REFERENCES public.grupos_atendimento(id) ON DELETE CASCADE,
  horas_disponiveis_semana NUMERIC(8,2) NOT NULL DEFAULT 40,
  custo_hora NUMERIC(12,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (horas_disponiveis_semana >= 0),
  CHECK (custo_hora >= 0),
  CHECK (usuario_id IS NOT NULL OR grupo_atendimento_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.avaliacoes_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL UNIQUE REFERENCES public.chamados(id) ON DELETE CASCADE,
  nota SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pesquisas_satisfacao_equipe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nota SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, periodo_inicio, periodo_fim)
);

ALTER TABLE public.gestao_capacidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes_atendimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesquisas_satisfacao_equipe ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.gestao_capacidade, public.avaliacoes_atendimento, public.pesquisas_satisfacao_equipe TO authenticated;
