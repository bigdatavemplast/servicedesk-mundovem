-- ============================================================
-- Correção definitiva da numeração dos chamados por fila
-- Formato oficial: SD-TI-01, SD-RH-01, SD-FIN-01, SD-PROJ-01...
--
-- A numeração legada SD-00001... não deve mais ser gerada para
-- novos chamados. Chamados antigos permanecem com seus números
-- para não quebrar histórico, links ou notificações.
-- ============================================================

-- 1) Garante os prefixos oficiais das filas ativas.
UPDATE public.grupos_atendimento g
SET prefixo = CASE
  WHEN lower(trim(s.nome)) = 'ti' THEN 'SD-TI'
  WHEN lower(trim(s.nome)) = 'rh' THEN 'SD-RH'
  WHEN lower(trim(s.nome)) = 'financeiro' THEN 'SD-FIN'
  WHEN lower(trim(s.nome)) = 'projetos' THEN 'SD-PROJ'
  WHEN lower(trim(s.nome)) = 'outros' THEN 'SD-OUT'
  ELSE 'SD-' || upper(regexp_replace(unaccent(trim(s.nome)), '[^A-Za-z0-9]+', '', 'g'))
END
FROM public.segmentos s
WHERE g.segmento_id = s.id
  AND g.ativo = TRUE;

-- 2) Recalcula a próxima sequência de cada fila com base apenas
--    nos chamados que já usam o novo padrão.
INSERT INTO public.grupo_sequencias (grupo_id, proximo_numero)
SELECT
  g.id,
  COALESCE(MAX(substring(c.numero FROM '([0-9]+)$')::BIGINT), 0) + 1
FROM public.grupos_atendimento g
LEFT JOIN public.chamados c
  ON c.grupo_atendimento_id = g.id
 AND c.numero ~ ('^' || regexp_replace(g.prefixo, '([\\.\\+\\*\\?\\(\\)\\[\\]\\{\\}\\|\\^\\$])', '\\\\1', 'g') || '-[0-9]+$')
WHERE g.ativo = TRUE
GROUP BY g.id
ON CONFLICT (grupo_id) DO UPDATE
SET proximo_numero = GREATEST(
      public.grupo_sequencias.proximo_numero,
      EXCLUDED.proximo_numero
    ),
    atualizado_em = NOW();

-- 3) Remove qualquer trigger antigo com o nome oficial e recria
--    a função de geração. Se algum código legado enviar SD-XXXXX,
--    ele será substituído pelo número da fila.
DROP TRIGGER IF EXISTS trg_chamado_before_insert ON public.chamados;

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

  -- Sempre gera a numeração oficial quando o valor estiver vazio
  -- ou ainda estiver no padrão legado SD-XXXXX.
  IF NEW.numero IS NULL
     OR NEW.numero = ''
     OR NEW.numero ~ '^SD-[0-9]+$'
  THEN
    v_numero := public.proximo_numero_fila(NEW.grupo_atendimento_id);
    NEW.numero := v_grupo.prefixo || '-' || LPAD(v_numero::TEXT, 2, '0');
  END IF;

  -- Mantém a compatibilidade com o SLA legado quando aplicável.
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

CREATE TRIGGER trg_chamado_before_insert
BEFORE INSERT ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.chamado_before_insert();

REVOKE ALL ON FUNCTION public.chamado_before_insert() FROM PUBLIC, anon, authenticated;

-- 4) Reforça a função de sequência como única origem do número.
REVOKE ALL ON FUNCTION public.proximo_numero_fila(UUID) FROM PUBLIC, anon, authenticated;
