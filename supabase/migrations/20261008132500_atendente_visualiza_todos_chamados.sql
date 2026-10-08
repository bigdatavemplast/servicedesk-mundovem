DROP POLICY IF EXISTS "Staff veem chamados conforme escopo" ON public.chamados;

CREATE POLICY "Staff veem chamados conforme escopo"
ON public.chamados
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'atendente'::app_role)
  OR (
    has_role(auth.uid(), 'colaborador'::app_role)
    AND solicitante_id = auth.uid()
  )
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND gestor_pode_ver_chamado(auth.uid(), id)
  )
);
