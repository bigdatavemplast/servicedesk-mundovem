-- Gestores só podem alterar status e anexar fotos em chamados da própria área.
-- A autorização de status também é validada na função server-side atualizarChamado.
-- Para anexos, esta migration fecha o bypass por upload direto ao Supabase Storage.

DROP POLICY IF EXISTS "Autor anexa no chamado" ON public.anexos_chamado;
CREATE POLICY "Autor anexa no chamado"
ON public.anexos_chamado
FOR INSERT
TO authenticated
WITH CHECK (
  autor_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.chamados c
    WHERE c.id = anexos_chamado.chamado_id
      AND (
        public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR (
          public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
          AND NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
          AND lower(coalesce(anexos_chamado.content_type, '')) LIKE 'image/%'
          AND EXISTS (
            SELECT 1
            FROM public.profiles p
            JOIN public.areas a ON a.id = p.area_id
            JOIN public.segmentos s ON s.id = c.segmento_id
            WHERE p.id = (SELECT auth.uid())
              AND regexp_replace(lower(trim(coalesce(a.nome, ''))), '[^a-z0-9]', '', 'g')
                = regexp_replace(lower(trim(coalesce(s.nome, ''))), '[^a-z0-9]', '', 'g')
          )
        )
        OR (
          NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
          AND (
            c.solicitante_id = (SELECT auth.uid())
            OR (
              public.has_role((SELECT auth.uid()), 'atendente'::public.app_role)
              AND EXISTS (
                SELECT 1 FROM public.profiles p
                JOIN public.areas a ON a.id = p.area_id
                JOIN public.segmentos s ON s.id = c.segmento_id
                WHERE p.id = (SELECT auth.uid())
                  AND regexp_replace(lower(trim(coalesce(a.nome, ''))), '[^a-z0-9]', '', 'g')
                    = regexp_replace(lower(trim(coalesce(s.nome, ''))), '[^a-z0-9]', '', 'g')
              )
            )
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Enviar anexo do chamado (storage)" ON storage.objects;
CREATE POLICY "Enviar anexo do chamado (storage)"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chamados-anexos'
  AND owner = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.chamados c
    WHERE c.id::text = split_part(objects.name, '/', 1)
      AND (
        public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR (
          public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
          AND NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
          AND (lower(objects.name) LIKE '%.png' OR lower(objects.name) LIKE '%.jpg' OR lower(objects.name) LIKE '%.jpeg' OR lower(objects.name) LIKE '%.webp')
          AND EXISTS (
            SELECT 1
            FROM public.profiles p
            JOIN public.areas a ON a.id = p.area_id
            JOIN public.segmentos s ON s.id = c.segmento_id
            WHERE p.id = (SELECT auth.uid())
              AND regexp_replace(lower(trim(coalesce(a.nome, ''))), '[^a-z0-9]', '', 'g')
                = regexp_replace(lower(trim(coalesce(s.nome, ''))), '[^a-z0-9]', '', 'g')
          )
        )
        OR (
          NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
          AND (
            c.solicitante_id = (SELECT auth.uid())
            OR public.has_role((SELECT auth.uid()), 'atendente'::public.app_role)
          )
        )
      )
  )
);
