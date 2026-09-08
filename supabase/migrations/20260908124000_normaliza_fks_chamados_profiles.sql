-- Normaliza os relacionamentos de chamados -> profiles.
-- Evita que FKs antigas com nomes diferentes criem relacionamentos duplicados
-- e façam o PostgREST rejeitar embeds de solicitante/atendente.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY(c.conkey)
     WHERE c.conrelid = 'public.chamados'::regclass
       AND c.confrelid = 'public.profiles'::regclass
       AND c.contype = 'f'
       AND a.attname IN ('solicitante_id', 'atendente_id')
       AND c.conname NOT IN (
         'chamados_solicitante_profile_fkey',
         'chamados_atendente_profile_fkey'
       )
  LOOP
    EXECUTE format('ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.chamados'::regclass
       AND conname = 'chamados_solicitante_profile_fkey'
  ) THEN
    ALTER TABLE public.chamados
      ADD CONSTRAINT chamados_solicitante_profile_fkey
      FOREIGN KEY (solicitante_id) REFERENCES public.profiles(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.chamados'::regclass
       AND conname = 'chamados_atendente_profile_fkey'
  ) THEN
    ALTER TABLE public.chamados
      ADD CONSTRAINT chamados_atendente_profile_fkey
      FOREIGN KEY (atendente_id) REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
