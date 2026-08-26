-- Fase 5: reparo idempotente para ambientes onde a migration de métricas
-- já foi aplicada parcialmente ou o cache/RLS ficou inconsistente.

ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS primeira_resposta_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS primeiro_atendimento_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS primeira_chamada_resolvida BOOLEAN,
  ADD COLUMN IF NOT EXISTS escalonado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalonado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atendimento_abandonado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tempo_atendimento_minutos NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS custo_atendimento NUMERIC(12,2);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chamados TO authenticated;

ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Atendente/gestor/admin veem todos chamados" ON public.chamados;
CREATE POLICY "Atendente/gestor/admin veem todos chamados"
ON public.chamados
FOR SELECT TO authenticated
USING (
  public.has_any_role(
    auth.uid(),
    ARRAY['atendente','gestor','admin']::public.app_role[]
  )
);

-- Mantém a leitura de categorias disponível para o dashboard.
GRANT SELECT ON public.categorias TO authenticated;

-- Reforça as tabelas opcionais da gestão de forma idempotente.
CREATE TABLE IF NOT EXISTS public.avaliacoes_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL UNIQUE REFERENCES public.chamados(id) ON DELETE CASCADE,
  nota SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.avaliacoes_atendimento ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.avaliacoes_atendimento TO authenticated;

DROP POLICY IF EXISTS "Usuário lê própria avaliação" ON public.avaliacoes_atendimento;
CREATE POLICY "Usuário lê própria avaliação"
ON public.avaliacoes_atendimento FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = chamado_id
      AND (
        c.solicitante_id = auth.uid()
        OR public.has_any_role(auth.uid(), ARRAY['atendente','gestor','admin']::public.app_role[])
      )
  )
);

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
ALTER TABLE public.gestao_capacidade ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.gestao_capacidade TO authenticated;
DROP POLICY IF EXISTS "Gestão lê capacidade" ON public.gestao_capacidade;
CREATE POLICY "Gestão lê capacidade" ON public.gestao_capacidade
FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['gestor','admin']::public.app_role[]));

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
ALTER TABLE public.pesquisas_satisfacao_equipe ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.pesquisas_satisfacao_equipe TO authenticated;
DROP POLICY IF EXISTS "Agente lê própria pesquisa" ON public.pesquisas_satisfacao_equipe;
CREATE POLICY "Agente lê própria pesquisa" ON public.pesquisas_satisfacao_equipe
FOR SELECT TO authenticated
USING (
  usuario_id = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['gestor','admin']::public.app_role[])
);
