-- Regra: chamados resolvidos/fechados sem avaliação recebem 5 estrelas após 48h.
CREATE OR REPLACE FUNCTION public.auto_avaliar_chamados_expirados()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chamado public.chamados%rowtype;
  v_agora timestamptz := now();
BEGIN
  FOR v_chamado IN
    SELECT *
    FROM public.chamados
    WHERE status IN ('resolvido', 'fechado')
      AND avaliacao_nota IS NULL
      AND resolvido_em IS NOT NULL
      AND resolvido_em <= v_agora - interval '48 hours'
    FOR UPDATE
  LOOP
    UPDATE public.chamados
       SET avaliacao_nota = 5,
           avaliacao_comentario = 'Avaliação automática: o colaborador não avaliou o chamado dentro de 48 horas após a resolução.',
           status = CASE WHEN status = 'resolvido' THEN 'fechado' ELSE status END,
           fechado_em = CASE
             WHEN status = 'resolvido' THEN coalesce(fechado_em, v_agora)
             ELSE fechado_em
           END,
           sla_pausado = false
     WHERE id = v_chamado.id;

    INSERT INTO public.historico_chamado(chamado_id, autor_id, acao, de, para)
    VALUES (
      v_chamado.id,
      NULL,
      'avaliacao_automatica',
      v_chamado.status,
      'fechado — 5 estrelas automáticas'
    );
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.auto_avaliar_chamados_expirados() IS
'Após 48 horas da resolução, atribui automaticamente 5 estrelas a chamados resolvidos ou fechados sem avaliação do colaborador.';
