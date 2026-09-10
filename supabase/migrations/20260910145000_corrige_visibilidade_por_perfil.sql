-- Regras de visibilidade dos chamados:
-- colaborador: somente os próprios chamados;
-- atendente: todos os chamados da fila;
-- gestor: chamados da própria área;
-- gestor da área TI: chamados de todas as áreas;
-- admin: todos.

CREATE OR REPLACE FUNCTION public.gestor_mesma_area(_gestor_id uuid, _colaborador_id uuid)
RETURNS boolean
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
        regexp_replace(lower(trim(coalesce(area_gestor.nome, ''))), '[^a-z0-9]', '', 'g') = 'ti'
        OR (
          gestor.area_id IS NOT NULL
          AND colaborador.area_id = gestor.area_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.gestor_mesma_area(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestor_mesma_area(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Colaborador vê chamados abertos de todas as áreas" ON public.chamados;
DROP POLICY IF EXISTS "Atendente/gestor/admin veem todos chamados" ON public.chamados;
DROP POLICY IF EXISTS "Solicitante vê próprios chamados" ON public.chamados;

CREATE POLICY "Chamados visíveis conforme perfil"
ON public.chamados
FOR SELECT TO authenticated
USING (
  auth.uid() = solicitante_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'atendente')
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND public.gestor_mesma_area(auth.uid(), solicitante_id)
  )
);

DROP POLICY IF EXISTS "Ler comentários do chamado" ON public.comentarios_chamado;
CREATE POLICY "Ler comentários conforme escopo"
ON public.comentarios_chamado
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chamados c
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
CREATE POLICY "Ler anexos conforme escopo"
ON public.anexos_chamado
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chamados c
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
CREATE POLICY "Ler histórico conforme escopo"
ON public.historico_chamado
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chamados c
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
