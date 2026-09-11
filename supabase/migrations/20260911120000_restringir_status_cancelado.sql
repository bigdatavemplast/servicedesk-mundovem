-- O status cancelado pode ser aplicado somente por administradores ou gestores.
-- Esta regra e independente da logica de SLA e nao altera nenhum comportamento de SLA.

CREATE OR REPLACE FUNCTION public.impedir_cancelamento_sem_permissao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pode_cancelar boolean := false;
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelado' OR OLD.status IS NOT DISTINCT FROM 'cancelado' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
      AND ur.role IN ('admin', 'gestor')
  ) INTO v_pode_cancelar;

  IF NOT v_pode_cancelar THEN
    RAISE EXCEPTION 'Somente administradores ou gestores podem cancelar chamados.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restringir_status_cancelado ON public.chamados;

CREATE TRIGGER trg_restringir_status_cancelado
BEFORE UPDATE OF status ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.impedir_cancelamento_sem_permissao();
