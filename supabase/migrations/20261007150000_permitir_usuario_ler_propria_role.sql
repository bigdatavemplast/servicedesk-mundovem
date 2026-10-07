-- Permite que cada usuário autenticado leia apenas as próprias roles.
-- Isso é necessário para que o frontend determine corretamente o acesso
-- ao menu e às rotas de Gestão/Capacidade para gestores.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'user_roles_select_own'
  ) THEN
    CREATE POLICY user_roles_select_own
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
END
$$;
