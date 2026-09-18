-- Garante que todo chamado criado gere uma notificacao de abertura para o solicitante.
-- O trigger e recriado explicitamente para evitar depender de migrations anteriores.

CREATE OR REPLACE FUNCTION public.trigger_notificacoes_chamados()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status_nome TEXT;
BEGIN
  v_status_nome := CASE NEW.status::text
    WHEN 'aberto' THEN 'Aberto'
    WHEN 'em_andamento' THEN 'Em andamento'
    WHEN 'aguardando_usuario' THEN 'Aguardando usuário'
    WHEN 'aguardando_terceiro' THEN 'Aguardando terceiro'
    WHEN 'resolvido' THEN 'Resolvido'
    WHEN 'fechado' THEN 'Fechado'
    WHEN 'cancelado' THEN 'Cancelado'
    ELSE INITCAP(REPLACE(NEW.status::text, '_', ' '))
  END;

  IF TG_OP = 'INSERT' THEN
    IF NEW.solicitante_id IS NOT NULL THEN
      PERFORM public.criar_notificacao_automatica(
        NEW.solicitante_id,
        'chamado_aberto',
        'Chamado criado',
        'O chamado ' || COALESCE(NEW.numero, '') || ' foi criado com sucesso.',
        NEW.id
      );
    END IF;

    IF NEW.atendente_id IS NOT NULL AND NEW.atendente_id <> NEW.solicitante_id THEN
      PERFORM public.criar_notificacao_automatica(
        NEW.atendente_id,
        'chamado_atribuido',
        'Novo chamado atribuído',
        'O chamado ' || COALESCE(NEW.numero, '') || ' foi atribuído a você.',
        NEW.id
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.atendente_id IS DISTINCT FROM OLD.atendente_id AND NEW.atendente_id IS NOT NULL
       AND NEW.atendente_id <> NEW.solicitante_id THEN
      PERFORM public.criar_notificacao_automatica(
        NEW.atendente_id,
        'chamado_atribuido',
        'Chamado atribuído',
        'O chamado ' || COALESCE(NEW.numero, '') || ' foi atribuído a você.',
        NEW.id
      );
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.criar_notificacao_automatica(
        NEW.solicitante_id,
        CASE WHEN NEW.status = 'resolvido' THEN 'chamado_resolvido' ELSE 'status_alterado' END,
        CASE WHEN NEW.status = 'resolvido' THEN 'Chamado resolvido' ELSE 'Status do chamado alterado' END,
        CASE WHEN NEW.status = 'resolvido'
          THEN 'O chamado ' || COALESCE(NEW.numero, '') || ' foi marcado como resolvido.'
          ELSE 'O status do chamado ' || COALESCE(NEW.numero, '') || ' foi alterado para "' || v_status_nome || '".'
        END,
        NEW.id
      );

      IF NEW.atendente_id IS NOT NULL AND NEW.atendente_id <> NEW.solicitante_id THEN
        PERFORM public.criar_notificacao_automatica(
          NEW.atendente_id,
          CASE WHEN NEW.status = 'resolvido' THEN 'chamado_resolvido' ELSE 'status_alterado' END,
          CASE WHEN NEW.status = 'resolvido' THEN 'Chamado resolvido' ELSE 'Status do chamado alterado' END,
          CASE WHEN NEW.status = 'resolvido'
            THEN 'O chamado ' || COALESCE(NEW.numero, '') || ' foi marcado como resolvido.'
            ELSE 'O status do chamado ' || COALESCE(NEW.numero, '') || ' foi alterado para "' || v_status_nome || '".'
          END,
          NEW.id
        );
      END IF;
    END IF;

    IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
      PERFORM public.criar_notificacao_automatica(
        NEW.solicitante_id,
        'status_alterado',
        'Prioridade alterada',
        'A prioridade do chamado ' || COALESCE(NEW.numero, '') || ' foi alterada.',
        NEW.id
      );
      IF NEW.atendente_id IS NOT NULL AND NEW.atendente_id <> NEW.solicitante_id THEN
        PERFORM public.criar_notificacao_automatica(
          NEW.atendente_id,
          'status_alterado',
          'Prioridade alterada',
          'A prioridade do chamado ' || COALESCE(NEW.numero, '') || ' foi alterada.',
          NEW.id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notificacoes_chamados ON public.chamados;
CREATE TRIGGER trg_notificacoes_chamados
AFTER INSERT OR UPDATE ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notificacoes_chamados();
