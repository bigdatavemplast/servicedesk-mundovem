-- Fase 2 — Operação: motor genérico de escalonamento por regras da tela de Automações.
-- Mantém a função e o cron existentes, mas passa a interpretar todas as regras
-- ativas de evento sla_proximo_vencimento cadastradas em automacoes_service_desk.
--
-- Compatibilidade:
-- chamados.escalonamento_nivel = 0 representa N1 inicial.
-- As regras da tela usam nivel_atual 1 para N1, 2 para N2 e 3 para N3.

CREATE OR REPLACE FUNCTION public.executar_escalonamento_sla_n1_n2()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regra public.automacoes_service_desk%ROWTYPE;
  v_chamado public.chamados%ROWTYPE;
  v_atendente uuid;
  v_nivel_atual integer;
  v_nivel_regra integer;
  v_proximo_nivel integer;
  v_minutos_restantes numeric;
  v_limite_minutos numeric;
  v_sla_pausado boolean;
  v_count integer := 0;
BEGIN
  FOR v_regra IN
    SELECT *
      FROM public.automacoes_service_desk
     WHERE ativo = true
       AND evento = 'sla_proximo_vencimento'
       AND acao = 'escalonar'
     ORDER BY ordem, criado_em
  LOOP
    v_nivel_regra := NULLIF(v_regra.condicoes ->> 'nivel_atual', '')::integer;
    v_limite_minutos := NULLIF(v_regra.condicoes ->> 'minutos_restantes', '')::numeric;
    v_sla_pausado := COALESCE((v_regra.condicoes ->> 'sla_pausado')::boolean, false);
    v_proximo_nivel := NULLIF(v_regra.parametros_acao ->> 'proximo_nivel', '')::integer;

    IF v_nivel_regra IS NULL OR v_limite_minutos IS NULL OR v_proximo_nivel IS NULL THEN
      CONTINUE;
    END IF;

    FOR v_chamado IN
      SELECT c.*
        FROM public.chamados c
       WHERE c.grupo_atendimento_id IS NOT NULL
         AND c.atendente_id IS NOT NULL
         AND c.prazo_resolucao IS NOT NULL
         AND c.prazo_resolucao > now()
         AND c.status::text IN ('aberto', 'em_andamento')
         AND COALESCE(c.sla_pausado, false) = v_sla_pausado
         -- 0 é o nível persistido que representa N1.
         AND CASE
               WHEN COALESCE(c.escalonamento_nivel, 0) = 0 THEN 1
               ELSE c.escalonamento_nivel
             END = v_nivel_regra
         -- Impede que uma regra inferior seja aplicada depois de o chamado
         -- já ter atingido um nível igual ou superior ao próximo nível.
         AND v_proximo_nivel > CASE
               WHEN COALESCE(c.escalonamento_nivel, 0) = 0 THEN 1
               ELSE c.escalonamento_nivel
             END
         AND EXTRACT(EPOCH FROM (c.prazo_resolucao - now())) / 60.0 <= v_limite_minutos
       ORDER BY c.prazo_resolucao, c.criado_em
    LOOP
      SELECT ga.usuario_id
        INTO v_atendente
        FROM public.grupo_atendentes ga
       WHERE ga.grupo_id = v_chamado.grupo_atendimento_id
         AND ga.ativo = true
         AND upper(trim(ga.nivel_atendimento)) = 'N' || v_proximo_nivel::text
         AND public.has_any_role(
               ga.usuario_id,
               ARRAY['atendente','gestor','admin']::public.app_role[]
             )
       ORDER BY ga.usuario_id
       LIMIT 1;

      IF v_atendente IS NULL THEN
        CONTINUE;
      END IF;

      v_nivel_atual := CASE
        WHEN COALESCE(v_chamado.escalonamento_nivel, 0) = 0 THEN 1
        ELSE v_chamado.escalonamento_nivel
      END;

      UPDATE public.chamados
         SET atendente_id = v_atendente,
             escalonamento_nivel = v_proximo_nivel,
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
        v_atendente,
        'automacao_escalonamento_sla',
        'N' || v_nivel_atual::text,
        'N' || v_proximo_nivel::text
      );

      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.executar_escalonamento_sla_n1_n2()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.executar_escalonamento_sla_n1_n2()
  TO service_role;

-- Garante que o cron existente continue chamando o motor agora genérico.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid
    INTO v_job_id
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
