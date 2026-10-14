-- Permite que gestores consultem o histórico dos chamados da própria área.
-- A regra usa a área vinculada ao perfil e o segmento do chamado, alinhada ao escopo do gestor na aplicação.
DROP POLICY IF EXISTS "Ler histórico conforme escopo" ON public.historico_chamado;

CREATE POLICY "Ler histórico conforme escopo"
ON public.historico_chamado
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chamados c
    WHERE c.id = historico_chamado.chamado_id
      AND (
        c.solicitante_id = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR (
          public.has_role((SELECT auth.uid()), 'atendente'::public.app_role)
          AND NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
        )
        OR (
          public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
          AND EXISTS (
            SELECT 1
            FROM public.profiles p
            JOIN public.areas a ON a.id = p.area_id
            JOIN public.segmentos s ON s.id = c.segmento_id
            WHERE p.id = (SELECT auth.uid())
              AND regexp_replace(lower(coalesce(a.nome, '')), '[^a-z0-9]', '', 'g')
                = regexp_replace(lower(coalesce(s.nome, '')), '[^a-z0-9]', '', 'g')
          )
        )
      )
  )
);
