-- Avaliação do chamado: prazo de 48h após resolução e fechamento condicionado à avaliação.
-- Não altera nenhuma lógica de SLA.

create extension if not exists pg_cron;

create or replace function public.auto_avaliar_chamados_expirados()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chamados
  set
    avaliacao_nota = 5,
    avaliacao_comentario = coalesce(
      avaliacao_comentario,
      'Avaliação automática: o colaborador não avaliou o chamado dentro de 48 horas após a resolução.'
    )
  where status = 'resolvido'
    and avaliacao_nota is null
    and resolvido_em is not null
    and resolvido_em <= now() - interval '48 hours';
end;
$$;

revoke all on function public.auto_avaliar_chamados_expirados() from public;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'auto-avaliar-chamados-expirados';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'auto-avaliar-chamados-expirados',
    '*/5 * * * *',
    'select public.auto_avaliar_chamados_expirados();'
  );
end;
$$;

-- Proteção no banco: um chamado só pode ser fechado depois de existir avaliação.
create or replace function public.impedir_fechamento_sem_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'fechado' and coalesce(old.status, '') <> 'fechado' and new.avaliacao_nota is null then
    raise exception 'O chamado só pode ser fechado após a avaliação do colaborador.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_impedir_fechamento_sem_avaliacao on public.chamados;
create trigger trg_impedir_fechamento_sem_avaliacao
before update of status on public.chamados
for each row
execute function public.impedir_fechamento_sem_avaliacao();
