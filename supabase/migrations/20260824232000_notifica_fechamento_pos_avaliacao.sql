-- ============================================================
-- Notificacao de fechamento apos avaliacao
-- ============================================================
-- O fechamento do chamado ocorre pela funcao avaliar_chamado.
-- O solicitante ja recebeu a etapa de resolucao; ao fechar,
-- avisamos o atendente responsavel pelo chamado.
-- Mantemos o tipo existente status_alterado para nao alterar
-- o enum sem necessidade.

CREATE OR REPLACE FUNCTION public.notificar_fechamento_pos_avaliacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atendente_id uuid;
BEGIN
  IF NEW.status <> 'fechado' OR OLD.status = 'fechado' THEN
    RETURN NEW;
  END IF;

  v_atendente_id := NEW.atendente_id;

  IF v_atendente_id IS NULL OR v_atendente_id = NEW.solicitante_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificacoes (
    destinatario_id,
    tipo,
    titulo,
    mensagem,
    chamado_id
  ) VALUES (
    v_atendente_id,
    'status_alterado',
    'Chamado ' || NEW.numero || ' fechado',
    'O chamado "' || NEW.titulo || '" foi fechado após a avaliação do solicitante.',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_fechamento_pos_avaliacao
  ON public.chamados;

CREATE TRIGGER trg_notificar_fechamento_pos_avaliacao
AFTER UPDATE OF status
ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.notificar_fechamento_pos_avaliacao();

REVOKE ALL ON FUNCTION public.notificar_fechamento_pos_avaliacao() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_fechamento_pos_avaliacao() TO service_role;
