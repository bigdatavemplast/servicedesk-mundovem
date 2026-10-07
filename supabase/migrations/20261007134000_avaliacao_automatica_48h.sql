-- Mantém o agendamento da avaliação automática como parte do histórico de migrations.
-- A função é criada na migration anterior; esta migration é responsável somente pelo cron.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'auto-avaliar-chamados-expirados'
  ) THEN
    PERFORM cron.schedule(
      'auto-avaliar-chamados-expirados',
      '*/5 * * * *',
      'select public.auto_avaliar_chamados_expirados();'
    );
  END IF;
END;
$$;
