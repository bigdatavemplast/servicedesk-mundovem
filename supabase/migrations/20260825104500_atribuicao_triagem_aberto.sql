-- Ao concluir a triagem atribuindo um atendente, o chamado fica ABERTO.
-- O atendimento só entra em andamento quando o atendente iniciar o trabalho.

CREATE OR REPLACE FUNCTION public.registrar_triagem_no_encaminhamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.atendente_id IS DISTINCT FROM OLD.atendente_id
     AND NEW.atendente_id IS NOT NULL
     AND OLD.atendente_id IS NULL THEN
    IF NEW.triagem_por IS NULL THEN
      NEW.triagem_por := auth.uid();
    END IF;

    IF NEW.triagem_em IS NULL THEN
      NEW.triagem_em := now();
    END IF;

    IF NEW.status = 'em_triagem' THEN
      NEW.status := 'aberto';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
