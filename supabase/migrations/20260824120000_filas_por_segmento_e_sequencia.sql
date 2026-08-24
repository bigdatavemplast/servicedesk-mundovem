-- ============================================================
-- Fase 2 - Filas
-- Regra: cada segmento representa uma unica fila operacional.
-- Cada fila possui prefixo e sequencia numerica independentes.
-- ============================================================

ALTER TABLE public.grupos_atendimento
  ADD COLUMN IF NOT EXISTS prefixo VARCHAR(20);

-- Cada segmento passa a ter uma unica fila ativa, com o mesmo nome do segmento.
DO $$
DECLARE
  r RECORD;
  v_grupo UUID;
BEGIN
  FOR r IN SELECT id, nome FROM public.segmentos WHERE ativo = TRUE LOOP
    SELECT g.id INTO v_grupo
    FROM public.grupos_atendimento g
    WHERE g.segmento_id = r.id
    ORDER BY CASE WHEN lower(g.nome) = lower(r.nome) THEN 0 ELSE 1 END, g.ordem, g.criado_em
    LIMIT 1;

    IF v_grupo IS NULL THEN
      INSERT INTO public.grupos_atendimento (segmento_id, nome, descricao, ativo, ordem)
      VALUES (r.id, r.nome, 'Fila operacional do segmento ' || r.nome, TRUE, 1)
      RETURNING id INTO v_grupo;
    ELSE
      UPDATE public.grupos_atendimento
      SET nome = r.nome,
          ativo = TRUE,
          descricao = COALESCE(descricao, 'Fila operacional do segmento ' || r.nome)
      WHERE id = v_grupo;
    END IF;

    UPDATE public.chamados
    SET grupo_atendimento_id = v_grupo
    WHERE segmento_id = r.id
      AND (grupo_atendimento_id IS NULL OR grupo_atendimento_id <> v_grupo);

    UPDATE public.grupos_atendimento
    SET ativo = FALSE
    WHERE segmento_id = r.id AND id <> v_grupo;
  END LOOP;
END $$;

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
WHERE g.segmento_id = s.id AND g.ativo = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_grupos_atendimento_prefixo
  ON public.grupos_atendimento(prefixo)
  WHERE prefixo IS NOT NULL;

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

-- Para filas existentes, preserva o maior numero ja usado no novo formato.
INSERT INTO public.grupo_sequencias (grupo_id, proximo_numero)
SELECT g.id,
       COALESCE(MAX(CASE
         WHEN c.numero ~ ('^' || g.prefixo || '-[0-9]+$')
         THEN substring(c.numero FROM '([0-9]+)$')::BIGINT
         ELSE NULL
       END), 0) + 1
FROM public.grupos_atendimento g
LEFT JOIN public.chamados c ON c.grupo_atendimento_id = g.id
WHERE g.ativo = TRUE
GROUP BY g.id
ON CONFLICT (grupo_id) DO UPDATE
SET proximo_numero = GREATEST(public.grupo_sequencias.proximo_numero, EXCLUDED.proximo_numero),
    atualizado_em = NOW();

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
    SELECT 1 FROM public.grupos_atendimento
    WHERE id = p_grupo_id AND ativo = TRUE
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
  WHERE id = NEW.grupo_atendimento_id AND ativo = TRUE;

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

CREATE OR REPLACE FUNCTION public.validar_fila_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.grupo_atendimento_id IS NULL THEN
    RAISE EXCEPTION 'Chamado precisa possuir uma fila';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.grupos_atendimento g
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
