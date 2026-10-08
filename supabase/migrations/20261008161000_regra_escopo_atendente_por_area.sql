-- Regra central de escopo do atendente:
-- o setor do atendente é definido por profiles.area_id e deve corresponder
-- ao segmento do chamado. A regra não depende de cadastro individual em
-- grupo_atendentes.

DROP POLICY IF EXISTS "Staff veem chamados conforme escopo" ON public.chamados;
CREATE POLICY "Staff veem chamados conforme escopo"
ON public.chamados FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (
    has_role(auth.uid(),'atendente'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.areas a ON a.id = p.area_id
      JOIN public.segmentos s ON lower(trim(s.nome)) = lower(trim(a.nome))
      WHERE p.id = auth.uid() AND p.ativo = true
        AND a.ativo = true AND s.ativo = true
        AND s.id = chamados.segmento_id
    )
  )
  OR (has_role(auth.uid(),'colaborador'::app_role) AND solicitante_id = auth.uid())
  OR (has_role(auth.uid(),'gestor'::app_role) AND gestor_pode_ver_chamado(auth.uid(),id))
);

DROP POLICY IF EXISTS "Staff atualizam chamados conforme escopo" ON public.chamados;
CREATE POLICY "Staff atualizam chamados conforme escopo"
ON public.chamados FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (
    has_role(auth.uid(),'atendente'::app_role)
    AND atendente_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.areas a ON a.id = p.area_id
      JOIN public.segmentos s ON lower(trim(s.nome)) = lower(trim(a.nome))
      WHERE p.id = auth.uid() AND p.ativo = true
        AND a.ativo = true AND s.ativo = true
        AND s.id = chamados.segmento_id
    )
  )
  OR (has_role(auth.uid(),'gestor'::app_role) AND gestor_pode_ver_chamado(auth.uid(),id))
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR (
    has_role(auth.uid(),'atendente'::app_role)
    AND (atendente_id IS NULL OR atendente_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.areas a ON a.id = p.area_id
      JOIN public.segmentos s ON lower(trim(s.nome)) = lower(trim(a.nome))
      WHERE p.id = auth.uid() AND p.ativo = true
        AND a.ativo = true AND s.ativo = true
        AND s.id = chamados.segmento_id
    )
  )
  OR (has_role(auth.uid(),'gestor'::app_role) AND gestor_pode_ver_chamado(auth.uid(),id))
);