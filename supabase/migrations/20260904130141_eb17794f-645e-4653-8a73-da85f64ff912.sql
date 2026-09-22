DROP POLICY IF EXISTS "Autor edita próprio comentário" ON public.comentarios_chamado;

DO $$
BEGIN
  IF to_regprocedure('public.gestao_csat(uuid, timestamptz)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.gestao_csat(uuid, timestamptz) FROM anon;
  END IF;
  IF to_regprocedure('public.gestao_finalizar_metricas_chamado()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.gestao_finalizar_metricas_chamado() FROM anon;
  END IF;
  IF to_regprocedure('public.gestao_marcar_escalonamento()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.gestao_marcar_escalonamento() FROM anon;
  END IF;
  IF to_regprocedure('public.gestao_marcar_primeiro_atendimento()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.gestao_marcar_primeiro_atendimento() FROM anon;
  END IF;
  IF to_regprocedure('public.gestao_reabrir_abandono()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.gestao_reabrir_abandono() FROM anon;
  END IF;
  IF to_regprocedure('public.gestao_recalcular_custos_configuracao()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.gestao_recalcular_custos_configuracao() FROM anon;
  END IF;
  IF to_regprocedure('public.gestao_registrar_acao_atendimento_chamado()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.gestao_registrar_acao_atendimento_chamado() FROM anon;
  END IF;
  IF to_regprocedure('public.gestao_registrar_acao_atendimento_comentario()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.gestao_registrar_acao_atendimento_comentario() FROM anon;
  END IF;
  IF to_regprocedure('public.validar_fluxo_status_chamado()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.validar_fluxo_status_chamado() FROM anon;
  END IF;
END
$$;