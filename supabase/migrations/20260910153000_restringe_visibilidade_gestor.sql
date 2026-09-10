-- Reforça o escopo de visualização de chamados no banco.
-- Colaborador: próprios chamados.
-- Atendente: fila completa.
-- Gestor: própria área.
-- Gestor da área TI: todas as áreas.
-- Admin: todos.

DROP POLICY IF EXISTS "Atendente/gestor/admin veem todos chamados" ON public.chamados;
DROP POLICY IF EXISTS "Colaborador vê chamados abertos de todas as áreas" ON public.chamados;
DROP POLICY IF EXISTS "Solicitante vê próprios chamados" ON public.chamados;
DROP POLICY IF EXISTS "Chamados visíveis conforme perfil" ON public.chamados;

CREATE POLICY "Chamados visíveis conforme perfil"
ON public.chamados
FOR SELECT TO authenticated
USING (
  solicitante_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'atendente')
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND public.gestor_mesma_area(auth.uid(), solicitante_id)
  )
);

DROP POLICY IF EXISTS "Ler comentários do chamado" ON public.comentarios_chamado;
DROP POLICY IF EXISTS "Ler comentários conforme escopo" ON public.comentarios_chamado;
CREATE POLICY "Ler comentários conforme escopo"
ON public.comentarios_chamado
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = comentarios_chamado.chamado_id
      AND (
        (c.solicitante_id = auth.uid() AND comentarios_chamado.interno = false)
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'atendente')
        OR (
          public.has_role(auth.uid(), 'gestor')
          AND public.gestor_mesma_area(auth.uid(), c.solicitante_id)
        )
      )
  )
);

DROP POLICY IF EXISTS "Ler anexos do chamado" ON public.anexos_chamado;
DROP POLICY IF EXISTS "Ler anexos conforme escopo" ON public.anexos_chamado;
CREATE POLICY "Ler anexos conforme escopo"
ON public.anexos_chamado
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = anexos_chamado.chamado_id
      AND (
        c.solicitante_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'atendente')
        OR (
          public.has_role(auth.uid(), 'gestor')
          AND public.gestor_mesma_area(auth.uid(), c.solicitante_id)
        )
      )
  )
);

DROP POLICY IF EXISTS "Ler histórico do chamado" ON public.historico_chamado;
DROP POLICY IF EXISTS "Ler histórico conforme escopo" ON public.historico_chamado;
CREATE POLICY "Ler histórico conforme escopo"
ON public.historico_chamado
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = historico_chamado.chamado_id
      AND (
        c.solicitante_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'atendente')
        OR (
          public.has_role(auth.uid(), 'gestor')
          AND public.gestor_mesma_area(auth.uid(), c.solicitante_id)
        )
      )
  )
);
