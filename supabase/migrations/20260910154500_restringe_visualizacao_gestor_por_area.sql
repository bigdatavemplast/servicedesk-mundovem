-- Corrige o escopo de leitura do Service Desk.
-- Esta política é RESTRICTIVE para impedir que políticas permissivas antigas
-- continuem expondo chamados de outras áreas.
-- Gestor comum: somente a própria área.
-- Gestor de T.I.: todas as áreas.
-- Atendente/Admin: fila global.
-- Colaborador: somente os próprios chamados.

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

DROP POLICY IF EXISTS "Escopo obrigatório de leitura dos chamados" ON public.chamados;
CREATE POLICY "Escopo obrigatório de leitura dos chamados"
ON public.chamados
AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'atendente')
  OR (
    public.has_role(auth.uid(), 'colaborador')
    AND solicitante_id = auth.uid()
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

COMMENT ON POLICY "Escopo obrigatório de leitura dos chamados" ON public.chamados IS
'Política restritiva: gestor comum somente própria área; gestor de T.I. global; atendente/admin global; colaborador somente próprios chamados.';
