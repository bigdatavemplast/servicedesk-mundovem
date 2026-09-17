-- ============================================================
-- Padroniza a numeração dos chamados por área/fila
-- Novo padrão: SD-TI-000020, SD-RH-000004, SD-MKT-000002...
-- Mantém a lógica atual por grupo de atendimento.
-- ============================================================

-- A migration anterior criou uma geração global SD-000001.
-- Removemos esse trigger para não interferir na numeração por área.
DROP TRIGGER IF EXISTS trg_numero_chamado_padrao ON public.chamados;
DROP FUNCTION IF EXISTS public.numero_chamado_padrao();

-- Gera o próximo número dentro do grupo/fila do chamado.
-- O lock na linha do grupo evita colisões quando dois chamados
-- da mesma área são criados simultaneamente.
CREATE OR REPLACE FUNCTION public.chamado_numero_por_grupo(p_grupo_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefixo TEXT;
  v_proximo BIGINT;
BEGIN
  IF p_grupo_id IS NULL THEN
    RAISE EXCEPTION 'O grupo de atendimento é obrigatório para gerar o número do chamado.';
  END IF;

  SELECT prefixo
    INTO v_prefixo
  FROM public.grupos_atendimento
  WHERE id = p_grupo_id
    AND ativo = TRUE
  FOR UPDATE;

  IF NOT FOUND OR NULLIF(BTRIM(v_prefixo), '') IS NULL THEN
    RAISE EXCEPTION 'O grupo de atendimento não possui um prefixo válido.';
  END IF;

  SELECT COALESCE(MAX((regexp_match(numero, '([0-9]+)$'))[1]::BIGINT), 0) + 1
    INTO v_proximo
  FROM public.chamados
  WHERE grupo_atendimento_id = p_grupo_id
    AND numero ~ '[0-9]+$';

  RETURN v_prefixo || '-' || LPAD(v_proximo::TEXT, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.chamado_numero_por_grupo(UUID) FROM PUBLIC, anon, authenticated;

-- Mantém a rotina existente de SLA/prazos e altera somente a geração
-- do número para usar o prefixo da fila e contador independente por área.
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
    NEW.numero := public.chamado_numero_por_grupo(NEW.grupo_atendimento_id);
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

-- Atualiza os números históricos para o novo padrão visual,
-- preservando prefixo/área e o número já existente.
UPDATE public.chamados
SET numero = regexp_replace(
  numero,
  '([0-9]+)$',
  LPAD((regexp_match(numero, '([0-9]+)$'))[1], 6, '0')
)
WHERE numero ~ '[0-9]+$'
  AND (regexp_match(numero, '([0-9]+)$'))[1]::BIGINT < 1000000;
