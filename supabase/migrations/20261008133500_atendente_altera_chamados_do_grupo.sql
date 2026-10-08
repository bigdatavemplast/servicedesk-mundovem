DROP POLICY IF EXISTS "Staff atualizam chamados conforme escopo" ON public.chamados;

CREATE POLICY "Staff atualizam chamados conforme escopo"
ON public.chamados
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'atendente'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.grupo_atendentes ga
      JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
      WHERE ga.usuario_id = auth.uid()
        AND ga.ativo = TRUE
        AND g.ativo = TRUE
        AND (
          (chamados.grupo_atendimento_id IS NOT NULL AND g.id = chamados.grupo_atendimento_id)
          OR (chamados.grupo_atendimento_id IS NULL AND g.segmento_id = chamados.segmento_id)
        )
    )
  )
  OR (has_role(auth.uid(), 'gestor'::app_role) AND gestor_pode_ver_chamado(auth.uid(), id))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'atendente'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.grupo_atendentes ga
      JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
      WHERE ga.usuario_id = auth.uid()
        AND ga.ativo = TRUE
        AND g.ativo = TRUE
        AND (
          (grupo_atendimento_id IS NOT NULL AND g.id = grupo_atendimento_id)
          OR (grupo_atendimento_id IS NULL AND g.segmento_id = segmento_id)
        )
    )
  )
  OR (has_role(auth.uid(), 'gestor'::app_role) AND gestor_pode_ver_chamado(auth.uid(), id))
);
