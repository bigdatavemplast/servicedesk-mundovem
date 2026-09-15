-- O histórico de anexos é registrado pelo fluxo autenticado do aplicativo,
-- garantindo autor correto mesmo quando os triggers do banco ainda não foram aplicados.
-- Remove o trigger de anexos para evitar eventos duplicados quando a migration
-- anterior de histórico completo também estiver presente no banco.
DROP TRIGGER IF EXISTS trg_historico_anexos_chamado ON public.anexos_chamado;
