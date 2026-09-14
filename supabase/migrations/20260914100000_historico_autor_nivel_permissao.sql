-- Histórico de chamados: registrar nome e nível de permissão do autor no momento da alteração.
-- Os dados são gravados no histórico para preservar a auditoria mesmo que o nome/papel do usuário mude depois.

ALTER TABLE public.historico_chamado
  ADD COLUMN IF NOT EXISTS autor_nome VARCHAR(120),
  ADD COLUMN IF NOT EXISTS autor_nivel_permissao public.app_role;

CREATE OR REPLACE FUNCTION public.preencher_autor_historico_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.autor_id IS NOT NULL THEN
    IF NEW.autor_nome IS NULL THEN
      SELECT p.nome
        INTO NEW.autor_nome
        FROM public.profiles p
       WHERE p.id = NEW.autor_id;
    END IF;

    IF NEW.autor_nivel_permissao IS NULL THEN
      SELECT CASE
        WHEN public.has_role(NEW.autor_id, 'admin') THEN 'admin'::public.app_role
        WHEN public.has_role(NEW.autor_id, 'gestor') THEN 'gestor'::public.app_role
        WHEN public.has_role(NEW.autor_id, 'atendente') THEN 'atendente'::public.app_role
        ELSE 'colaborador'::public.app_role
      END
      INTO NEW.autor_nivel_permissao;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preencher_autor_historico_chamado ON public.historico_chamado;
CREATE TRIGGER trg_preencher_autor_historico_chamado
BEFORE INSERT ON public.historico_chamado
FOR EACH ROW
EXECUTE FUNCTION public.preencher_autor_historico_chamado();

REVOKE ALL ON FUNCTION public.preencher_autor_historico_chamado() FROM PUBLIC, anon, authenticated;

-- Preenche os registros históricos existentes quando houver autor identificado.
UPDATE public.historico_chamado h
SET
  autor_nome = COALESCE(h.autor_nome, p.nome),
  autor_nivel_permissao = COALESCE(
    h.autor_nivel_permissao,
    CASE
      WHEN public.has_role(h.autor_id, 'admin') THEN 'admin'::public.app_role
      WHEN public.has_role(h.autor_id, 'gestor') THEN 'gestor'::public.app_role
      WHEN public.has_role(h.autor_id, 'atendente') THEN 'atendente'::public.app_role
      ELSE 'colaborador'::public.app_role
    END
  )
FROM public.profiles p
WHERE h.autor_id = p.id;
