-- Fluxo oficial de status:
-- ATENDENTE: pode levar o chamado até RESOLVIDO, mas nunca FECHADO.
-- COLABORADOR: não resolve; após RESOLVIDO, pode FECHAR (e pode reabrir dentro da regra vigente).
-- GESTOR/ADMIN: podem operar o atendimento; o fechamento segue reservado ao solicitante,
-- salvo futuras regras administrativas explícitas.

CREATE OR REPLACE FUNCTION public.validar_fluxo_status_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_is_requester BOOLEAN := NEW.solicitante_id = v_user;
  v_is_attendant BOOLEAN := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user AND ur.role = 'atendente'
  );
  v_is_manager BOOLEAN := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user AND ur.role = 'gestor'
  );
  v_is_admin BOOLEAN := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user AND ur.role = 'admin'
  );
BEGIN
  IF NEW.status = 'fechado' AND NOT (v_is_requester OR v_is_admin) THEN
    RAISE EXCEPTION 'Somente o solicitante pode fechar o chamado.';
  END IF;

  IF NEW.status = 'resolvido' AND v_is_requester AND NOT (v_is_admin OR v_is_manager) THEN
    RAISE EXCEPTION 'O solicitante não pode resolver o chamado. Aguarde o atendimento.';
  END IF;

  -- Atendente pode resolver, mas nunca fechar.
  IF NEW.status = 'fechado' AND v_is_attendant AND NOT (v_is_requester OR v_is_admin) THEN
    RAISE EXCEPTION 'Atendente deve colocar o chamado como Resolvido. O fechamento é feito pelo solicitante.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_fluxo_status_chamado ON public.chamados;
CREATE TRIGGER trg_validar_fluxo_status_chamado
BEFORE UPDATE OF status ON public.chamados
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.validar_fluxo_status_chamado();

COMMENT ON FUNCTION public.validar_fluxo_status_chamado() IS
'Fluxo oficial: atendente resolve; solicitante fecha; solicitante nao resolve.';
