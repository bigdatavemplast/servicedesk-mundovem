-- Permite que gestores complementem chamados da própria área com anexos,
-- mantendo a leitura dos arquivos e metadados no mesmo escopo de área do histórico.
-- Gestores podem adicionar arquivos, mas a interface e a função de histórico impedem remoções.
DROP POLICY IF EXISTS "Ler anexos conforme escopo" ON public.anexos_chamado;
CREATE POLICY "Ler anexos conforme escopo"
ON public.anexos_chamado
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chamados c
    WHERE c.id = anexos_chamado.chamado_id
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

DROP POLICY IF EXISTS "Ler anexos do chamado (storage)" ON storage.objects;
CREATE POLICY "Ler anexos do chamado (storage)"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chamados-anexos'
  AND EXISTS (
    SELECT 1
    FROM public.chamados c
    WHERE c.id::text = split_part(objects.name, '/', 1)
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

DROP POLICY IF EXISTS "Enviar anexo do chamado (storage)" ON storage.objects;
CREATE POLICY "Enviar anexo do chamado (storage)"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chamados-anexos'
  AND owner = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.chamados c
    WHERE c.id::text = split_part(objects.name, '/', 1)
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
