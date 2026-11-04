create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
drop policy if exists "Usuário gerencia próprias assinaturas push" on public.push_subscriptions;
create policy "Usuário gerencia próprias assinaturas push"
on public.push_subscriptions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

create or replace function public.notificar_chamado()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_atendente record; v_gestor_abriu boolean := false;
begin
  if TG_OP = 'INSERT' then
    select exists (select 1 from public.user_roles where user_id = NEW.solicitante_id and role = 'gestor'::app_role) into v_gestor_abriu;
    perform public.criar_notificacao_usuario(NEW.solicitante_id, NEW.id, 'chamado_aberto'::tipo_notificacao, 'Chamado criado', 'O chamado ' || NEW.numero || ' foi criado: ' || NEW.titulo);
    if v_gestor_abriu then
      for v_atendente in
        select distinct p.id from public.user_roles ur join public.profiles p on p.id = ur.user_id
        where ur.role = 'atendente'::app_role and p.ativo = true and p.id <> NEW.solicitante_id
      loop
        perform public.criar_notificacao_usuario(v_atendente.id, NEW.id, 'chamado_aberto'::tipo_notificacao, 'Novo chamado aberto por gestor', 'O chamado ' || NEW.numero || ' foi aberto: ' || NEW.titulo);
      end loop;
    elsif NEW.atendente_id is not null and NEW.atendente_id <> NEW.solicitante_id then
      perform public.criar_notificacao_usuario(NEW.atendente_id, NEW.id, 'chamado_atribuido'::tipo_notificacao, 'Novo chamado atribuído', 'O chamado ' || NEW.numero || ' foi atribuído a você: ' || NEW.titulo);
    end if;
    return NEW;
  end if;
  if TG_OP = 'UPDATE' then
    if NEW.atendente_id is distinct from OLD.atendente_id and NEW.atendente_id is not null and NEW.atendente_id <> NEW.solicitante_id then
      perform public.criar_notificacao_usuario(NEW.atendente_id, NEW.id, 'chamado_atribuido'::tipo_notificacao, 'Chamado atribuído a você', 'O chamado ' || NEW.numero || ' foi atribuído a você: ' || NEW.titulo);
    end if;
    if NEW.status is distinct from OLD.status then
      perform public.criar_notificacao_usuario(NEW.solicitante_id, NEW.id, (case when NEW.status = 'resolvido' then 'chamado_resolvido' else 'status_alterado' end)::tipo_notificacao, case when NEW.status = 'resolvido' then 'Chamado resolvido' else 'Status do chamado alterado' end, 'O chamado ' || NEW.numero || ' agora está como ' || replace(NEW.status::text, '_', ' ') || '.');
      if NEW.atendente_id is not null and NEW.atendente_id <> NEW.solicitante_id then
        perform public.criar_notificacao_usuario(NEW.atendente_id, NEW.id, (case when NEW.status = 'resolvido' then 'chamado_resolvido' else 'status_alterado' end)::tipo_notificacao, case when NEW.status = 'resolvido' then 'Chamado resolvido' else 'Status do chamado alterado' end, 'O chamado ' || NEW.numero || ' agora está como ' || replace(NEW.status::text, '_', ' ') || '.');
      end if;
    end if;
    if NEW.prioridade is distinct from OLD.prioridade then
      perform public.criar_notificacao_usuario(NEW.solicitante_id, NEW.id, 'status_alterado'::tipo_notificacao, 'Prioridade do chamado alterada', 'A prioridade do chamado ' || NEW.numero || ' foi alterada para ' || NEW.prioridade::text || '.');
    end if;
  end if;
  return NEW;
end;
$function$;
