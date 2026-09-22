-- ============================================================
-- Numeração global com identificação da área
-- Padrão: SD-[AREA]-000001
-- A sequência numérica continua sendo GLOBAL e nunca se repete.
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

CREATE OR REPLACE FUNCTION public.chamado_numero_global()
RETURNS VARCHAR
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'SD-' || LPAD(nextval('public.chamados_numero_seq')::TEXT, 6, '0');
$$;

REVOKE ALL ON FUNCTION public.chamado_numero_global()
FROM PUBLIC, anon, authenticated;

-- Gera o número com área e mantém a rotina atual de SLA/prazos.
CREATE OR REPLACE FUNCTION public.chamado_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla public.slas%ROWTYPE;
  v_area VARCHAR;
BEGIN
  IF NEW.numero IS NULL OR BTRIM(NEW.numero) = '' THEN
    v_area := public.codigo_area_chamado(NEW.segmento_id);
    NEW.numero := 'SD-' || COALESCE(v_area, 'SD') || '-' ||
      LPAD(nextval('public.chamados_numero_seq')::TEXT, 6, '0');
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
-- Atualiza os chamados existentes.
-- Mantém exatamente a sequência global já atribuída e apenas
-- insere o código da área no identificador.
-- Ex.: SD-000023 -> SD-ECOM-000023
-- ============================================================

UPDATE public.chamados
SET numero = 'TMP-' || numero
WHERE numero ~ '^SD-[0-9]+$';

WITH numerados AS (
  SELECT
    c.id,
    c.segmento_id,
    regexp_replace(c.numero, '^TMP-SD-', '')::BIGINT AS sequencia
  FROM public.chamados c
  WHERE c.numero ~ '^TMP-SD-[0-9]+$'
)
UPDATE public.chamados c
SET numero = 'SD-' || COALESCE(public.codigo_area_chamado(n.segmento_id), 'SD') || '-' ||
  LPAD(n.sequencia::TEXT, 6, '0')
FROM numerados n
WHERE c.id = n.id;

SELECT setval(
  'public.chamados_numero_seq',
  COALESCE(s.max_numero, 1),
  s.max_numero IS NOT NULL
)
FROM (
  SELECT MAX((regexp_match(numero, '-([0-9]+)' || chr(36)))[1]::BIGINT) AS max_numero
  FROM public.chamados
  WHERE numero ~ ('^SD-[A-Z]+-[0-9]+' || chr(36))
) AS s;

CREATE UNIQUE INDEX IF NOT EXISTS ux_chamados_numero_unico
ON public.chamados (numero);
