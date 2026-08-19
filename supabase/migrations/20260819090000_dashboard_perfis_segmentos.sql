-- =============================================================
-- Service Desk - dashboards por perfil, segmentos e nota interna
-- =============================================================

-- 1) Segmentos de atendimento
CREATE TABLE IF NOT EXISTS public.segmentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.segmentos TO authenticated;
GRANT ALL ON public.segmentos TO service_role;
ALTER TABLE public.segmentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem segmentos" ON public.segmentos;
CREATE POLICY "Autenticados leem segmentos"
ON public.segmentos FOR SELECT TO authenticated
USING (ativo = TRUE OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin gerencia segmentos" ON public.segmentos;
CREATE POLICY "Admin gerencia segmentos"
ON public.segmentos FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.segmentos (nome, ordem) VALUES
  ('TI', 1),
  ('RH', 2),
  ('Projetos', 3),
  ('Financeiro', 4),
  ('Outros', 99)
ON CONFLICT (nome) DO NOTHING;

-- 2) Segmento da categoria e do chamado.
-- O segmento é copiado da categoria para preservar o contexto do chamado.
ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS segmento_id UUID REFERENCES public.segmentos(id) ON DELETE SET NULL;

ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS segmento_id UUID REFERENCES public.segmentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categorias_segmento ON public.categorias(segmento_id);
CREATE INDEX IF NOT EXISTS idx_chamados_segmento ON public.chamados(segmento_id);

-- Mapeamento inicial baseado nas categorias atuais.
UPDATE public.categorias c
SET segmento_id = s.id
FROM public.segmentos s
WHERE c.nome IN ('Suporte', 'Acesso e Permissões', 'Hardware', 'Sistemas')
  AND s.nome = 'TI'
  AND c.segmento_id IS NULL;

UPDATE public.categorias c
SET segmento_id = s.id
FROM public.segmentos s
WHERE c.nome = 'RH'
  AND s.nome = 'RH'
  AND c.segmento_id IS NULL;

UPDATE public.categorias c
SET segmento_id = s.id
FROM public.segmentos s
WHERE c.nome = 'Projetos'
  AND s.nome = 'Projetos'
  AND c.segmento_id IS NULL;

UPDATE public.categorias c
SET segmento_id = s.id
FROM public.segmentos s
WHERE c.nome = 'Financeiro'
  AND s.nome = 'Financeiro'
  AND c.segmento_id IS NULL;

UPDATE public.categorias c
SET segmento_id = s.id
FROM public.segmentos s
WHERE c.segmento_id IS NULL
  AND s.nome = 'Outros';

-- Chamados existentes recebem o segmento da categoria.
UPDATE public.chamados ch
SET segmento_id = c.segmento_id
FROM public.categorias c
WHERE ch.categoria_id = c.id
  AND ch.segmento_id IS NULL;

-- 3) Novos chamados herdam automaticamente o segmento da categoria.
CREATE OR REPLACE FUNCTION public.sincronizar_segmento_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.categoria_id IS NULL THEN
    NEW.segmento_id := NULL;
  ELSE
    SELECT segmento_id
      INTO NEW.segmento_id
      FROM public.categorias
     WHERE id = NEW.categoria_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chamado_sincroniza_segmento ON public.chamados;
CREATE TRIGGER trg_chamado_sincroniza_segmento
BEFORE INSERT OR UPDATE OF categoria_id ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_segmento_chamado();

REVOKE ALL ON FUNCTION public.sincronizar_segmento_chamado() FROM PUBLIC, anon, authenticated;

