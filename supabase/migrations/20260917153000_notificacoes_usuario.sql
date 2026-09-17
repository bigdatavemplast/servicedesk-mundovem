-- ============================================================
-- Notificações do usuário no Service Desk
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chamado_id UUID REFERENCES public.chamados(id) ON DELETE CASCADE,
  tipo public.tipo_notificacao NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  mensagem TEXT,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_destinatario_criado
  ON public.notificacoes(destinatario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_nao_lidas
  ON public.notificacoes(destinatario_id, lida)
  WHERE lida = FALSE;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário vê próprias notificações" ON public.notificacoes;
CREATE POLICY "Usuário vê próprias notificações"
  ON public.notificacoes FOR SELECT TO authenticated
  USING (auth.uid() = destinatario_id);

DROP POLICY IF EXISTS "Usuário atualiza próprias notificações" ON public.notificacoes;
CREATE POLICY "Usuário atualiza próprias notificações"
  ON public.notificacoes FOR UPDATE TO authenticated
  USING (auth.uid() = destinatario_id)
  WITH CHECK (auth.uid() = destinatario_id);

DROP POLICY IF EXISTS "Usuário exclui próprias notificações" ON public.notificacoes;
CREATE POLICY "Usuário exclui próprias notificações"
  ON public.notificacoes FOR DELETE TO authenticated
  USING (auth.uid() = destinatario_id);

-- Insere notificações com SECURITY DEFINER para que as alterações nos chamados
-- possam gerar notificações mesmo quando o usuário não tem acesso direto de INSERT.
CREATE OR REPLACE FUNCTION public.criar_notificacao_usuario(
  p_destinatario UUID,
  p_chamado UUID,
  p_tipo public.tipo_notificacao,
  p_titulo TEXT,
  p_mensagem TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_destinatario IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notificacoes (destinatario_id, chamado_id, tipo, titulo, mensagem)
  VALUES (p_destinatario, p_chamado, p_tipo, p_titulo, p_mensagem);
END;
$$;

CREATE OR REPLACE FUNCTION public.notificar_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.criar_notificacao_usuario(
      NEW.solicitante_id,
      NEW.id,
      'chamado_aberto',
      'Chamado criado',
      'O chamado ' || NEW.numero || ' foi criado: ' || NEW.titulo
    );

    IF NEW.atendente_id IS NOT NULL AND NEW.atendente_id <> NEW.solicitante_id THEN
      PERFORM public.criar_notificacao_usuario(
        NEW.atendente_id,
        NEW.id,
        'chamado_atribuido',
        'Novo chamado atribuído',
        'O chamado ' || NEW.numero || ' foi atribuído a você: ' || NEW.titulo
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.atendente_id IS DISTINCT FROM OLD.atendente_id AND NEW.atendente_id IS NOT NULL THEN
      IF NEW.atendente_id <> NEW.solicitante_id THEN
        PERFORM public.criar_notificacao_usuario(
          NEW.atendente_id,
          NEW.id,
          'chamado_atribuido',
          'Chamado atribuído a você',
          'O chamado ' || NEW.numero || ' foi atribuído a você: ' || NEW.titulo
        );
      END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.criar_notificacao_usuario(
        NEW.solicitante_id,
        NEW.id,
        CASE WHEN NEW.status = 'resolvido' THEN 'chamado_resolvido' ELSE 'status_alterado' END,
        CASE WHEN NEW.status = 'resolvido' THEN 'Chamado resolvido' ELSE 'Status do chamado alterado' END,
        'O chamado ' || NEW.numero || ' agora está como ' || replace(NEW.status::text, '_', ' ') || '.'
      );

      IF NEW.atendente_id IS NOT NULL AND NEW.atendente_id <> NEW.solicitante_id THEN
        PERFORM public.criar_notificacao_usuario(
          NEW.atendente_id,
          NEW.id,
          CASE WHEN NEW.status = 'resolvido' THEN 'chamado_resolvido' ELSE 'status_alterado' END,
          CASE WHEN NEW.status = 'resolvido' THEN 'Chamado resolvido' ELSE 'Status do chamado alterado' END,
          'O chamado ' || NEW.numero || ' agora está como ' || replace(NEW.status::text, '_', ' ') || '.'
        );
      END IF;
    END IF;

    IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
      PERFORM public.criar_notificacao_usuario(
        NEW.solicitante_id,
        NEW.id,
        'status_alterado',
        'Prioridade do chamado alterada',
        'A prioridade do chamado ' || NEW.numero || ' foi alterada para ' || NEW.prioridade::text || '.'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_chamado ON public.chamados;
CREATE TRIGGER trg_notificar_chamado
AFTER INSERT OR UPDATE OF atendente_id, status, prioridade ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.notificar_chamado();

-- Habilita entrega em tempo real das novas notificações.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notificacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
  END IF;
END $$;
