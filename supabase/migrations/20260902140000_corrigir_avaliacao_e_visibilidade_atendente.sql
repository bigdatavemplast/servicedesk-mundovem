-- Correções do fluxo de avaliação e visibilidade do responsável.
-- A avaliação do solicitante pode concluir Resolvido -> Fechado.
-- O colaborador não recebe permissão geral para alterar status.

CREATE OR REPLACE FUNCTION public.validar_fluxo_status_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_is_requester BOOLEAN := NEW.solicitante_id = v_user;
  v_is_attendant BOOLEAN := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user AND ur.role = 'atendente'
  );
  v_is_manager BOOLEAN := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user AND ur.role = 'gestor'
  );
  v_is_admin BOOLEAN := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user AND ur.role = 'admin'
  );
  v_is_evaluation_close BOOLEAN :=
    NEW.status = 'fechado'
    AND OLD.status = 'resolvido'
    AND OLD.avaliacao_nota IS NULL
    AND NEW.avaliacao_nota IS NOT NULL
    AND v_is_requester;
BEGIN
  IF NEW.status = 'fechado' AND NOT (v_is_requester OR v_is_admin OR v_is_evaluation_close) THEN
    RAISE EXCEPTION 'Somente o solicitante pode fechar o chamado.';
  END IF;

  IF NEW.status = 'resolvido' AND v_is_requester AND NOT (v_is_admin OR v_is_manager) THEN
    RAISE EXCEPTION 'O solicitante não pode resolver o chamado. Aguarde o atendimento.';
  END IF;

  IF NEW.status = 'fechado' AND v_is_attendant AND NOT (v_is_requester OR v_is_admin OR v_is_evaluation_close) THEN
    RAISE EXCEPTION 'Atendente deve colocar o chamado como Resolvido. O fechamento é feito pelo solicitante.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validar_fluxo_status_chamado() IS
'Fluxo: atendimento resolve; avaliação do solicitante conclui Resolvido -> Fechado; colaborador não possui alteração geral de status.';

CREATE OR REPLACE FUNCTION public.avaliar_chamado(
  _chamado_id uuid,
  _nota integer,
  _comentario text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chamado public.chamados%rowtype;
  v_agora timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;
  IF _nota < 1 OR _nota > 5 THEN
    RAISE EXCEPTION 'A nota deve estar entre 1 e 5.';
  END IF;

  SELECT * INTO v_chamado
  FROM public.chamados
  WHERE id = _chamado_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Chamado não encontrado.'; END IF;
  IF v_chamado.solicitante_id <> auth.uid() THEN RAISE EXCEPTION 'Somente o solicitante pode avaliar o chamado.'; END IF;
  IF v_chamado.status <> 'resolvido' THEN RAISE EXCEPTION 'O chamado precisa estar resolvido para ser avaliado.'; END IF;
  IF v_chamado.avaliacao_nota IS NOT NULL THEN RAISE EXCEPTION 'Este chamado já foi avaliado.'; END IF;

  UPDATE public.chamados
     SET avaliacao_nota = _nota,
         avaliacao_comentario = nullif(trim(coalesce(_comentario, '')), ''),
         status = 'fechado',
         fechado_em = v_agora,
         sla_pausado = false
   WHERE id = _chamado_id;

  INSERT INTO public.historico_chamado (chamado_id, autor_id, acao, de, para)
  VALUES (_chamado_id, auth.uid(), 'avaliacao_registrada', 'resolvido', 'fechado');

  RETURN jsonb_build_object('ok', true, 'status', 'fechado', 'avaliacao_nota', _nota, 'fechado_em', v_agora);
END;
$$;

REVOKE ALL ON FUNCTION public.avaliar_chamado(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avaliar_chamado(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.avaliar_chamado(uuid, integer, text) TO service_role;
