-- ============================================================
-- Regras de atribuição automática
-- Usa o grupo já definido na abertura do chamado e critérios
-- existentes de classificação. Chamados sem regra permanecem
-- disponíveis para triagem humana.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.regras_atribuicao_automatica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(150) NOT NULL,
  grupo_atendimento_id UUID NOT NULL REFERENCES public.grupos_atendimento(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE CASCADE,
  subcategoria_id UUID REFERENCES public.subcategorias(id) ON DELETE CASCADE,
  tipo_chamado_id UUID REFERENCES public.tipos_chamado(id) ON DELETE CASCADE,
  atendente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prioridade INT NOT NULL DEFAULT 100,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT regras_atribuicao_prioridade_chk CHECK (prioridade >= 0)
);

CREATE INDEX IF NOT EXISTS idx_regras_atrib_grupo
  ON public.regras_atribuicao_automatica(grupo_atendimento_id);
CREATE INDEX IF NOT EXISTS idx_regras_atrib_categoria
  ON public.regras_atribuicao_automatica(categoria_id);
CREATE INDEX IF NOT EXISTS idx_regras_atrib_subcategoria
  ON public.regras_atribuicao_automatica(subcategoria_id);
CREATE INDEX IF NOT EXISTS idx_regras_atrib_tipo
  ON public.regras_atribuicao_automatica(tipo_chamado_id);
CREATE INDEX IF NOT EXISTS idx_regras_atrib_ativo_prioridade
  ON public.regras_atribuicao_automatica(ativo, prioridade);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regras_atribuicao_automatica TO authenticated;
GRANT ALL ON public.regras_atribuicao_automatica TO service_role;

ALTER TABLE public.regras_atribuicao_automatica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem regras de atribuição" ON public.regras_atribuicao_automatica;
CREATE POLICY "Autenticados leem regras de atribuição"
  ON public.regras_atribuicao_automatica
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin gerencia regras de atribuição" ON public.regras_atribuicao_automatica;
CREATE POLICY "Admin gerencia regras de atribuição"
  ON public.regras_atribuicao_automatica
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.aplicar_atribuicao_automatica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regra public.regras_atribuicao_automatica%ROWTYPE;
BEGIN
  -- Só decide automaticamente quando o chamado ainda não possui atendente.
  IF NEW.atendente_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- A fila/grupo já deve ter sido definido na abertura.
  IF NEW.grupo_atendimento_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Não tenta atribuir chamado que não esteja no fluxo inicial.
  IF NEW.status <> 'em_triagem' THEN
    RETURN NEW;
  END IF;

  SELECT r.*
    INTO v_regra
    FROM public.regras_atribuicao_automatica r
   WHERE r.ativo = TRUE
     AND r.grupo_atendimento_id = NEW.grupo_atendimento_id
     AND (r.categoria_id IS NULL OR r.categoria_id = NEW.categoria_id)
     AND (r.subcategoria_id IS NULL OR r.subcategoria_id = NEW.subcategoria_id)
     AND (r.tipo_chamado_id IS NULL OR r.tipo_chamado_id = NEW.tipo_chamado_id)
     AND EXISTS (
       SELECT 1
         FROM public.grupo_atendimento_membros gm
        WHERE gm.grupo_atendimento_id = r.grupo_atendimento_id
          AND gm.usuario_id = r.atendente_id
          AND gm.ativo = TRUE
     )
   ORDER BY
     CASE WHEN r.subcategoria_id IS NOT NULL THEN 1 ELSE 0 END DESC,
     CASE WHEN r.categoria_id IS NOT NULL THEN 1 ELSE 0 END DESC,
     CASE WHEN r.tipo_chamado_id IS NOT NULL THEN 1 ELSE 0 END DESC,
     r.prioridade ASC,
     r.criado_em ASC
   LIMIT 1;

  IF FOUND THEN
    NEW.atendente_id := v_regra.atendente_id;
    NEW.status := 'aberto';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_atribuicao_automatica ON public.chamados;

CREATE TRIGGER trg_aplicar_atribuicao_automatica
BEFORE INSERT ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.aplicar_atribuicao_automatica();

REVOKE ALL ON FUNCTION public.aplicar_atribuicao_automatica() FROM PUBLIC, anon, authenticated;

-- Mantém atualizado o timestamp de manutenção das regras.
CREATE OR REPLACE FUNCTION public.atualizar_regra_atribuicao_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regras_atribuicao_atualizado_em ON public.regras_atribuicao_automatica;
CREATE TRIGGER trg_regras_atribuicao_atualizado_em
BEFORE UPDATE ON public.regras_atribuicao_automatica
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_regra_atribuicao_atualizado_em();
