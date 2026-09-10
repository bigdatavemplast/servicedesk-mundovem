-- Corrige a operação de chamados pelo perfil gestor.
-- Regra: gestor opera chamados da própria área; admin opera globalmente;
-- atendente permanece limitado ao chamado sem responsável ou sob sua responsabilidade.

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
    WHERE gestor.id = _gestor_id
      AND gestor.area_id IS NOT NULL
      AND colaborador.area_id = gestor.area_id
  );
$$;

REVOKE ALL ON FUNCTION public.gestor_mesma_area(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestor_mesma_area(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Staff veem chamados conforme escopo" ON public.chamados;
CREATE POLICY "Staff veem chamados conforme escopo"
ON public.chamados
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'atendente')
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND public.gestor_mesma_area(auth.uid(), solicitante_id)
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
    AND public.gestor_mesma_area(auth.uid(), solicitante_id)
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
    AND public.gestor_mesma_area(auth.uid(), solicitante_id)
  )
);

DROP POLICY IF EXISTS "Autor cria comentário no próprio chamado ou staff" ON public.comentarios_chamado;
CREATE POLICY "Autor cria comentário no próprio chamado ou staff"
ON public.comentarios_chamado
FOR INSERT TO authenticated
WITH CHECK (
  autor_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.chamados c
    WHERE c.id = comentarios_chamado.chamado_id
      AND (
        c.solicitante_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR (
          public.has_role(auth.uid(), 'atendente')
          AND (c.atendente_id IS NULL OR c.atendente_id = auth.uid())
        )
        OR (
          public.has_role(auth.uid(), 'gestor')
          AND public.gestor_mesma_area(auth.uid(), c.solicitante_id)
        )
      )
  )
  AND (
    NOT comentarios_chamado.interno
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'atendente')
    OR public.has_role(auth.uid(), 'gestor')
  )
);

DROP POLICY IF EXISTS "Ler comentários do chamado" ON public.comentarios_chamado;
CREATE POLICY "Ler comentários do chamado"
ON public.comentarios_chamado
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chamados c
    WHERE c.id = comentarios_chamado.chamado_id
      AND (
        (c.solicitante_id = auth.uid() AND comentarios_chamado.interno = FALSE)
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'atendente')
        OR (
          public.has_role(auth.uid(), 'gestor')
          AND public.gestor_mesma_area(auth.uid(), c.solicitante_id)
          AND comentarios_chamado.interno = FALSE
        )
      )
  )
);

COMMENT ON POLICY "Staff atualizam chamados conforme escopo" ON public.chamados IS
'Admin altera qualquer chamado; atendente altera chamado sem responsável ou sob sua responsabilidade; gestor altera chamados da própria área.';
