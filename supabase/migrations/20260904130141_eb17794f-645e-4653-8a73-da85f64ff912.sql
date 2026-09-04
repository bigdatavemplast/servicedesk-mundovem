DROP POLICY IF EXISTS "Autor edita próprio comentário" ON public.comentarios_chamado;

REVOKE EXECUTE ON FUNCTION public.gestao_csat(uuid, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gestao_finalizar_metricas_chamado() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gestao_marcar_escalonamento() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gestao_marcar_primeiro_atendimento() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gestao_reabrir_abandono() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gestao_recalcular_custos_configuracao() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gestao_registrar_acao_atendimento_chamado() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gestao_registrar_acao_atendimento_comentario() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validar_fluxo_status_chamado() FROM anon;