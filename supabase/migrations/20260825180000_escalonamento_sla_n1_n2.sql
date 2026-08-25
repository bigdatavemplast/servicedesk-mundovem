-- Fase 2 — Operação: escalonamento automático N1 -> N2 por SLA.
-- Regra: quando faltar 1 hora ou menos para o SLA de resolução,
-- um chamado elegível de N1 é transferido para um atendente ativo N2
-- do MESMO grupo/fila. O SLA original não é reiniciado.

CREATE OR REPLACE FUNCTION public.executar_escalonamento_sla_n1_n2()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chamado public.chamados%ROWTYPE;
  v_atendente_n2 uuid;
  v_count integer := 0;
BEGIN
  FOR v_chamado IN
    SELECT c.*
      FROM public.chamados c
     WHERE c.grupo_atendimento_id IS NOT NULL
       AND c.prazo_resolucao IS NOT NULL
       AND c.prazo_resolucao > now()
       AND c.prazo_resolucao <= now() + interval '1 hour'
       AND c.status::text IN ('aberto', 'em_andamento')
       AND COALESCE(c.sla_pausado, false) = false
       AND COALESCE(c.escalonamento_nivel, 1) = 1
     ORDER BY c.prazo_resolucao, c.criado_em
  LOOP
    SELECT ga.usuario_id
      INTO v_atendente_n2
      FROM public.grupo_atendentes ga
     WHERE ga.grupo_id = v_chamado.grupo_atendimento_id
       AND ga.ativo = true
       AND upper(trim(ga.nivel_atendimento)) = 'N2'
       AND public.has_any_role(
             ga.usuario_id,
             ARRAY['atendente','gestor','admin']::public.app_role[]
           )
     ORDER BY ga.usuario_id
     LIMIT 1;

    IF v_atendente_n2 IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.chamados
       SET atendente_id = v_atendente_n2,
           escalonamento_nivel = 2,
           escalonado_em = now(),
           atualizado_em = now()
     WHERE id = v_chamado.id;

    INSERT INTO public.historico_chamado (
      chamado_id,
      autor_id,
      acao,
      de,
      para
    ) VALUES (
      v_chamado.id,
      v_atendente_n2,
      'automacao_escalonamento_sla',
      'N1',
      'N2'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.executar_escalonamento_sla_n1_n2()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.executar_escalonamento_sla_n1_n2()
  TO service_role;

INSERT INTO public.automacoes_service_desk (
  nome,
  descricao,
  evento,
  condicoes,
  acao,
  parametros_acao,
  ordem,
  ativo
)
SELECT
  'Escalonar N1 para N2 próximo do vencimento',
  'Quando faltar 1 hora ou menos para o SLA de resolução, transfere o chamado para um atendente N2 ativo da mesma fila, sem reiniciar o SLA.',
  'sla_proximo_vencimento',
  '{"nivel_atual":1,"minutos_restantes":60,"sla_pausado":false}'::jsonb,
  'escalonar',
  '{"proximo_nivel":2,"manter_grupo":true,"reiniciar_sla":false}'::jsonb,
  10,
  true
WHERE NOT EXISTS (
  SELECT 1
    FROM public.automacoes_service_desk
   WHERE evento = 'sla_proximo_vencimento'
     AND acao = 'escalonar'
     AND condicoes ->> 'nivel_atual' = '1'
     AND parametros_acao ->> 'proximo_nivel' = '2'
);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
    FROM cron.job
   WHERE jobname = 'service-desk-escalonamento-sla-n1-n2';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'service-desk-escalonamento-sla-n1-n2',
    '* * * * *',
    $job$SELECT public.executar_escalonamento_sla_n1_n2();$job$
  );
END;
$$;
