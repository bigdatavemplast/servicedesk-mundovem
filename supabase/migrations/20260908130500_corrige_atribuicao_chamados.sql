-- Garante que a atribuição de chamados possa ser persistida pelo usuário autenticado.
-- A autorização continua sendo feita na aplicação e pela policy de UPDATE.
-- O trigger abaixo não substitui a autorização: apenas normaliza a operação de atribuição.

CREATE OR REPLACE FUNCTION public.atribuir_chamado(
  _chamado_id uuid,
  _atendente_id uuid
)
RETURNS public.chamados
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_chamado public.chamados;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['atendente','gestor','admin']::public.app_role[]) THEN
    RAISE EXCEPTION 'Você não tem permissão para atribuir o chamado.';
  END IF;

  IF _atendente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.user_roles ur
     WHERE ur.user_id = _atendente_id
       AND ur.role = 'atendente'
  ) THEN
    RAISE EXCEPTION 'O responsável selecionado não possui perfil de atendimento.';
  END IF;

  UPDATE public.chamados
     SET atendente_id = _atendente_id
   WHERE id = _chamado_id
  RETURNING * INTO v_chamado;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;

  RETURN v_chamado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atribuir_chamado(uuid, uuid) TO authenticated;
