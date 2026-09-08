-- Repara os relacionamentos usados pela fila/detalhe de chamados.
-- A fila depende do relacionamento explícito com profiles para exibir o responsável.
-- O IF NOT EXISTS torna a migration segura caso a constraint já exista.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.chamados'::regclass
       AND conname = 'chamados_solicitante_profile_fkey'
  ) THEN
    ALTER TABLE public.chamados
      ADD CONSTRAINT chamados_solicitante_profile_fkey
      FOREIGN KEY (solicitante_id) REFERENCES public.profiles(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.chamados'::regclass
       AND conname = 'chamados_atendente_profile_fkey'
  ) THEN
    ALTER TABLE public.chamados
      ADD CONSTRAINT chamados_atendente_profile_fkey
      FOREIGN KEY (atendente_id) REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chamados_solicitante_profile
  ON public.chamados(solicitante_id);

CREATE INDEX IF NOT EXISTS idx_chamados_atendente_profile
  ON public.chamados(atendente_id);

-- Faz o PostgREST/Supabase reprocessar os relacionamentos imediatamente após a migration.
NOTIFY pgrst, 'reload schema';
