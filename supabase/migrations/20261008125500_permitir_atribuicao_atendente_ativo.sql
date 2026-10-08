-- Permite atribuição manual a qualquer atendente ativo.
-- A área/segmento do chamado não restringe mais a escolha do responsável;
-- regras de grupo continuam disponíveis para automações de fila/escalonamento.

CREATE OR REPLACE FUNCTION public.validar_atendente_grupo_chamado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.atendente_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(NEW.atendente_id, 'admin') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
     WHERE ur.user_id = NEW.atendente_id
       AND ur.role = 'atendente'
       AND p.ativo = TRUE
  ) THEN
    RAISE EXCEPTION 'O atendente selecionado não possui um perfil de atendimento ativo.';
  END IF;

  RETURN NEW;
END;
$$;
