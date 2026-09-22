-- ============================================================
-- Numeração global e única dos chamados
-- Padrão: SD-000001, SD-000002, SD-000003...
-- Um número nunca é repetido entre áreas ou filas.
-- ============================================================

-- Remove gerações anteriores de número que possam existir.
DROP TRIGGER IF EXISTS trg_numero_chamado_padrao ON public.chamados;
DROP TRIGGER IF EXISTS trg_gerar_numero_chamado ON public.chamados;
DROP FUNCTION IF EXISTS public.numero_chamado_padrao();
DROP FUNCTION IF EXISTS public.gerar_numero_chamado();
DROP FUNCTION IF EXISTS public.chamado_numero_por_grupo(UUID);

-- Sequência global do Service Desk.
CREATE SEQUENCE IF NOT EXISTS public.chamados_numero_seq
  AS BIGINT
  MINVALUE 1
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

-- Reserva o próximo número de forma atômica.
-- A sequence garante que duas criações simultâneas nunca recebam o mesmo número.
CREATE OR REPLACE FUNCTION public.chamado_numero_global()
RETURNS VARCHAR
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'SD-' || LPAD(nextval('public.chamados_numero_seq')::TEXT, 6, '0');
$$;

REVOKE ALL ON FUNCTION public.chamado_numero_global() FROM PUBLIC, anon, authenticated;

-- Garante que o número seja gerado automaticamente quando não informado.
-- Mantém a rotina atual de SLA/prazos.
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
    NEW.numero := public.chamado_numero_global();
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

REVOKE ALL ON FUNCTION public.chamado_before_insert() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Migração dos números existentes para uma sequência global.
-- Primeiro usamos valores temporários para não colidir com a
-- constraint UNIQUE de numero durante a troca.
-- A ordem por aberto_em/id torna a numeração determinística.
-- ------------------------------------------------------------
UPDATE public.chamados
SET numero = 'TMP-' || REPLACE(SUBSTRING(id::TEXT FROM 1 FOR 16), '-', '')
WHERE numero IS NOT NULL;

WITH numerados AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY aberto_em ASC NULLS LAST, id ASC) AS novo_numero
  FROM public.chamados
)
UPDATE public.chamados c
SET numero = 'SD-' || LPAD(n.novo_numero::TEXT, 6, '0')
FROM numerados n
WHERE c.id = n.id;

-- Faz a sequence continuar exatamente após o maior número existente.
SELECT setval(
  'public.chamados_numero_seq',
  COALESCE(s.max_numero, 1),
  s.max_numero IS NOT NULL
)
FROM (
  SELECT MAX((regexp_match(numero, '^SD-([0-9]+)' || chr(36)))[1]::BIGINT) AS max_numero
  FROM public.chamados
  WHERE numero ~ ('^SD-[0-9]+' || chr(36))
) AS s;

-- Proteção adicional: o campo numero já é UNIQUE, mas esta constraint
-- documenta explicitamente a regra de unicidade no banco.
CREATE UNIQUE INDEX IF NOT EXISTS ux_chamados_numero_unico
  ON public.chamados (numero);
))[1]::BIGINT) AS max_numero
  FROM public.chamados
  WHERE numero ~ '^SD-[0-9]+

-- Proteção adicional: o campo numero já é UNIQUE, mas esta constraint
-- documenta explicitamente a regra de unicidade no banco.
CREATE UNIQUE INDEX IF NOT EXISTS ux_chamados_numero_unico
  ON public.chamados (numero);

) AS s;

-- Proteção adicional: o campo numero já é UNIQUE, mas esta constraint
-- documenta explicitamente a regra de unicidade no banco.
CREATE UNIQUE INDEX IF NOT EXISTS ux_chamados_numero_unico
  ON public.chamados (numero);
