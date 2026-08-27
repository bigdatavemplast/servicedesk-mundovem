-- Permissões individuais do ITSM Avançado.
-- O papel do usuário continua independente do acesso aos módulos ITSM.
create table if not exists public.itsm_permissoes_usuario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  modulo text not null check (modulo in ('problemas','mudancas','ativos','relacionamentos','servicos','catalogo','conhecimento','auditoria','governanca')),
  visualizar boolean not null default false,
  criar boolean not null default false,
  editar boolean not null default false,
  excluir boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(user_id, modulo)
);

create index if not exists idx_itsm_permissoes_usuario_user on public.itsm_permissoes_usuario(user_id);
create index if not exists idx_itsm_permissoes_usuario_modulo on public.itsm_permissoes_usuario(modulo);

alter table public.itsm_permissoes_usuario enable row level security;

-- Administração: somente usuários com papel admin podem consultar/alterar permissões.
do $$ begin
  create policy "ITSM admin gerencia permissoes" on public.itsm_permissoes_usuario
    for all to authenticated
    using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'))
    with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));
exception when duplicate_object then null; end $$;

-- O próprio usuário pode consultar suas permissões para montagem do menu e proteção da interface.
do $$ begin
  create policy "ITSM usuario consulta suas permissoes" on public.itsm_permissoes_usuario
    for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create or replace function public.itsm_tem_permissao(p_modulo text, p_acao text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1
    from public.itsm_permissoes_usuario p
    where p.user_id = auth.uid()
      and p.modulo = p_modulo
      and case p_acao
        when 'visualizar' then p.visualizar
        when 'criar' then p.criar
        when 'editar' then p.editar
        when 'excluir' then p.excluir
        else false
      end
  )
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  );
$$;

revoke all on function public.itsm_tem_permissao(text,text) from public;
grant execute on function public.itsm_tem_permissao(text,text) to authenticated;

create or replace function public.itsm_atualizar_permissoes_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_itsm_permissoes_updated_at on public.itsm_permissoes_usuario;
create trigger trg_itsm_permissoes_updated_at
before update on public.itsm_permissoes_usuario
for each row execute function public.itsm_atualizar_permissoes_updated_at();
