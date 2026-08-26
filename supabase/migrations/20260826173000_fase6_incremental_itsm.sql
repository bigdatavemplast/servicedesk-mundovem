-- Fase 6 incremental: reutiliza o Service Desk existente e adiciona somente o que falta.
create table if not exists public.itsm_servicos (
  id uuid primary key default gen_random_uuid(), nome text not null unique, descricao text,
  status text not null default 'ativo', proprietario_id uuid references public.profiles(id),
  sla_id uuid references public.slas(id), criticidade text not null default 'media', criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table if not exists public.itsm_servico_chamado (
  servico_id uuid not null references public.itsm_servicos(id) on delete cascade,
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  primary key(servico_id, chamado_id)
);
create table if not exists public.itsm_problema_chamado (
  problema_id uuid not null references public.itsm_problemas(id) on delete cascade,
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  primary key(problema_id, chamado_id)
);
create table if not exists public.itsm_mudanca_chamado (
  mudanca_id uuid not null references public.itsm_mudancas(id) on delete cascade,
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  primary key(mudanca_id, chamado_id)
);
create table if not exists public.itsm_aprovacoes (
  id uuid primary key default gen_random_uuid(), entidade text not null, entidade_id uuid not null,
  aprovador_id uuid references public.profiles(id), status text not null default 'pendente',
  comentario text, solicitado_em timestamptz not null default now(), decidido_em timestamptz
);
create index if not exists idx_itsm_servicos_status on public.itsm_servicos(status);
create index if not exists idx_itsm_aprovacoes_entidade on public.itsm_aprovacoes(entidade,entidade_id,status);

-- Complementa as entidades já existentes, sem mexer em public.chamados.
alter table public.itsm_problemas add column if not exists impacto text default 'medio';
alter table public.itsm_problemas add column if not exists urgencia text default 'media';
alter table public.itsm_problemas add column if not exists causa_raiz text;
alter table public.itsm_mudancas add column if not exists justificativa text;
alter table public.itsm_mudancas add column if not exists plano_rollback text;
alter table public.itsm_ativos add column if not exists valor numeric(14,2);

alter table public.itsm_servicos enable row level security;
alter table public.itsm_servico_chamado enable row level security;
alter table public.itsm_problema_chamado enable row level security;
alter table public.itsm_mudanca_chamado enable row level security;
alter table public.itsm_aprovacoes enable row level security;

do $$ begin
 create policy "ITSM gestores servicos" on public.itsm_servicos for all to authenticated using(public.itsm_e_gestor_ou_admin()) with check(public.itsm_e_gestor_ou_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "ITSM gestores vinculos servico" on public.itsm_servico_chamado for all to authenticated using(public.itsm_e_gestor_ou_admin()) with check(public.itsm_e_gestor_ou_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "ITSM gestores vinculos problema" on public.itsm_problema_chamado for all to authenticated using(public.itsm_e_gestor_ou_admin()) with check(public.itsm_e_gestor_ou_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "ITSM gestores vinculos mudanca" on public.itsm_mudanca_chamado for all to authenticated using(public.itsm_e_gestor_ou_admin()) with check(public.itsm_e_gestor_ou_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "ITSM gestores aprovacoes" on public.itsm_aprovacoes for all to authenticated using(public.itsm_e_gestor_ou_admin()) with check(public.itsm_e_gestor_ou_admin());
exception when duplicate_object then null; end $$;

grant select,insert,update,delete on public.itsm_servicos,public.itsm_servico_chamado,public.itsm_problema_chamado,public.itsm_mudanca_chamado,public.itsm_aprovacoes to authenticated;

-- Estados/processos e governança sem tocar no fluxo de chamados.
comment on table public.itsm_problemas is 'ITSM Problemas; integrado aos chamados via itsm_problema_chamado';
comment on table public.itsm_mudancas is 'ITSM Mudancas/RFC; integrado aos chamados via itsm_mudanca_chamado';
comment on table public.itsm_ativos is 'ITSM Ativos/CMDB';
comment on table public.itsm_servicos is 'Catalogo de servicos ITSM';