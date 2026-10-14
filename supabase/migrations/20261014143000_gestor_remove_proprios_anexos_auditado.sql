-- Permite que gestores removam somente anexos que eles próprios adicionaram
-- em chamados da área vinculada ao seu perfil. A remoção é auditada pela função
-- removerAnexoChamado, que registra o evento no histórico.
DROP POLICY IF EXISTS "Autor remove próprio anexo" ON public.anexos_chamado;
CREATE POLICY "Autor remove próprio anexo"
ON public.anexos_chamado
FOR DELETE
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR (
    autor_id = (SELECT auth.uid())
    AND (
      NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.chamados c
        JOIN public.profiles p ON p.id = (SELECT auth.uid())
        JOIN public.areas a ON a.id = p.area_id
        JOIN public.segmentos s ON s.id = c.segmento_id
        WHERE c.id = anexos_chamado.chamado_id
          AND regexp_replace(lower(coalesce(a.nome, '')), '[^a-z0-9]', '', 'g')
            = regexp_replace(lower(coalesce(s.nome, '')), '[^a-z0-9]', '', 'g')
      )
    )
  )
);

DROP POLICY IF EXISTS "Remover anexo do chamado (storage)" ON storage.objects;
CREATE POLICY "Remover anexo do chamado (storage)"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chamados-anexos'
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      owner = (SELECT auth.uid())
      AND NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
    )
    OR (
      owner = (SELECT auth.uid())
      AND public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
      AND EXISTS (
        SELECT 1
        FROM public.anexos_chamado an
        JOIN public.chamados c ON c.id = an.chamado_id
        JOIN public.profiles p ON p.id = (SELECT auth.uid())
        JOIN public.areas a ON a.id = p.area_id
        JOIN public.segmentos s ON s.id = c.segmento_id
        WHERE an.storage_path = objects.name
          AND an.autor_id = (SELECT auth.uid())
          AND regexp_replace(lower(coalesce(a.nome, '')), '[^a-z0-9]', '', 'g')
            = regexp_replace(lower(coalesce(s.nome, '')), '[^a-z0-9]', '', 'g')
      )
    )
  )
);
