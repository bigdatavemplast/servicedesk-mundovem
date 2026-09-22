-- A triagem é a decisão operacional de encaminhar o chamado.
-- Não cria uma nova classificação de negócio.
-- Ao definir um atendente, registramos automaticamente quem fez a triagem e quando.
-- O status passa de em_triagem para em_andamento quando o destino é definido.

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
      NEW.status := 'em_andamento';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrar_triagem_no_encaminhamento ON public.chamados;

CREATE TRIGGER trg_registrar_triagem_no_encaminhamento
BEFORE UPDATE OF atendente_id
ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.registrar_triagem_no_encaminhamento();

REVOKE ALL ON FUNCTION public.registrar_triagem_no_encaminhamento() FROM PUBLIC, anon, authenticated;
