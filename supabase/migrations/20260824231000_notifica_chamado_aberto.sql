-- Garante a notificacao de abertura no banco, independentemente do fluxo da aplicacao.
-- Evita duplicidade se a aplicacao ja tiver criado a notificacao.

CREATE OR REPLACE FUNCTION public.notificar_chamado_aberto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.solicitante_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.notificacoes n
     WHERE n.chamado_id = NEW.id
       AND n.destinatario_id = NEW.solicitante_id
       AND n.tipo = 'chamado_aberto'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificacoes (
    destinatario_id,
    tipo,
    titulo,
    mensagem,
    chamado_id
  ) VALUES (
    NEW.solicitante_id,
    'chamado_aberto',
    'Chamado ' || NEW.numero || ' aberto',
    'Seu chamado "' || NEW.titulo || '" foi registrado com sucesso.',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_chamado_aberto
  ON public.chamados;

CREATE TRIGGER trg_notificar_chamado_aberto
AFTER INSERT
ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.notificar_chamado_aberto();

REVOKE ALL ON FUNCTION public.notificar_chamado_aberto() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_chamado_aberto() TO service_role;
