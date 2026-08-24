-- Triagem não cria uma segunda classificação de negócio.
-- O nível técnico permanece apenas no vínculo atendente/grupo.
-- Removemos os campos operacionais de nível/complexidade do chamado.

DROP TRIGGER IF EXISTS trg_validar_nivel_atendente_chamado ON public.chamados;
DROP FUNCTION IF EXISTS public.validar_nivel_atendente_chamado();

ALTER TABLE public.chamados
  DROP COLUMN IF EXISTS nivel_atendimento,
  DROP COLUMN IF EXISTS complexidade;

CREATE OR REPLACE FUNCTION public.validar_atendente_grupo_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.atendente_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(NEW.atendente_id, 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.grupo_atendimento_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.grupo_atendentes ga
    WHERE ga.grupo_id = NEW.grupo_atendimento_id
      AND ga.usuario_id = NEW.atendente_id
      AND ga.ativo = TRUE
  ) THEN
    RAISE EXCEPTION 'O atendente selecionado não pertence ao grupo ativo deste chamado.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_atendente_grupo_chamado
BEFORE INSERT OR UPDATE OF atendente_id, grupo_atendimento_id
ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.validar_atendente_grupo_chamado();

REVOKE ALL ON FUNCTION public.validar_atendente_grupo_chamado() FROM PUBLIC, anon, authenticated;
