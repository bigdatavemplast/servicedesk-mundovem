-- Restaura a regra de atribuição manual: o atendente precisa pertencer
-- a um grupo ativo do mesmo segmento do chamado.

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
      FROM public.grupo_atendentes ga
      JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
     WHERE ga.usuario_id = NEW.atendente_id
       AND ga.ativo = TRUE
       AND g.ativo = TRUE
       AND g.segmento_id = NEW.segmento_id
  ) THEN
    RAISE EXCEPTION 'O atendente selecionado não pertence ao grupo ativo deste chamado.';
  END IF;

  RETURN NEW;
END;
$$;
