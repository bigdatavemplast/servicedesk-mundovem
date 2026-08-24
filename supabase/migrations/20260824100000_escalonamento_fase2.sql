-- ============================================================
-- Service Desk Vemplast - Fase 2: Escalonamento
-- ============================================================

CREATE TABLE IF NOT EXISTS public.escalonamento_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(120) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  nivel SMALLINT NOT NULL CHECK (nivel >= 1),
  tipo_fluxo VARCHAR(40),
  prioridade public.prioridade_chamado,
  segmento_id UUID REFERENCES public.segmentos(id) ON DELETE CASCADE,
  grupo_atendimento_id UUID REFERENCES public.grupos_atendimento(id) ON DELETE CASCADE,
  minutos_relativos_sla INTEGER NOT NULL DEFAULT 0,
  descricao VARCHAR(255),
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT escalonamento_regras_minutos_chk CHECK (
    minutos_relativos_sla >= -525600 AND minutos_relativos_sla <= 525600
  )
);

CREATE INDEX IF NOT EXISTS idx_escalonamento_regras_busca
  ON public.escalonamento_regras(ativo, nivel, tipo_fluxo, prioridade, segmento_id, grupo_atendimento_id);

GRANT SELECT ON public.escalonamento_regras TO authenticated;
GRANT ALL ON public.escalonamento_regras TO service_role;
ALTER TABLE public.escalonamento_regras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem regras de escalonamento" ON public.escalonamento_regras;
CREATE POLICY "Autenticados leem regras de escalonamento"
ON public.escalonamento_regras FOR SELECT TO authenticated
USING (ativo = TRUE OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin gerencia regras de escalonamento" ON public.escalonamento_regras;
CREATE POLICY "Admin gerencia regras de escalonamento"
ON public.escalonamento_regras FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS escalonamento_nivel SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalonado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chamados_escalonamento
  ON public.chamados(escalonamento_nivel, escalonado_em);

CREATE TABLE IF NOT EXISTS public.escalonamentos_chamado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  regra_id UUID NOT NULL REFERENCES public.escalonamento_regras(id) ON DELETE RESTRICT,
  nivel SMALLINT NOT NULL CHECK (nivel >= 1),
  motivo VARCHAR(30) NOT NULL CHECK (motivo IN ('vencendo', 'vencido', 'pos_vencimento')),
  executado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chamado_id, regra_id)
);

CREATE INDEX IF NOT EXISTS idx_escalonamentos_chamado_data
  ON public.escalonamentos_chamado(chamado_id, executado_em DESC);

GRANT SELECT ON public.escalonamentos_chamado TO authenticated;
GRANT ALL ON public.escalonamentos_chamado TO service_role;
ALTER TABLE public.escalonamentos_chamado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participantes leem escalonamentos" ON public.escalonamentos_chamado;
CREATE POLICY "Participantes leem escalonamentos"
ON public.escalonamentos_chamado FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chamados AS c
    WHERE c.id = escalonamentos_chamado.chamado_id
      AND (
        c.solicitante_id = auth.uid()
        OR public.has_any_role(auth.uid(), ARRAY['atendente','gestor','admin']::public.app_role[])
      )
  )
);

CREATE OR REPLACE FUNCTION public.processar_escalonamentos_sla()
RETURNS TABLE (chamado_id UUID, regra_id UUID, nivel SMALLINT, motivo VARCHAR, executado_em TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regra RECORD;
  v_chamado RECORD;
  v_agora TIMESTAMPTZ := NOW();
  v_motivo VARCHAR(30);
  v_id UUID;
  v_executado TIMESTAMPTZ;
BEGIN
  FOR v_regra IN
    SELECT r.* FROM public.escalonamento_regras AS r
    WHERE r.ativo = TRUE
    ORDER BY r.nivel, r.ordem, r.criado_em
  LOOP
    FOR v_chamado IN
      SELECT c.id, c.prazo_resolucao, c.sla_pausado, c.status, c.tipo_fluxo,
             c.prioridade, c.segmento_id, c.grupo_atendimento_id, c.escalonamento_nivel
      FROM public.chamados AS c
      WHERE c.prazo_resolucao IS NOT NULL
        AND COALESCE(c.sla_pausado, FALSE) = FALSE
        AND c.status NOT IN ('resolvido', 'fechado', 'cancelado')
        AND (v_regra.tipo_fluxo IS NULL OR c.tipo_fluxo = v_regra.tipo_fluxo)
        AND (v_regra.prioridade IS NULL OR c.prioridade = v_regra.prioridade)
        AND (v_regra.segmento_id IS NULL OR c.segmento_id = v_regra.segmento_id)
        AND (v_regra.grupo_atendimento_id IS NULL OR c.grupo_atendimento_id = v_regra.grupo_atendimento_id)
        AND (c.prazo_resolucao - make_interval(mins => v_regra.minutos_relativos_sla)) <= v_agora
        AND v_regra.nivel > COALESCE(c.escalonamento_nivel, 0)
    LOOP
      -- O motivo é determinado pelo nível da regra.
      -- Isso evita classificar o nível 2 como pos_vencimento apenas
      -- porque o prazo já passou alguns minutos.
      CASE v_regra.nivel
        WHEN 1 THEN v_motivo := 'vencendo';
        WHEN 2 THEN v_motivo := 'vencido';
        ELSE v_motivo := 'pos_vencimento';
      END CASE;

      v_id := NULL;
      v_executado := NULL;

      INSERT INTO public.escalonamentos_chamado AS ec (chamado_id, regra_id, nivel, motivo)
      VALUES (v_chamado.id, v_regra.id, v_regra.nivel, v_motivo)
      ON CONFLICT (chamado_id, regra_id) DO NOTHING
      RETURNING ec.id, ec.executado_em INTO v_id, v_executado;

      IF v_id IS NOT NULL THEN
        UPDATE public.chamados AS c
        SET escalonamento_nivel = GREATEST(COALESCE(c.escalonamento_nivel, 0), v_regra.nivel),
            escalonado_em = COALESCE(c.escalonado_em, v_executado)
        WHERE c.id = v_chamado.id;

        chamado_id := v_chamado.id;
        regra_id := v_regra.id;
        nivel := v_regra.nivel;
        motivo := v_motivo;
        executado_em := v_executado;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.processar_escalonamentos_sla() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_escalonamentos_sla() TO authenticated;
GRANT EXECUTE ON FUNCTION public.processar_escalonamentos_sla() TO service_role;

INSERT INTO public.escalonamento_regras (nome, nivel, minutos_relativos_sla, descricao, ordem)
SELECT 'Alerta de SLA vencendo', 1, 60,
       'Marca o chamado para escalonamento quando faltar 1 hora para o SLA de resolução.', 1
WHERE NOT EXISTS (SELECT 1 FROM public.escalonamento_regras WHERE nome = 'Alerta de SLA vencendo');

INSERT INTO public.escalonamento_regras (nome, nivel, minutos_relativos_sla, descricao, ordem)
SELECT 'SLA vencido', 2, 0,
       'Marca o chamado para escalonamento no momento em que o SLA de resolução vence.', 2
WHERE NOT EXISTS (SELECT 1 FROM public.escalonamento_regras WHERE nome = 'SLA vencido');

INSERT INTO public.escalonamento_regras (nome, nivel, minutos_relativos_sla, descricao, ordem)
SELECT 'SLA vencido há 1 hora', 3, -60,
       'Eleva o nível quando o chamado permanece vencido por pelo menos 1 hora.', 3
WHERE NOT EXISTS (SELECT 1 FROM public.escalonamento_regras WHERE nome = 'SLA vencido há 1 hora');
