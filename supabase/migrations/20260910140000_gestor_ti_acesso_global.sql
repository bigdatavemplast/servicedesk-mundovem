-- Garante que somente o gestor cuja área é T.I. tenha escopo global.
-- A normalização aceita T.I, T.I., TI etc.; demais gestores permanecem na própria área.

CREATE OR REPLACE FUNCTION public.gestor_mesma_area(_gestor_id UUID, _colaborador_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles gestor
    JOIN public.profiles colaborador ON colaborador.id = _colaborador_id
    LEFT JOIN public.areas area_gestor ON area_gestor.id = gestor.area_id
    WHERE gestor.id = _gestor_id
      AND (
        regexp_replace(lower(trim(coalesce(area_gestor.nome, ''))), '[^a-z0-9]', '', 'g') = 'ti'
        OR (
          gestor.area_id IS NOT NULL
          AND colaborador.area_id = gestor.area_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.gestor_mesma_area(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestor_mesma_area(UUID, UUID) TO authenticated;
