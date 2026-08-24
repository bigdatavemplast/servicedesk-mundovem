-- ============================================================
-- Service Desk - Fase 2: Triagem + níveis de atendimento
--
-- Fluxo:
-- Chamado -> Triagem -> Nível requerido -> Atendimento
--
-- A classificação do chamado continua separada da decisão operacional.
-- Um atendente N1 pode fazer triagem, mas não deve receber para resolução
-- chamados que exigem N2/N3.
-- ============================================================

-- 1) Status específico de triagem.
ALTER TYPE public.status_chamado
  ADD VALUE IF NOT EXISTS 'em_triagem' BEFORE 'em_andamento';

-- 2) Nível efetivo de atendimento de cada usuário dentro de cada grupo.
-- O mesmo usuário pode ter níveis diferentes em grupos diferentes.
ALTER TABLE public.grupo_atendentes
  ADD COLUMN IF NOT EXISTS nivel_atendimento VARCHAR(2) NOT NULL DEFAULT 'N1';

ALTER TABLE public.grupo_atendentes
  DROP CONSTRAINT IF EXISTS grupo_atendentes_nivel_check;

ALTER TABLE public.grupo_atendentes
  ADD CONSTRAINT grupo_atendentes_nivel_check
  CHECK (nivel_atendimento IN ('N1','N2','N3'));

CREATE INDEX IF NOT EXISTS idx_grupo_atendentes_nivel
  ON public.grupo_atendentes(grupo_id, nivel_atendimento)
  WHERE ativo = TRUE;

-- 3) Dados operacionais da triagem no chamado.
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS nivel_atendimento VARCHAR(2),
  ADD COLUMN IF NOT EXISTS complexidade VARCHAR(20),
  ADD COLUMN IF NOT EXISTS triagem_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS triagem_em TIMESTAMPTZ;

ALTER TABLE public.chamados
  DROP CONSTRAINT IF EXISTS chamados_nivel_atendimento_check;

ALTER TABLE public.chamados
  ADD CONSTRAINT chamados_nivel_atendimento_check
  CHECK (nivel_atendimento IS NULL OR nivel_atendimento IN ('N1','N2','N3'));

ALTER TABLE public.chamados
  DROP CONSTRAINT IF EXISTS chamados_complexidade_check;

ALTER TABLE public.chamados
  ADD CONSTRAINT chamados_complexidade_check
  CHECK (complexidade IS NULL OR complexidade IN ('baixa','media','alta'));

CREATE INDEX IF NOT EXISTS idx_chamados_nivel_atendimento
  ON public.chamados(nivel_atendimento)
  WHERE nivel_atendimento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chamados_triagem
  ON public.chamados(triagem_por, triagem_em);

-- 4) Compatibilidade: chamados novos entram na triagem.
-- Não alteramos chamados existentes.
CREATE OR REPLACE FUNCTION public.chamado_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla public.slas%ROWTYPE;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'SD-' || LPAD(nextval('public.chamado_seq')::TEXT, 5, '0');
  END IF;

  SELECT * INTO v_sla FROM public.slas WHERE prioridade = NEW.prioridade;
  IF FOUND THEN
    NEW.sla_id := v_sla.id;
    NEW.prazo_resposta := COALESCE(NEW.prazo_resposta, NEW.aberto_em + (v_sla.tempo_resposta_h || ' hours')::interval);
    NEW.prazo_resolucao := COALESCE(NEW.prazo_resolucao, NEW.aberto_em + (v_sla.tempo_resolucao_h || ' hours')::interval);
  END IF;

  IF NEW.status = 'aberto' THEN
    NEW.status := 'em_triagem';
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Regra de segurança da atribuição por nível.
-- Admin continua podendo assumir qualquer chamado.
CREATE OR REPLACE FUNCTION public.validar_nivel_atendente_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nivel VARCHAR(2);
BEGIN
  IF NEW.atendente_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(NEW.atendente_id, 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.grupo_atendimento_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ga.nivel_atendimento
    INTO v_nivel
  FROM public.grupo_atendentes ga
  WHERE ga.grupo_id = NEW.grupo_atendimento_id
    AND ga.usuario_id = NEW.atendente_id
    AND ga.ativo = TRUE
  LIMIT 1;

  IF v_nivel IS NULL THEN
    RAISE EXCEPTION 'O atendente selecionado não pertence ao grupo ativo deste chamado.';
  END IF;

  IF NEW.nivel_atendimento IS NOT NULL
     AND CAST(SUBSTRING(v_nivel FROM 2) AS INTEGER)
       < CAST(SUBSTRING(NEW.nivel_atendimento FROM 2) AS INTEGER) THEN
    RAISE EXCEPTION 'O nível do atendente é insuficiente para este chamado. Requer %.', NEW.nivel_atendimento;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_nivel_atendente_chamado
  ON public.chamados;

CREATE TRIGGER trg_validar_nivel_atendente_chamado
BEFORE INSERT OR UPDATE OF atendente_id, grupo_atendimento_id, nivel_atendimento
ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.validar_nivel_atendente_chamado();

REVOKE ALL ON FUNCTION public.validar_nivel_atendente_chamado() FROM PUBLIC, anon, authenticated;
