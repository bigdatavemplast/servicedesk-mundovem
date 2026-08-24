-- Reafirma o motor de calendário porque chamados novos ainda estavam
-- recebendo prazo_resolucao em horas corridas.
-- O vencimento operacional deve respeitar o calendário da regra.

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
  WHERE r.id = NEW.sla_regra_id
    AND r.ativo = TRUE;

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

-- Corrige chamados existentes que receberam prazo corrido.
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
  AND r.ativo = TRUE
  AND r.calendario_id IS NOT NULL;

-- Projeto permanece sem SLA operacional.
UPDATE public.chamados
SET prazo_resolucao = NULL,
    sla_regra_id = NULL,
    sla_tempo_resposta_segundos = NULL,
    sla_tempo_resolucao_segundos = NULL
WHERE tipo_fluxo = 'projeto';
