-- ============================================================
-- Correção: numeração dos chamados por fila/segmento
-- Regra: SD-TI-01, SD-RH-01, SD-FIN-01...
-- Cada fila mantém sua própria sequência.
--
-- Motivo:
-- A migration anterior já criou prefixo + sequência por fila,
-- porém o schema legado também possuía lógica de numeração SD-XXXXX.
-- Quando essa lógica executa antes da nova função, o número deixa
-- de estar vazio e a nova função não o substitui.
-- ============================================================

-- 1) Garante os prefixos oficiais das filas existentes.
UPDATE public.grupos_atendimento g
SET prefixo = CASE
  WHEN lower(s.nome) = 'ti' THEN 'SD-TI'
  WHEN lower(s.nome) = 'rh' THEN 'SD-RH'
  WHEN lower(s.nome) = 'financeiro' THEN 'SD-FIN'
  WHEN lower(s.nome) = 'projetos' THEN 'SD-PROJ'
  WHEN lower(s.nome) = 'outros' THEN 'SD-OUT'
  ELSE 'SD-' || upper(regexp_replace(unaccent(s.nome), '[^A-Za-z0-9]+', '', 'g'))
END
FROM public.segmentos s
WHERE g.segmento_id = s.id;

-- 2) Recria a função de numeração para também reconhecer o número
-- legado SD-XXXXX. Assim, independentemente da ordem dos triggers,
-- o número final de um novo chamado será o da fila correspondente.
CREATE OR REPLACE FUNCTION public.chamado_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla public.slas%ROWTYPE;
  v_grupo public.grupos_atendimento%ROWTYPE;
  v_numero BIGINT;
BEGIN
  IF NEW.grupo_atendimento_id IS NULL THEN
    RAISE EXCEPTION 'Chamado precisa possuir uma fila do segmento antes da numeracao';
  END IF;

  SELECT * INTO v_grupo
  FROM public.grupos_atendimento
  WHERE id = NEW.grupo_atendimento_id
    AND ativo = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fila invalida ou inativa';
  END IF;

  IF NEW.segmento_id IS DISTINCT FROM v_grupo.segmento_id THEN
    RAISE EXCEPTION 'A fila deve pertencer ao mesmo segmento do chamado';
  END IF;

  -- Aceita vazio e também o formato legado SD-XXXXX.
  -- Se outro trigger legado preencher o número antes desta função,
  -- ele será substituído pelo prefixo da fila.
  IF NEW.numero IS NULL
     OR NEW.numero = ''
     OR NEW.numero ~ '^SD-[0-9]+$'
  THEN
    v_numero := public.proximo_numero_fila(NEW.grupo_atendimento_id);
    NEW.numero := v_grupo.prefixo || '-' || LPAD(v_numero::TEXT, 2, '0');
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

-- 3) Garante que o trigger oficial seja o responsável pela geração.
DROP TRIGGER IF EXISTS trg_chamado_before_insert ON public.chamados;
CREATE TRIGGER trg_chamado_before_insert
BEFORE INSERT ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.chamado_before_insert();

REVOKE ALL ON FUNCTION public.chamado_before_insert() FROM PUBLIC, anon, authenticated;

-- 4) Garante que todas as filas existentes tenham sequência inicial.
INSERT INTO public.grupo_sequencias (grupo_id, proximo_numero)
SELECT g.id, 1
FROM public.grupos_atendimento g
WHERE g.ativo = TRUE
ON CONFLICT (grupo_id) DO NOTHING;
