-- O colaborador não altera status manualmente.
-- O fluxo de avaliação, porém, precisa conseguir concluir o chamado:
-- Resolvido -> Fechado.
-- Esta migration registra uma função segura para o fluxo de avaliação usar.

CREATE OR REPLACE FUNCTION public.fechar_chamado_apos_avaliacao(p_chamado_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
    FROM public.chamados
   WHERE id = p_chamado_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado';
  END IF;

  -- Somente chamados já resolvidos podem ser fechados pela conclusão da avaliação.
  IF v_status <> 'resolvido' THEN
    RAISE EXCEPTION 'Somente chamados resolvidos podem ser fechados após avaliação';
  END IF;

  UPDATE public.chamados
     SET status = 'fechado',
         fechado_em = COALESCE(fechado_em, NOW())
   WHERE id = p_chamado_id
     AND status = 'resolvido';

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.fechar_chamado_apos_avaliacao(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_chamado_apos_avaliacao(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_chamado_apos_avaliacao(UUID) TO service_role;

COMMENT ON FUNCTION public.fechar_chamado_apos_avaliacao(UUID) IS
'Fecha automaticamente um chamado resolvido após a avaliação CSAT. Não concede ao colaborador permissão geral para alterar status.';
