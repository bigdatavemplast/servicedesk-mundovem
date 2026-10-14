-- Permite que gestores abram chamados somente para a área vinculada ao próprio perfil.
-- A política não amplia o escopo de leitura/edição nem afeta colaboradores e atendimento.
DROP POLICY IF EXISTS "Gestor abre chamado na própria área" ON public.chamados;

CREATE POLICY "Gestor abre chamado na própria área"
ON public.chamados
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  AND solicitante_id = auth.uid()
  AND segmento_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.areas a ON a.id = p.area_id
    JOIN public.segmentos s ON lower(trim(s.nome)) = lower(trim(a.nome))
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND a.ativo = true
      AND s.ativo = true
      AND s.id = chamados.segmento_id
  )
);