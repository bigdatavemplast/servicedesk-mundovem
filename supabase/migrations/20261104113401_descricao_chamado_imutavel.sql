-- Impede qualquer alteração da descrição original após a abertura do chamado.
-- A proteção é aplicada no PostgreSQL para todos os perfis, inclusive admin
-- e operações feitas pelo service_role da aplicação. Reabertura e demais
-- atualizações operacionais continuam permitidas quando não alteram descricao.

CREATE OR REPLACE FUNCTION public.impedir_edicao_descricao_original_chamado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.descricao IS DISTINCT FROM OLD.descricao THEN
    RAISE EXCEPTION 'A descrição original do chamado é imutável. Para registrar outro problema, abra um novo chamado.'
      USING ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.impedir_edicao_descricao_original_chamado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_000_bloquear_descricao_original_chamado ON public.chamados;
CREATE TRIGGER trg_000_bloquear_descricao_original_chamado
BEFORE UPDATE OF descricao ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.impedir_edicao_descricao_original_chamado();

COMMENT ON FUNCTION public.impedir_edicao_descricao_original_chamado()
IS 'Bloqueia a edição da descrição original de chamados após sua criação, independentemente do perfil que executa a atualização.';
