-- Fase 2 - SLA / Calendário de horas úteis
-- O prazo do SLA deixa de ser calculado como NOW() + segundos corridos.
-- O vencimento passa a respeitar os intervalos configurados em
-- sla_calendario_horarios. Calendário sem horários = 24x7.

CREATE OR REPLACE FUNCTION public.sla_calcular_prazo_util(
  p_inicio TIMESTAMPTZ,
  p_segundos BIGINT,
  p_calendario_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tz TEXT;
  v_cursor TIMESTAMPTZ := p_inicio;
  v_restante BIGINT := GREATEST(COALESCE(p_segundos, 0), 0);
  v_dia DATE;
  v_dow SMALLINT;
  v_inicio TIME;
  v_fim TIME;
  v_inicio_intervalo TIMESTAMPTZ;
  v_fim_intervalo TIMESTAMPTZ;
  v_disponivel BIGINT;
  v_tem_horario BOOLEAN;
BEGIN
  IF p_inicio IS NULL OR p_segundos IS NULL OR p_calendario_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT timezone INTO v_tz
  FROM public.sla_calendarios
  WHERE id = p_calendario_id;

  v_tz := COALESCE(v_tz, 'America/Sao_Paulo');

  -- Calendário sem intervalos configurados representa operação 24x7.
  SELECT EXISTS (
    SELECT 1
    FROM public.sla_calendario_horarios
    WHERE calendario_id = p_calendario_id
      AND ativo = TRUE
  ) INTO v_tem_horario;

  IF NOT v_tem_horario THEN
    RETURN p_inicio + make_interval(secs => v_restante);
  END IF;

  IF v_restante = 0 THEN
    RETURN p_inicio;
  END IF;

  -- Percorre os dias e consome somente os intervalos de atendimento.
  -- O limite evita loop infinito em configuração inválida de calendário.
  FOR i IN 0..3700 LOOP
    v_dia := (v_cursor AT TIME ZONE v_tz)::DATE;
    v_dow := EXTRACT(DOW FROM v_dia)::SMALLINT;

    FOR v_inicio, v_fim IN
      SELECT h.hora_inicio, h.hora_fim
      FROM public.sla_calendario_horarios h
      WHERE h.calendario_id = p_calendario_id
        AND h.dia_semana = v_dow
        AND h.ativo = TRUE
      ORDER BY h.hora_inicio
    LOOP
      v_inicio_intervalo := (v_dia + v_inicio) AT TIME ZONE v_tz;
      v_fim_intervalo := (v_dia + v_fim) AT TIME ZONE v_tz;

      -- Ainda não chegamos ao intervalo.
      IF v_cursor < v_inicio_intervalo THEN
        v_cursor := v_inicio_intervalo;
      END IF;

      -- Já passou deste intervalo.
      IF v_cursor >= v_fim_intervalo THEN
        CONTINUE;
      END IF;

      v_disponivel := FLOOR(EXTRACT(EPOCH FROM (v_fim_intervalo - v_cursor)))::BIGINT;

      IF v_restante <= v_disponivel THEN
        RETURN v_cursor + make_interval(secs => v_restante);
      END IF;

      v_restante := v_restante - v_disponivel;
      v_cursor := v_fim_intervalo;
    END LOOP;

    -- Próximo dia, preservando o timezone do calendário.
    v_cursor := ((v_dia + 1)::DATE)::TIMESTAMP AT TIME ZONE v_tz;
  END LOOP;

  RAISE EXCEPTION 'Não foi possível calcular o vencimento do SLA no calendário %', p_calendario_id;
END;
$$;

COMMENT ON FUNCTION public.sla_calcular_prazo_util(TIMESTAMPTZ, BIGINT, UUID)
IS 'Calcula vencimento de SLA em horas úteis conforme o calendário configurado; calendário sem horários funciona como 24x7.';

-- Recalcula prazo_resolucao sempre que um chamado receber/trocar uma regra SLA.
CREATE OR REPLACE FUNCTION public.sla_aplicar_prazo_calendario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_calendario_id UUID;
  v_tempo BIGINT;
BEGIN
  IF NEW.sla_regra_id IS NULL
     OR COALESCE(NEW.tipo_fluxo, '') = 'projeto'
     OR NEW.sla_tempo_resolucao_segundos IS NULL THEN
    NEW.prazo_resolucao := NULL;
    RETURN NEW;
  END IF;

  SELECT r.calendario_id, r.tempo_resolucao_segundos
    INTO v_calendario_id, v_tempo
  FROM public.sla_regras r
  WHERE r.id = NEW.sla_regra_id;

  IF v_calendario_id IS NULL OR v_tempo IS NULL THEN
    NEW.prazo_resolucao := NULL;
    RETURN NEW;
  END IF;

  NEW.prazo_resolucao := public.sla_calcular_prazo_util(
    COALESCE(NEW.aberto_em, NOW()),
    v_tempo,
    v_calendario_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chamados_sla_calendario ON public.chamados;
CREATE TRIGGER trg_chamados_sla_calendario
BEFORE INSERT OR UPDATE OF sla_regra_id, sla_tempo_resolucao_segundos, tipo_fluxo, aberto_em
ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.sla_aplicar_prazo_calendario();

-- Corrige os chamados existentes que ainda têm prazo corrido.
UPDATE public.chamados c
SET prazo_resolucao = public.sla_calcular_prazo_util(
  COALESCE(c.aberto_em, c.criado_em, NOW()),
  c.sla_tempo_resolucao_segundos,
  r.calendario_id
)
FROM public.sla_regras r
WHERE c.sla_regra_id = r.id
  AND c.tipo_fluxo <> 'projeto'
  AND c.sla_tempo_resolucao_segundos IS NOT NULL
  AND r.calendario_id IS NOT NULL;

-- Projetos não possuem prazo de SLA operacional.
UPDATE public.chamados
SET prazo_resolucao = NULL,
    sla_regra_id = NULL,
    sla_tempo_resposta_segundos = NULL,
    sla_tempo_resolucao_segundos = NULL
WHERE tipo_fluxo = 'projeto';

GRANT EXECUTE ON FUNCTION public.sla_calcular_prazo_util(TIMESTAMPTZ, BIGINT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sla_aplicar_prazo_calendario() TO service_role;
