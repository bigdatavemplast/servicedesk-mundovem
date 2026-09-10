-- Regra especial de operação:
-- somente o perfil gestor cuja área seja T.I. pode operar chamados de qualquer área.
-- Outros gestores continuam limitados aos chamados da própria área.

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
        LOWER(TRIM(COALESCE(area_gestor.nome, ''))) = 't.i'
        OR (
          gestor.area_id IS NOT NULL
          AND colaborador.area_id = gestor.area_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.gestor_mesma_area(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestor_mesma_area(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.gestor_mesma_area(UUID, UUID) IS
'Gestor T.I. opera chamados de qualquer área; demais gestores operam somente chamados da própria área.';
