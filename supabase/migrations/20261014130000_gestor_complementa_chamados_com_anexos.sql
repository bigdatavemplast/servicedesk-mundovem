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
  AND owner = (SELECT auth.uid())
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

-- Gestores não removem anexos, mesmo por chamadas diretas à API.
DROP POLICY IF EXISTS "Autor remove próprio anexo" ON public.anexos_chamado;
CREATE POLICY "Autor remove próprio anexo"
ON public.anexos_chamado
FOR DELETE
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR (
    autor_id = (SELECT auth.uid())
    AND NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
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
  )
);

-- Corrige também a leitura e a inserção de comentários para usar a área do chamado,
-- e não a área do solicitante (que pode divergir do segmento atendido).
DROP POLICY IF EXISTS "Ler comentários conforme escopo" ON public.comentarios_chamado;
CREATE POLICY "Ler comentários conforme escopo"
ON public.comentarios_chamado
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chamados c
    WHERE c.id = comentarios_chamado.chamado_id
      AND (
        (c.solicitante_id = (SELECT auth.uid()) AND comentarios_chamado.interno = false)
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR (
          public.has_role((SELECT auth.uid()), 'atendente'::public.app_role)
          AND NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
        )
        OR (
          public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
          AND comentarios_chamado.interno = false
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

DROP POLICY IF EXISTS "Autor cria comentário no próprio chamado ou staff" ON public.comentarios_chamado;
CREATE POLICY "Autor cria comentário no próprio chamado ou staff"
ON public.comentarios_chamado
FOR INSERT
TO authenticated
WITH CHECK (
  autor_id = (SELECT auth.uid())
  AND (
    (EXISTS (
      SELECT 1 FROM public.chamados c
      WHERE c.id = comentarios_chamado.chamado_id AND c.solicitante_id = (SELECT auth.uid())
    ) AND NOT comentarios_chamado.interno)
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      public.has_role((SELECT auth.uid()), 'atendente'::public.app_role)
      AND NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.chamados c
        WHERE c.id = comentarios_chamado.chamado_id
          AND (c.atendente_id IS NULL OR c.atendente_id = (SELECT auth.uid()))
      )
    )
    OR (
      public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
      AND NOT comentarios_chamado.interno
      AND EXISTS (
        SELECT 1
        FROM public.chamados c
        JOIN public.profiles p ON p.id = (SELECT auth.uid())
        JOIN public.areas a ON a.id = p.area_id
        JOIN public.segmentos s ON s.id = c.segmento_id
        WHERE c.id = comentarios_chamado.chamado_id
          AND regexp_replace(lower(coalesce(a.nome, '')), '[^a-z0-9]', '', 'g')
            = regexp_replace(lower(coalesce(s.nome, '')), '[^a-z0-9]', '', 'g')
      )
    )
  )
  AND (
    NOT comentarios_chamado.interno
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      public.has_role((SELECT auth.uid()), 'atendente'::public.app_role)
      AND NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
    )
  )
);
