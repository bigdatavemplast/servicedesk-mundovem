-- ============================================================
-- Gestão Service Desk - alimentação operacional das métricas
-- ============================================================
-- Objetivo: registrar automaticamente os fatos necessários para
-- FCR, TMA, custos, escalonamento e abandono, sem inventar dados.

ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS primeira_resposta_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS primeiro_atendimento_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS primeira_chamada_resolvida BOOLEAN,
  ADD COLUMN IF NOT EXISTS escalonado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalonado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atendimento_abandonado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tempo_atendimento_minutos NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS custo_atendimento NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS public.gestao_atendimento_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  tipo VARCHAR(40) NOT NULL CHECK (tipo IN ('abandono','primeiro_atendimento','primeira_resposta')),
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  motivo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gestao_atendimento_eventos_chamado
  ON public.gestao_atendimento_eventos(chamado_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_chamados_gestao_metricas
  ON public.chamados(segmento_id, criado_em, resolvido_em, status);

ALTER TABLE public.gestao_atendimento_eventos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.gestao_atendimento_eventos TO authenticated;
GRANT ALL ON public.gestao_atendimento_eventos TO service_role;

DROP POLICY IF EXISTS "Gestão lê eventos operacionais" ON public.gestao_atendimento_eventos;
CREATE POLICY "Gestão lê eventos operacionais"
ON public.gestao_atendimento_eventos FOR SELECT TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['gestor','admin']::public.app_role[])
  OR EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = chamado_id AND c.solicitante_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.registrar_evento_gestao_atendimento(
  p_chamado_id UUID,
  p_tipo VARCHAR,
  p_usuario_id UUID DEFAULT NULL,
  p_motivo TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_tipo NOT IN ('abandono','primeiro_atendimento','primeira_resposta') THEN
    RAISE EXCEPTION 'Tipo de evento de gestão inválido: %', p_tipo;
  END IF;

  INSERT INTO public.gestao_atendimento_eventos(chamado_id, tipo, usuario_id, motivo)
  VALUES (p_chamado_id, p_tipo, COALESCE(p_usuario_id, auth.uid()), p_motivo)
  RETURNING id INTO v_id;

  IF p_tipo = 'abandono' THEN
    UPDATE public.chamados
       SET atendimento_abandonado = TRUE
     WHERE id = p_chamado_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_evento_gestao_atendimento(UUID,VARCHAR,UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_evento_gestao_atendimento(UUID,VARCHAR,UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_evento_gestao_atendimento(UUID,VARCHAR,UUID,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.gestao_marcar_primeiro_atendimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.interno, FALSE) = FALSE THEN
    IF NEW.autor_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = NEW.chamado_id AND c.solicitante_id <> NEW.autor_id)
    THEN
      UPDATE public.chamados
         SET primeira_resposta_em = COALESCE(primeira_resposta_em, NEW.criado_em),
             primeiro_atendimento_em = COALESCE(primeiro_atendimento_em, NEW.criado_em)
       WHERE id = NEW.chamado_id;

      INSERT INTO public.gestao_atendimento_eventos(chamado_id, tipo, usuario_id, criado_em)
      SELECT NEW.chamado_id, 'primeira_resposta', NEW.autor_id, NEW.criado_em
      WHERE NOT EXISTS (
        SELECT 1 FROM public.gestao_atendimento_eventos e
        WHERE e.chamado_id = NEW.chamado_id AND e.tipo = 'primeira_resposta'
      );

      INSERT INTO public.gestao_atendimento_eventos(chamado_id, tipo, usuario_id, criado_em)
      SELECT NEW.chamado_id, 'primeiro_atendimento', NEW.autor_id, NEW.criado_em
      WHERE NOT EXISTS (
        SELECT 1 FROM public.gestao_atendimento_eventos e
        WHERE e.chamado_id = NEW.chamado_id AND e.tipo = 'primeiro_atendimento'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gestao_primeiro_atendimento ON public.comentarios_chamado;
CREATE TRIGGER trg_gestao_primeiro_atendimento
AFTER INSERT ON public.comentarios_chamado
FOR EACH ROW EXECUTE FUNCTION public.gestao_marcar_primeiro_atendimento();

CREATE OR REPLACE FUNCTION public.gestao_marcar_escalonamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chamados
     SET escalonado = TRUE,
         escalonado_em = COALESCE(escalonado_em, NEW.executado_em)
   WHERE id = NEW.chamado_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gestao_escalonamento ON public.escalonamentos_chamado;
CREATE TRIGGER trg_gestao_escalonamento
AFTER INSERT ON public.escalonamentos_chamado
FOR EACH ROW EXECUTE FUNCTION public.gestao_marcar_escalonamento();

CREATE OR REPLACE FUNCTION public.gestao_finalizar_metricas_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_minutos NUMERIC(12,2);
  v_pausado BIGINT;
  v_fcr BOOLEAN;
  v_custo_hora NUMERIC(12,2);
BEGIN
  IF NEW.resolvido_em IS NULL THEN
    RETURN NEW;
  END IF;

  v_inicio := COALESCE(NEW.criado_em, NEW.aberto_em);
  IF v_inicio IS NULL THEN
    RETURN NEW;
  END IF;

  v_pausado := GREATEST(0, COALESCE(NEW.sla_tempo_pausado_segundos, 0));
  v_minutos := GREATEST(0, EXTRACT(EPOCH FROM (NEW.resolvido_em - v_inicio)) / 60 - v_pausado / 60.0);

  -- FCR é considerado verdadeiro apenas quando houve primeiro atendimento,
  -- não houve reabertura, escalonamento ou espera externa antes da resolução.
  SELECT
    EXISTS (
      SELECT 1 FROM public.gestao_atendimento_eventos e
      WHERE e.chamado_id = NEW.id AND e.tipo = 'primeiro_atendimento'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.historico_chamado h
      WHERE h.chamado_id = NEW.id AND h.acao = 'chamado_reaberto'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.escalonamentos_chamado e
      WHERE e.chamado_id = NEW.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.historico_chamado h
      WHERE h.chamado_id = NEW.id
        AND h.acao = 'status_alterado'
        AND h.para IN ('aguardando_usuario','aguardando_terceiro')
        AND h.criado_em <= NEW.resolvido_em
    )
  INTO v_fcr;

  IF NEW.tempo_atendimento_minutos IS NULL THEN
    NEW.tempo_atendimento_minutos := v_minutos;
  END IF;
  IF NEW.primeira_chamada_resolvida IS NULL THEN
    NEW.primeira_chamada_resolvida := v_fcr;
  END IF;

  -- Custo automático somente quando existe parâmetro de custo configurado.
  -- Se não houver custo configurado, permanece NULL e a Gestão mostra "—".
  IF NEW.custo_atendimento IS NULL AND NEW.atendente_id IS NOT NULL THEN
    SELECT gc.custo_hora INTO v_custo_hora
    FROM public.gestao_capacidade gc
    WHERE gc.usuario_id = NEW.atendente_id AND gc.ativo = TRUE
    ORDER BY gc.atualizado_em DESC
    LIMIT 1;

    IF v_custo_hora IS NULL AND NEW.grupo_atendimento_id IS NOT NULL THEN
      SELECT gc.custo_hora INTO v_custo_hora
      FROM public.gestao_capacidade gc
      WHERE gc.grupo_atendimento_id = NEW.grupo_atendimento_id AND gc.ativo = TRUE
      ORDER BY gc.atualizado_em DESC
      LIMIT 1;
    END IF;

    IF v_custo_hora IS NOT NULL AND v_custo_hora > 0 THEN
      NEW.custo_atendimento := ROUND((v_minutos / 60.0) * v_custo_hora, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gestao_finalizar_metricas ON public.chamados;
CREATE TRIGGER trg_gestao_finalizar_metricas
BEFORE UPDATE OF resolvido_em, status, atendente_id, custo_atendimento ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.gestao_finalizar_metricas_chamado();

-- A função de abandono é explícita: nenhum chamado é marcado como abandonado
-- apenas por estar aberto ou sem interação.
