-- Fecha três brechas de autorização sem alterar o fluxo visual:
-- 1) UPDATE de chamados: admin, atendente responsável ou chamado sem responsável;
--    gestor somente dentro da própria área.
-- 2) atribuir_chamado: mesma regra de escopo + validação do responsável.
-- 3) INSERT de comentários: solicitante, admin, atendente responsável ou chamado sem responsável;
--    gestor somente dentro da própria área.

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

CREATE OR REPLACE FUNCTION public.atribuir_chamado(_chamado_id uuid, _atendente_id uuid)
RETURNS public.chamados
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.chamados;
  v_atual_atendente uuid;
  v_solicitante uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT atendente_id, solicitante_id
    INTO v_atual_atendente, v_solicitante
  FROM public.chamados
  WHERE id = _chamado_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    NULL;
  ELSIF public.has_role(auth.uid(), 'atendente') THEN
    IF v_atual_atendente IS NOT NULL AND v_atual_atendente <> auth.uid() THEN
      RAISE EXCEPTION 'Somente o atendente responsável pode alterar a atribuição deste chamado.';
    END IF;
  ELSIF public.has_role(auth.uid(), 'gestor') THEN
    IF NOT public.gestor_mesma_area(auth.uid(), v_solicitante) THEN
      RAISE EXCEPTION 'Você não tem permissão para atribuir este chamado.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Você não tem permissão para atribuir o chamado.';
  END IF;

  IF _atendente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _atendente_id
      AND ur.role IN ('atendente','gestor','admin')
  ) THEN
    RAISE EXCEPTION 'O responsável selecionado não possui perfil de atendimento.';
  END IF;

  UPDATE public.chamados
     SET atendente_id = _atendente_id
   WHERE id = _chamado_id
   RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.atribuir_chamado(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atribuir_chamado(uuid, uuid) TO authenticated;

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

COMMENT ON POLICY "Staff atualizam chamados conforme escopo" ON public.chamados IS
'Admin altera qualquer chamado; atendente altera somente chamado sem responsável ou sob sua responsabilidade; gestor somente chamados da própria área.';

COMMENT ON POLICY "Autor cria comentário no próprio chamado ou staff" ON public.comentarios_chamado IS
'Solicitante comenta no próprio chamado; atendente comenta em chamado sem responsável ou sob sua responsabilidade; gestor somente na própria área; notas internas exigem perfil de atendimento.';
