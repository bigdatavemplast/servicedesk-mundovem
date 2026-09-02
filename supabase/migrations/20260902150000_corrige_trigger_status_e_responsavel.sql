-- Correção definitiva do fluxo de avaliação e da exibição do atendente.
--
-- 1) Remove triggers antigos de status que ainda bloqueiam o fechamento
--    com a mensagem "Somente a equipe de atendimento pode alterar o status do chamado".
-- 2) Recria o trigger oficial usando validar_fluxo_status_chamado().
-- 3) Cria a FK chamados.atendente_id -> profiles.id para permitir que
--    o Supabase faça o relacionamento atendente:profiles na consulta.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name,
           t.tgname AS trigger_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE n.nspname = 'public'
       AND c.relname = 'chamados'
       AND NOT t.tgisinternal
       AND p.prosrc ILIKE '%Somente a equipe de atendimento pode alterar o status do chamado%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', r.trigger_name, r.schema_name, r.table_name);
  END LOOP;
END $$;

-- Garante que o trigger oficial exista e use a função atualizada.
DROP TRIGGER IF EXISTS trg_validar_fluxo_status_chamado ON public.chamados;
CREATE TRIGGER trg_validar_fluxo_status_chamado
BEFORE UPDATE OF status ON public.chamados
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.validar_fluxo_status_chamado();

-- O atendente é um profile. A FK original aponta para auth.users para integridade
-- de identidade, mas o relacionamento explícito com profiles é necessário para
-- consultas PostgREST/Supabase do tipo atendente:profiles(...).
DO $$
BEGIN
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

CREATE INDEX IF NOT EXISTS idx_chamados_atendente_profile
  ON public.chamados(atendente_id);

COMMENT ON CONSTRAINT chamados_atendente_profile_fkey ON public.chamados IS
'Relaciona o responsável do chamado ao perfil para exibição do nome do atendente.';
