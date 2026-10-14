DROP POLICY IF EXISTS "Gestor vê chamados da própria área" ON public.chamados;
CREATE POLICY "Gestor vê chamados da própria área"
ON public.chamados
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  AND (
    solicitante_id = auth.uid()
    OR public.gestor_pode_ver_chamado(auth.uid(), id)
  )
);
