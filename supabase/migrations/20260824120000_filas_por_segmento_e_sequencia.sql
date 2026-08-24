-- ============================================================
-- Fase 2 - Filas
-- Regra: cada segmento representa uma fila operacional.
-- Cada fila possui prefixo e sequencia numerica independentes.
-- ============================================================

ALTER TABLE public.grupos_atendimento
  ADD COLUMN IF NOT EXISTS prefixo VARCHAR(20);

-- A fila e o proprio segmento. Prefixos iniciais padronizados.
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
WHERE g.segmento_id = s.id
  AND (g.prefixo IS NULL OR g.prefixo = '');

-- Garante prefixo unico por fila.
CREATE UNIQUE INDEX IF NOT EXISTS uq_grupos_atendimento_prefixo
  ON public.grupos_atendimento(prefixo)
  WHERE prefixo IS NOT NULL;

-- Sequencia independente por fila.
CREATE TABLE IF NOT EXISTS public.grupo_sequencias (
  grupo_id UUID PRIMARY KEY REFERENCES public.grupos_atendimento(id) ON DELETE CASCADE,
  proximo_numero BIGINT NOT NULL DEFAULT 1 CHECK (proximo_numero > 0),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.grupo_sequencias TO authenticated;
GRANT ALL ON public.grupo_sequencias TO service_role;
ALTER TABLE public.grupo_sequencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia sequencias das filas" ON public.grupo_sequencias;
CREATE POLICY "Admin gerencia sequencias das filas"
ON public.grupo_sequencias FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inicializa cada fila. Para filas existentes, tenta preservar a numeracao
-- legada quando houver chamados ja vinculados a ela.
INSERT INTO public.grupo_sequencias (grupo_id, proximo_numero)
SELECT g.id,
       COALESCE(MAX(CASE
         WHEN c.numero ~ ('^' || regexp_replace(g.prefixo, '([\\.\\+\\*\\?\\[\\]\\(\\)\\{\\}\\|\\^\\$])', '\\\\1', 'g') || '-[0-9]+$')
         THEN substring(c.numero FROM '([0-9]+)$')::BIGINT
         ELSE NULL
       END), 0) + 1
FROM public.grupos_atendimento g
LEFT JOIN public.chamados c ON c.grupo_atendimento_id = g.id
GROUP BY g.id
ON CONFLICT (grupo_id) DO NOTHING;

-- Reserva o proximo numero de forma atomica.
CREATE OR REPLACE FUNCTION public.proximo_numero_fila(p_grupo_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.grupos_atendimento
    WHERE id = p_grupo_id
      AND ativo = TRUE
  ) THEN
    RAISE EXCEPTION 'Fila invalida ou inativa';
  END IF;

  INSERT INTO public.grupo_sequencias (grupo_id, proximo_numero)
  VALUES (p_grupo_id, 2)
  ON CONFLICT (grupo_id) DO UPDATE
    SET proximo_numero = public.grupo_sequencias.proximo_numero + 1,
        atualizado_em = NOW()
  RETURNING proximo_numero - 1 INTO v_numero;

  RETURN v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.proximo_numero_fila(UUID) FROM PUBLIC, anon, authenticated;

-- Gera numero da fila quando o chamado ainda nao possui numero.
-- O segmento do chamado deve ser o mesmo segmento da fila.
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

  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    v_numero := public.proximo_numero_fila(NEW.grupo_atendimento_id);
    NEW.numero := v_grupo.prefixo || '-' || LPAD(v_numero::TEXT, 2, '0');
  END IF;

  SELECT * INTO v_sla FROM public.slas WHERE prioridade = NEW.prioridade;
  IF FOUND THEN
    NEW.sla_id := v_sla.id;
    NEW.prazo_resposta := COALESCE(NEW.prazo_resposta, NEW.aberto_em + (v_sla.tempo_resposta_h || ' hours')::interval);
    NEW.prazo_resolucao := COALESCE(NEW.prazo_resolucao, NEW.aberto_em + (v_sla.tempo_resolucao_h || ' hours')::interval);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chamado_before_insert ON public.chamados;
CREATE TRIGGER trg_chamado_before_insert
BEFORE INSERT ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.chamado_before_insert();

-- Impede alterar a fila para outro segmento.
CREATE OR REPLACE FUNCTION public.validar_fila_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.grupo_atendimento_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.grupos_atendimento g
    WHERE g.id = NEW.grupo_atendimento_id
      AND g.ativo = TRUE
      AND g.segmento_id = NEW.segmento_id
  ) THEN
    RAISE EXCEPTION 'A fila deve pertencer ao mesmo segmento do chamado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_fila_chamado ON public.chamados;
CREATE TRIGGER trg_validar_fila_chamado
BEFORE INSERT OR UPDATE OF grupo_atendimento_id, segmento_id ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.validar_fila_chamado();

REVOKE ALL ON FUNCTION public.validar_fila_chamado() FROM PUBLIC, anon, authenticated;
