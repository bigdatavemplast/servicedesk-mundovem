-- ============================================================
-- Notifica o solicitante quando o chamado é assumido/atribuído
-- ============================================================
-- O atendente continua recebendo a notificacao chamado_atribuido
-- pelo fluxo da aplicacao.
-- Aqui avisamos tambem o solicitante usando o tipo existente
-- status_alterado, sem criar novo valor no enum.

CREATE OR REPLACE FUNCTION public.notificar_solicitante_atribuicao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atendente_nome text;
BEGIN
  IF NEW.atendente_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.atendente_id IS NOT DISTINCT FROM NEW.atendente_id THEN
    RETURN NEW;
  END IF;

  -- Nao envia para o proprio solicitante caso ele seja o destinatario.
  IF NEW.solicitante_id IS NULL OR NEW.solicitante_id = NEW.atendente_id THEN
    RETURN NEW;
  END IF;

  SELECT p.nome
    INTO v_atendente_nome
    FROM public.profiles p
   WHERE p.id = NEW.atendente_id;

  INSERT INTO public.notificacoes (
    destinatario_id,
    tipo,
    titulo,
    mensagem,
    chamado_id
  ) VALUES (
    NEW.solicitante_id,
    'status_alterado',
    'Chamado ' || NEW.numero || ' assumido',
    'Seu chamado foi assumido por ' || COALESCE(v_atendente_nome, 'um atendente do Service Desk') || '.',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_solicitante_atribuicao
  ON public.chamados;

CREATE TRIGGER trg_notificar_solicitante_atribuicao
AFTER UPDATE OF atendente_id
ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.notificar_solicitante_atribuicao();

REVOKE ALL ON FUNCTION public.notificar_solicitante_atribuicao() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_solicitante_atribuicao() TO service_role;
