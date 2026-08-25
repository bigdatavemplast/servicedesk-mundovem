-- Fase 2 — Operação: estrutura base de automações
create table if not exists public.automacoes_service_desk (
  id uuid primary key default gen_random_uuid(),
  nome varchar(150) not null,
  descricao text,
  evento varchar(80) not null,
  condicoes jsonb not null default '{}'::jsonb,
  acao varchar(80) not null,
  parametros_acao jsonb not null default '{}'::jsonb,
  ordem integer not null default 100,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_automacoes_service_desk_evento_ativo
  on public.automacoes_service_desk (evento, ativo, ordem);

alter table public.automacoes_service_desk enable row level security;

drop policy if exists "admin pode gerenciar automacoes" on public.automacoes_service_desk;

create policy "admin pode gerenciar automacoes"
  on public.automacoes_service_desk
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

comment on table public.automacoes_service_desk is 'Regras de automação operacional do Service Desk. Evento -> condições -> ação.';
comment on column public.automacoes_service_desk.evento is 'Evento que dispara a automação.';
comment on column public.automacoes_service_desk.condicoes is 'Condições adicionais em JSON.';
comment on column public.automacoes_service_desk.acao is 'Ação executada pela automação.';
comment on column public.automacoes_service_desk.parametros_acao is 'Parâmetros da ação em JSON.';
