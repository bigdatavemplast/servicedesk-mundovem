-- ============================================================
-- Service Desk - Fase 5: métricas operacionais e gestão
-- ============================================================

ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS primeira_resposta_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS primeiro_atendimento_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS primeira_chamada_resolvida BOOLEAN,
  ADD COLUMN IF NOT EXISTS escalonado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalonado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atendimento_abandonado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tempo_atendimento_minutos NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS custo_atendimento NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_chamados_fase5_escalonado ON public.chamados(escalonado);
CREATE INDEX IF NOT EXISTS idx_chamados_fase5_abandonado ON public.chamados(atendimento_abandonado);
CREATE INDEX IF NOT EXISTS idx_chamados_fase5_primeiro_atendimento ON public.chamados(primeiro_atendimento_em);

-- Parâmetros de custo e capacidade por atendente/equipe.
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

CREATE INDEX IF NOT EXISTS idx_gestao_capacidade_usuario ON public.gestao_capacidade(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gestao_capacidade_grupo ON public.gestao_capacidade(grupo_atendimento_id);

ALTER TABLE public.gestao_capacidade ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.gestao_capacidade TO authenticated;
GRANT ALL ON public.gestao_capacidade TO service_role;

DROP POLICY IF EXISTS "Gestão lê capacidade" ON public.gestao_capacidade;
CREATE POLICY "Gestão lê capacidade"
ON public.gestao_capacidade FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['gestor','admin']::public.app_role[]));

DROP POLICY IF EXISTS "Admin gerencia capacidade" ON public.gestao_capacidade;
CREATE POLICY "Admin gerencia capacidade"
ON public.gestao_capacidade FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CSAT pós-atendimento. Uma avaliação por chamado.
CREATE TABLE IF NOT EXISTS public.avaliacoes_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL UNIQUE REFERENCES public.chamados(id) ON DELETE CASCADE,
  nota SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_atendimento_criado ON public.avaliacoes_atendimento(criado_em);
ALTER TABLE public.avaliacoes_atendimento ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.avaliacoes_atendimento TO authenticated;
GRANT ALL ON public.avaliacoes_atendimento TO service_role;

DROP POLICY IF EXISTS "Usuário avalia próprio chamado" ON public.avaliacoes_atendimento;
CREATE POLICY "Usuário avalia próprio chamado"
ON public.avaliacoes_atendimento FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = chamado_id AND c.solicitante_id = auth.uid()
  )
);

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

-- Satisfação interna dos agentes. A gestão enxerga resultados agregados.
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
GRANT ALL ON public.pesquisas_satisfacao_equipe TO service_role;

DROP POLICY IF EXISTS "Agente gerencia própria pesquisa" ON public.pesquisas_satisfacao_equipe;
CREATE POLICY "Agente gerencia própria pesquisa"
ON public.pesquisas_satisfacao_equipe FOR INSERT TO authenticated
WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Agente lê própria pesquisa" ON public.pesquisas_satisfacao_equipe;
CREATE POLICY "Agente lê própria pesquisa"
ON public.pesquisas_satisfacao_equipe FOR SELECT TO authenticated
USING (usuario_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['gestor','admin']::public.app_role[]));

-- Função de apoio para atualização do timestamp da capacidade.
CREATE OR REPLACE FUNCTION public.atualizar_gestao_capacidade_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gestao_capacidade_timestamp ON public.gestao_capacidade;
CREATE TRIGGER trg_gestao_capacidade_timestamp
BEFORE UPDATE ON public.gestao_capacidade
FOR EACH ROW EXECUTE FUNCTION public.atualizar_gestao_capacidade_timestamp();

REVOKE ALL ON FUNCTION public.atualizar_gestao_capacidade_timestamp() FROM PUBLIC, anon, authenticated;
