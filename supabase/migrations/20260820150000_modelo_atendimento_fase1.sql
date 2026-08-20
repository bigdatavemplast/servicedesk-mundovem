-- ============================================================
-- Service Desk - Fase 1: modelo de atendimento
-- Segmento -> Grupo/Fila -> Atendentes
-- Tipo de chamado separado de categoria/segmento
-- ============================================================

-- 1) Tipos de chamado
CREATE TABLE IF NOT EXISTS public.tipos_chamado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(80) NOT NULL UNIQUE,
  descricao VARCHAR(255),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.tipos_chamado TO authenticated;
GRANT ALL ON public.tipos_chamado TO service_role;
ALTER TABLE public.tipos_chamado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem tipos de chamado" ON public.tipos_chamado;
CREATE POLICY "Autenticados leem tipos de chamado"
ON public.tipos_chamado FOR SELECT TO authenticated
USING (ativo = TRUE OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin gerencia tipos de chamado" ON public.tipos_chamado;
CREATE POLICY "Admin gerencia tipos de chamado"
ON public.tipos_chamado FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.tipos_chamado (nome, descricao, ordem) VALUES
  ('Incidente', 'Algo que funcionava e apresentou falha ou interrupção.', 1),
  ('Solicitação', 'Pedido de serviço, recurso ou alteração.', 2),
  ('Acesso', 'Criação, alteração ou remoção de acesso.', 3),
  ('Dúvida', 'Solicitação de orientação ou informação.', 4),
  ('Requisição', 'Solicitação operacional padronizada.', 5),
  ('Projeto', 'Demanda pertencente a um projeto formal.', 6)
ON CONFLICT (nome) DO NOTHING;

-- 2) Grupos/filas pertencem a um segmento.
CREATE TABLE IF NOT EXISTS public.grupos_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segmento_id UUID NOT NULL REFERENCES public.segmentos(id) ON DELETE RESTRICT,
  nome VARCHAR(100) NOT NULL,
  descricao VARCHAR(255),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (segmento_id, nome)
);

GRANT SELECT ON public.grupos_atendimento TO authenticated;
GRANT ALL ON public.grupos_atendimento TO service_role;
ALTER TABLE public.grupos_atendimento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem grupos de atendimento" ON public.grupos_atendimento;
CREATE POLICY "Autenticados leem grupos de atendimento"
ON public.grupos_atendimento FOR SELECT TO authenticated
USING (ativo = TRUE OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin gerencia grupos de atendimento" ON public.grupos_atendimento;
CREATE POLICY "Admin gerencia grupos de atendimento"
ON public.grupos_atendimento FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Usuário pode pertencer a vários grupos.
CREATE TABLE IF NOT EXISTS public.grupo_atendentes (
  grupo_id UUID NOT NULL REFERENCES public.grupos_atendimento(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (grupo_id, usuario_id)
);

GRANT SELECT ON public.grupo_atendentes TO authenticated;
GRANT ALL ON public.grupo_atendentes TO service_role;
ALTER TABLE public.grupo_atendentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem grupos dos atendentes" ON public.grupo_atendentes;
CREATE POLICY "Autenticados leem grupos dos atendentes"
ON public.grupo_atendentes FOR SELECT TO authenticated
USING (ativo = TRUE OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin gerencia grupos dos atendentes" ON public.grupo_atendentes;
CREATE POLICY "Admin gerencia grupos dos atendentes"
ON public.grupo_atendentes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Chamado passa a registrar o tipo e a fila responsável.
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS tipo_chamado_id UUID REFERENCES public.tipos_chamado(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grupo_atendimento_id UUID REFERENCES public.grupos_atendimento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chamados_tipo_chamado ON public.chamados(tipo_chamado_id);
CREATE INDEX IF NOT EXISTS idx_chamados_grupo_atendimento ON public.chamados(grupo_atendimento_id);

-- 5) Categorias continuam pertencendo a um segmento; o grupo é uma decisão operacional.
-- Não vinculamos categoria diretamente a grupo para não misturar classificação com fila.

-- 6) Grupos iniciais da operação.
INSERT INTO public.grupos_atendimento (segmento_id, nome, ordem)
SELECT s.id, v.nome, v.ordem
FROM public.segmentos s
CROSS JOIN (VALUES
  ('Infraestrutura', 1),
  ('Sistemas', 2),
  ('Suporte', 3)
) AS v(nome, ordem)
WHERE s.nome = 'TI'
ON CONFLICT (segmento_id, nome) DO NOTHING;

INSERT INTO public.grupos_atendimento (segmento_id, nome, ordem)
SELECT s.id, v.nome, v.ordem
FROM public.segmentos s
CROSS JOIN (VALUES
  ('Recursos Humanos', 1),
  ('Benefícios', 2),
  ('Departamento Pessoal', 3)
) AS v(nome, ordem)
WHERE s.nome = 'RH'
ON CONFLICT (segmento_id, nome) DO NOTHING;

INSERT INTO public.grupos_atendimento (segmento_id, nome, ordem)
SELECT s.id, 'Financeiro', 1
FROM public.segmentos s
WHERE s.nome = 'Financeiro'
ON CONFLICT (segmento_id, nome) DO NOTHING;

INSERT INTO public.grupos_atendimento (segmento_id, nome, ordem)
SELECT s.id, 'Projetos', 1
FROM public.segmentos s
WHERE s.nome = 'Projetos'
ON CONFLICT (segmento_id, nome) DO NOTHING;

INSERT INTO public.grupos_atendimento (segmento_id, nome, ordem)
SELECT s.id, 'Atendimento Geral', 1
FROM public.segmentos s
WHERE s.nome = 'Outros'
ON CONFLICT (segmento_id, nome) DO NOTHING;

-- 7) Segurança: somente perfis de atendimento podem ser associados a filas.
CREATE OR REPLACE FUNCTION public.validar_grupo_atendente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(NEW.usuario_id, ARRAY['atendente','gestor','admin']::public.app_role[]) THEN
    RAISE EXCEPTION 'Somente atendente, gestor ou admin pode pertencer a um grupo de atendimento';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_grupo_atendente ON public.grupo_atendentes;
CREATE TRIGGER trg_validar_grupo_atendente
BEFORE INSERT OR UPDATE OF usuario_id ON public.grupo_atendentes
FOR EACH ROW
EXECUTE FUNCTION public.validar_grupo_atendente();

REVOKE ALL ON FUNCTION public.validar_grupo_atendente() FROM PUBLIC, anon, authenticated;
