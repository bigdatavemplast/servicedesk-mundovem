-- Permite que o admin atribua um chamado diretamente a qualquer perfil de atendimento.
-- A validação anterior considerava somente o grupo do destinatário e podia
-- bloquear uma atribuição legítima feita pelo admin.
-- Quando a alteração vem pelo service role, auth.uid() é nulo; nesse caso
-- mantemos a validação por grupo para operações automáticas/servidor.

CREATE OR REPLACE FUNCTION public.validar_atendente_chamado_por_segmento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_is_admin BOOLEAN := FALSE;
BEGIN
  IF NEW.atendente_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.segmento_id IS NULL THEN
    RAISE EXCEPTION 'Não é possível atribuir atendente a chamado sem segmento.';
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.user_roles ur
       WHERE ur.user_id = v_actor
         AND ur.role = 'admin'
    ) INTO v_actor_is_admin;
  END IF;

  -- Admin pode atribuir diretamente a qualquer usuário com perfil de atendimento.
  IF v_actor_is_admin THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.user_roles ur
       WHERE ur.user_id = NEW.atendente_id
         AND ur.role IN ('atendente','gestor','admin')
    ) THEN
      RAISE EXCEPTION 'O responsável selecionado não possui perfil de atendimento.';
    END IF;
    RETURN NEW;
  END IF;

  -- Alterações executadas com service role não possuem auth.uid().
  -- Mantemos a regra operacional por grupo para não abrir exceção a processos
  -- automáticos que não são uma ação explícita do admin.
  IF NOT EXISTS (
    SELECT 1
      FROM public.grupo_atendentes ga
      JOIN public.grupos_atendimento g
        ON g.id = ga.grupo_id
     WHERE ga.usuario_id = NEW.atendente_id
       AND ga.ativo = TRUE
       AND g.ativo = TRUE
       AND g.segmento_id = NEW.segmento_id
  ) THEN
    RAISE EXCEPTION 'O atendente selecionado não pertence a um grupo ativo do segmento deste chamado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_atendente_chamado_por_segmento
  ON public.chamados;

CREATE TRIGGER trg_validar_atendente_chamado_por_segmento
BEFORE INSERT OR UPDATE OF atendente_id, segmento_id
ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.validar_atendente_chamado_por_segmento();

REVOKE ALL ON FUNCTION public.validar_atendente_chamado_por_segmento() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validar_atendente_chamado_por_segmento() TO service_role;
