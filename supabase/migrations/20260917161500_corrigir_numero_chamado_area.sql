-- ============================================================
-- Correção da numeração dos chamados por área
-- Padrão: SD-[AREA]-000001
-- A sequência numérica permanece GLOBAL e nunca se repete.
-- ============================================================

CREATE OR REPLACE FUNCTION public.codigo_area_chamado(p_segmento_id UUID)
RETURNS VARCHAR
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE LOWER(BTRIM(s.nome))
    WHEN 'financeiro' THEN 'FIN'
    WHEN 'projetos' THEN 'PROJ'
    WHEN 'e-commerce' THEN 'ECOM'
    WHEN 'ecommerce' THEN 'ECOM'
    WHEN 'ti' THEN 'TI'
    WHEN 'expedição' THEN 'EXP'
    WHEN 'expedicao' THEN 'EXP'
    WHEN 'rh' THEN 'RH'
    WHEN 'comercial' THEN 'COM'
    WHEN 'fábrica' THEN 'FAB'
    WHEN 'fabrica' THEN 'FAB'
    WHEN 'marketing' THEN 'MKT'
    ELSE 'SD'
  END
  FROM public.segmentos s
  WHERE s.id = p_segmento_id;
$$;

REVOKE ALL ON FUNCTION public.codigo_area_chamado(UUID)
FROM PUBLIC, anon, authenticated;

-- A função passa a ser a única rotina responsável por montar o número.
DROP FUNCTION IF EXISTS public.chamado_numero_global();

CREATE OR REPLACE FUNCTION public.chamado_numero_global(p_segmento_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_area VARCHAR;
BEGIN
  v_area := COALESCE(public.codigo_area_chamado(p_segmento_id), 'SD');

  RETURN 'SD-' || v_area || '-' ||
    LPAD(nextval('public.chamados_numero_seq')::TEXT, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.chamado_numero_global(UUID)
FROM PUBLIC, anon, authenticated;

-- Mantém a geração automática e a rotina existente de SLA/prazos.
CREATE OR REPLACE FUNCTION public.chamado_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla public.slas%ROWTYPE;
BEGIN
  IF NEW.numero IS NULL OR BTRIM(NEW.numero) = '' THEN
    NEW.numero := public.chamado_numero_global(NEW.segmento_id);
  END IF;

  SELECT * INTO v_sla
  FROM public.slas
  WHERE prioridade = NEW.prioridade;

  IF FOUND THEN
    NEW.sla_id := v_sla.id;
    NEW.prazo_resposta := COALESCE(
      NEW.prazo_resposta,
      NEW.aberto_em + (v_sla.tempo_resposta_h || ' hours')::interval
    );
    NEW.prazo_resolucao := COALESCE(
      NEW.prazo_resolucao,
      NEW.aberto_em + (v_sla.tempo_resolucao_h || ' hours')::interval
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chamado_before_insert ON public.chamados;
CREATE TRIGGER trg_chamado_before_insert
BEFORE INSERT ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.chamado_before_insert();

REVOKE ALL ON FUNCTION public.chamado_before_insert()
FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Corrige chamados antigos no formato SD-000001.
-- Primeiro usa um valor temporário para não colidir com a
-- constraint UNIQUE de numero durante a conversão.
-- ============================================================

UPDATE public.chamados
SET numero = 'TMP-' || numero
WHERE numero ~ '^SD-[0-9]+$';

WITH existentes AS (
  SELECT
    c.id,
    c.segmento_id,
    substring(c.numero FROM '^TMP-SD-([0-9]+)$')::BIGINT AS sequencia
  FROM public.chamados c
  WHERE c.numero ~ '^TMP-SD-[0-9]+$'
)
UPDATE public.chamados c
SET numero = 'SD-' || COALESCE(public.codigo_area_chamado(e.segmento_id), 'SD') || '-' ||
             LPAD(e.sequencia::TEXT, 6, '0')
FROM existentes e
WHERE c.id = e.id;

-- Garante que a próxima sequência continue após o maior número já usado.
SELECT setval(
  'public.chamados_numero_seq',
  COALESCE(
    (
      SELECT MAX((regexp_match(numero, '-([0-9]+)$'))[1]::BIGINT)
      FROM public.chamados
      WHERE numero ~ '^SD-[A-Z]+-[0-9]+$'
    ),
    0
  ),
  true
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_chamados_numero_unico
ON public.chamados (numero);
