-- Garante que inclusões e remoções de anexos/fotos gerem histórico no banco.
-- Esta migration é idempotente: funciona tanto se a migration anterior
-- já tiver sido aplicada quanto se ainda não tiver sido executada.

CREATE OR REPLACE FUNCTION public.registrar_historico_interacao_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor_id UUID;
  v_acao TEXT;
  v_de TEXT := '';
  v_para TEXT := '';
  v_chamado_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'comentarios_chamado' THEN
    v_chamado_id := COALESCE(NEW.chamado_id, OLD.chamado_id);
    v_autor_id := COALESCE(NEW.autor_id, OLD.autor_id, auth.uid());

    IF TG_OP = 'INSERT' THEN
      v_acao := CASE WHEN NEW.interno THEN 'nota_interna_adicionada' ELSE 'comentario_adicionado' END;
      v_para := COALESCE(NEW.conteudo, '');
    ELSIF TG_OP = 'DELETE' THEN
      v_acao := CASE WHEN OLD.interno THEN 'nota_interna_removida' ELSE 'comentario_removido' END;
      v_para := COALESCE(OLD.conteudo, '');
    END IF;

  ELSIF TG_TABLE_NAME = 'anexos_chamado' THEN
    v_chamado_id := COALESCE(NEW.chamado_id, OLD.chamado_id);
    v_autor_id := COALESCE(NEW.autor_id, OLD.autor_id, auth.uid());

    IF TG_OP = 'INSERT' THEN
      v_acao := CASE
        WHEN COALESCE(NEW.content_type, '') LIKE 'image/%' THEN 'foto_adicionada'
        ELSE 'anexo_adicionado'
      END;
      v_para := COALESCE(NEW.nome_arquivo, '');
    ELSIF TG_OP = 'DELETE' THEN
      v_acao := CASE
        WHEN COALESCE(OLD.content_type, '') LIKE 'image/%' THEN 'foto_removida'
        ELSE 'anexo_removido'
      END;
      v_para := COALESCE(OLD.nome_arquivo, '');
    END IF;

  ELSIF TG_TABLE_NAME = 'chamados' AND TG_OP = 'INSERT' THEN
    v_chamado_id := NEW.id;
    v_autor_id := COALESCE(NEW.solicitante_id, auth.uid());
    v_acao := 'chamado_criado';
    v_para := COALESCE(NEW.titulo, '');
  END IF;

  IF v_chamado_id IS NOT NULL AND v_acao IS NOT NULL THEN
    INSERT INTO public.historico_chamado (chamado_id, autor_id, acao, de, para)
    VALUES (v_chamado_id, v_autor_id, v_acao, v_de, v_para);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_historico_anexos_chamado ON public.anexos_chamado;
CREATE TRIGGER trg_historico_anexos_chamado
AFTER INSERT OR DELETE ON public.anexos_chamado
FOR EACH ROW
EXECUTE FUNCTION public.registrar_historico_interacao_chamado();

REVOKE ALL ON FUNCTION public.registrar_historico_interacao_chamado() FROM PUBLIC, anon, authenticated;
