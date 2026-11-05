-- Fotos privadas vinculadas diretamente aos comentários do Service Desk.
-- O acesso às fotos acompanha a visibilidade do comentário (inclusive notas internas).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comentarios-anexos',
  'comentarios-anexos',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']::text[];

CREATE TABLE IF NOT EXISTS public.comentarios_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id uuid NOT NULL REFERENCES public.comentarios_chamado(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES public.profiles(id),
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 10485760),
  content_type text NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comentarios_anexos_comentario_id_idx
  ON public.comentarios_anexos (comentario_id);

ALTER TABLE public.comentarios_anexos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.comentarios_anexos TO authenticated;

DROP POLICY IF EXISTS "Usuários leem fotos de comentários visíveis" ON public.comentarios_anexos;
CREATE POLICY "Usuários leem fotos de comentários visíveis"
ON public.comentarios_anexos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.comentarios_chamado c
    WHERE c.id = comentarios_anexos.comentario_id
  )
);

DROP POLICY IF EXISTS "Atendimento anexa fotos aos próprios comentários" ON public.comentarios_anexos;
CREATE POLICY "Atendimento anexa fotos aos próprios comentários"
ON public.comentarios_anexos
FOR INSERT TO authenticated
WITH CHECK (
  autor_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.comentarios_chamado c
    WHERE c.id = comentarios_anexos.comentario_id
      AND c.autor_id = (SELECT auth.uid())
  )
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      public.has_role((SELECT auth.uid()), 'atendente'::public.app_role)
      AND NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
    )
  )
);

DROP POLICY IF EXISTS "Upload de fotos vinculadas a comentários" ON storage.objects;
CREATE POLICY "Upload de fotos vinculadas a comentários"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'comentarios-anexos'
  AND owner = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.comentarios_chamado c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.autor_id = (SELECT auth.uid())
  )
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      public.has_role((SELECT auth.uid()), 'atendente'::public.app_role)
      AND NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
    )
  )
);

DROP POLICY IF EXISTS "Leitura de fotos conforme visibilidade do comentário" ON storage.objects;
CREATE POLICY "Leitura de fotos conforme visibilidade do comentário"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'comentarios-anexos'
  AND EXISTS (
    SELECT 1 FROM public.comentarios_anexos a
    WHERE a.storage_path = objects.name
  )
);
