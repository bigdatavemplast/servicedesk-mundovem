-- Estrutura Departamento -> Área -> Usuário.
-- A migração é aditiva e preserva os campos legados para não quebrar o sistema.

CREATE TABLE IF NOT EXISTS public.departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(120) NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.departamentos TO authenticated;
GRANT ALL ON public.departamentos TO service_role;
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem departamentos" ON public.departamentos;
CREATE POLICY "Autenticados leem departamentos"
ON public.departamentos
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admin gerencia departamentos" ON public.departamentos;
CREATE POLICY "Admin gerencia departamentos"
ON public.departamentos
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Cria o cadastro mestre a partir dos departamentos já existentes.
INSERT INTO public.departamentos (nome)
SELECT DISTINCT TRIM(departamento)
FROM public.profiles
WHERE departamento IS NOT NULL
  AND TRIM(departamento) <> ''
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.areas
  ADD COLUMN IF NOT EXISTS departamento_id UUID
  REFERENCES public.departamentos(id)
  ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS departamento_id UUID
  REFERENCES public.departamentos(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_areas_departamento_id
  ON public.areas(departamento_id);

CREATE INDEX IF NOT EXISTS idx_profiles_departamento_id
  ON public.profiles(departamento_id);

-- Vincula os usuários aos departamentos sem apagar o texto legado.
UPDATE public.profiles p
SET departamento_id = d.id
FROM public.departamentos d
WHERE p.departamento_id IS NULL
  AND p.departamento IS NOT NULL
  AND TRIM(p.departamento) = d.nome;

-- As áreas antigas criadas com o mesmo nome do departamento recebem o vínculo.
-- Áreas com nomes diferentes ficam sem vínculo até serem classificadas pelo admin,
-- evitando associações presumidas e incorretas.
UPDATE public.areas a
SET departamento_id = d.id
FROM public.departamentos d
WHERE a.departamento_id IS NULL
  AND LOWER(TRIM(a.nome)) = LOWER(TRIM(d.nome));

-- Impede que um usuário tenha área pertencente a outro departamento.
CREATE OR REPLACE FUNCTION public.validar_area_departamento_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.area_id IS NOT NULL AND NEW.departamento_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.areas a
      WHERE a.id = NEW.area_id
        AND (a.departamento_id IS NULL OR a.departamento_id = NEW.departamento_id)
    ) THEN
      RAISE EXCEPTION 'A área selecionada não pertence ao departamento informado.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_area_departamento_usuario ON public.profiles;
CREATE TRIGGER trg_validar_area_departamento_usuario
BEFORE INSERT OR UPDATE OF area_id, departamento_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validar_area_departamento_usuario();

COMMENT ON TABLE public.departamentos IS
'Cadastro mestre de departamentos. Cada área pode pertencer a um departamento.';

COMMENT ON COLUMN public.areas.departamento_id IS
'Departamento ao qual a área pertence.';

COMMENT ON COLUMN public.profiles.departamento_id IS
'Departamento estruturado do usuário; departamento textual é mantido para compatibilidade.';
