-- Atendentes visualizam somente chamados do setor/segmento ao qual pertencem.
-- Admin continua com acesso total; gestores seguem sua regra própria de escopo.

DROP POLICY IF EXISTS "Staff veem chamados conforme escopo" ON public.chamados;

CREATE POLICY "Staff veem chamados conforme escopo"
ON public.chamados
FOR SELECT TO authenticated
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
        AND g.segmento_id = chamados.segmento_id
    )
  )
  OR (
    has_role(auth.uid(), 'colaborador'::app_role)
    AND solicitante_id = auth.uid()
  )
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND gestor_pode_ver_chamado(auth.uid(), id)
  )
);
