-- Corrige o escopo de acesso do gestor.
-- Gestor comum: chamados dos colaboradores da mesma área.
-- Gestor de T.I.: chamados de todas as áreas.
-- Colaborador: somente os próprios chamados.
-- Atendente/Admin: regras globais já existentes.

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
    JOIN public.profiles colaborador
      ON colaborador.id = _colaborador_id
    WHERE gestor.id = _gestor_id
      AND (
        (
          gestor.area_id IS NOT NULL
          AND colaborador.area_id = gestor.area_id
        )
        OR (
          gestor.departamento IS NOT NULL
          AND colaborador.departamento IS NOT NULL
          AND lower(trim(gestor.departamento)) = lower(trim(colaborador.departamento))
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.gestor_mesma_area(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestor_mesma_area(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Gestor vê chamados da própria área" ON public.chamados;
CREATE POLICY "Gestor vê chamados da própria área"
ON public.chamados
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor')
  AND (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.areas a ON a.id = p.area_id
      WHERE p.id = auth.uid()
        AND lower(regexp_replace(trim(coalesce(a.nome, '')), '[^a-zA-Z0-9]', '', 'g')) = 'ti'
    )
    OR public.gestor_mesma_area(auth.uid(), solicitante_id)
  )
);

DROP POLICY IF EXISTS "Staff atualizam chamados conforme escopo" ON public.chamados;
CREATE POLICY "Staff atualizam chamados conforme escopo"
ON public.chamados
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'atendente')
    AND (atendente_id IS NULL OR atendente_id = auth.uid())
  )
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.areas a ON a.id = p.area_id
        WHERE p.id = auth.uid()
          AND lower(regexp_replace(trim(coalesce(a.nome, '')), '[^a-zA-Z0-9]', '', 'g')) = 'ti'
      )
      OR public.gestor_mesma_area(auth.uid(), solicitante_id)
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'atendente')
    AND (atendente_id IS NULL OR atendente_id = auth.uid())
  )
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.areas a ON a.id = p.area_id
        WHERE p.id = auth.uid()
          AND lower(regexp_replace(trim(coalesce(a.nome, '')), '[^a-zA-Z0-9]', '', 'g')) = 'ti'
      )
      OR public.gestor_mesma_area(auth.uid(), solicitante_id)
    )
  )
);

COMMENT ON FUNCTION public.gestor_mesma_area(UUID, UUID) IS
'Gestor comum acessa chamados da mesma área ou departamento; Gestor de T.I. possui acesso global pelas políticas de chamados.';