-- 4) Nota interna: SOMENTE ATENDENTE pode enviar e enxergar.
DROP POLICY IF EXISTS "Ler comentários do chamado" ON public.comentarios_chamado;
CREATE POLICY "Ler comentários do chamado"
ON public.comentarios_chamado
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = comentarios_chamado.chamado_id
      AND (
        (c.solicitante_id = auth.uid() AND comentarios_chamado.interno = FALSE)
        OR (
          public.has_role(auth.uid(), 'atendente')
          AND NOT public.has_role(auth.uid(), 'gestor')
          AND NOT public.has_role(auth.uid(), 'admin')
        )
        OR (
          comentarios_chamado.interno = FALSE
          AND (
            public.has_role(auth.uid(), 'gestor')
            OR public.has_role(auth.uid(), 'admin')
          )
          AND (
            public.has_role(auth.uid(), 'admin')
            OR public.gestor_mesma_area(auth.uid(), c.solicitante_id)
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Autor cria comentário no próprio chamado ou staff" ON public.comentarios_chamado;
CREATE POLICY "Autor cria comentário no próprio chamado ou staff"
ON public.comentarios_chamado
FOR INSERT TO authenticated
WITH CHECK (
  autor_id = auth.uid()
  AND (
    (
      interno = FALSE
      AND EXISTS (
        SELECT 1 FROM public.chamados c
        WHERE c.id = comentarios_chamado.chamado_id
          AND (
            c.solicitante_id = auth.uid()
            OR public.has_role(auth.uid(), 'atendente')
            OR (
              public.has_role(auth.uid(), 'gestor')
              AND public.gestor_mesma_area(auth.uid(), c.solicitante_id)
            )
            OR public.has_role(auth.uid(), 'admin')
          )
      )
    )
    OR (
      interno = TRUE
      AND public.has_role(auth.uid(), 'atendente')
      AND NOT public.has_role(auth.uid(), 'gestor')
      AND NOT public.has_role(auth.uid(), 'admin')
      AND EXISTS (
        SELECT 1 FROM public.chamados c
        WHERE c.id = comentarios_chamado.chamado_id
          AND (
            public.has_role(auth.uid(), 'atendente')
            OR public.has_role(auth.uid(), 'admin')
            OR (
              public.has_role(auth.uid(), 'gestor')
              AND public.gestor_mesma_area(auth.uid(), c.solicitante_id)
            )
          )
      )
    )
  )
);

-- 5) Colaborador não pode alterar prioridade nem atendente.
-- A regra é aplicada no banco, além da interface/backend.
CREATE OR REPLACE FUNCTION public.proteger_campos_chamado_colaborador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.solicitante_id = auth.uid()
     AND NOT public.has_any_role(auth.uid(), ARRAY['atendente','gestor','admin']::public.app_role[]) THEN
    IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
      RAISE EXCEPTION 'Colaborador não pode alterar a prioridade do chamado';
    END IF;
    IF NEW.atendente_id IS DISTINCT FROM OLD.atendente_id THEN
      RAISE EXCEPTION 'Colaborador não pode alterar o atendente do chamado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_campos_chamado_colaborador ON public.chamados;
CREATE TRIGGER trg_proteger_campos_chamado_colaborador
BEFORE UPDATE ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.proteger_campos_chamado_colaborador();

REVOKE ALL ON FUNCTION public.proteger_campos_chamado_colaborador() FROM PUBLIC, anon, authenticated;

-- 6) Funções de dashboard respeitam o mesmo escopo do restante do sistema.
CREATE OR REPLACE FUNCTION public.dashboard_escopo_gestor(_gestor_id UUID, _solicitante_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.gestor_mesma_area(_gestor_id, _solicitante_id);
$$;

REVOKE ALL ON FUNCTION public.dashboard_escopo_gestor(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_escopo_gestor(UUID, UUID) TO authenticated;

-- 7) Para gestor, a visão gerencial é somente da equipe.
-- Colaboradores continuam vendo apenas os próprios chamados.
DROP POLICY IF EXISTS "Solicitante vê próprios chamados" ON public.chamados;
CREATE POLICY "Colaborador vê próprios chamados"
ON public.chamados
FOR SELECT TO authenticated
USING (
  auth.uid() = solicitante_id
  AND NOT public.has_any_role(auth.uid(), ARRAY['atendente','gestor','admin']::public.app_role[])
);

DROP POLICY IF EXISTS "Solicitante atualiza próprios chamados abertos" ON public.chamados;
CREATE POLICY "Colaborador atualiza próprios chamados abertos"
ON public.chamados
FOR UPDATE TO authenticated
USING (
  auth.uid() = solicitante_id
  AND NOT public.has_any_role(auth.uid(), ARRAY['atendente','gestor','admin']::public.app_role[])
  AND status IN ('aberto','aguardando_usuario')
)
WITH CHECK (
  auth.uid() = solicitante_id
  AND NOT public.has_any_role(auth.uid(), ARRAY['atendente','gestor','admin']::public.app_role[])
);

-- Novas categorias sem classificação explícita entram em "Outros".
CREATE OR REPLACE FUNCTION public.categoria_default_segmento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.segmento_id IS NULL THEN
    SELECT id INTO NEW.segmento_id FROM public.segmentos WHERE nome = 'Outros' LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categoria_default_segmento ON public.categorias;
CREATE TRIGGER trg_categoria_default_segmento
BEFORE INSERT ON public.categorias
FOR EACH ROW
EXECUTE FUNCTION public.categoria_default_segmento();

REVOKE ALL ON FUNCTION public.categoria_default_segmento() FROM PUBLIC, anon, authenticated;
