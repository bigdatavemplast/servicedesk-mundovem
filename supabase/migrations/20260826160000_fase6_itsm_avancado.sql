-- Fase 6 — ITSM Avançado
create extension if not exists pgcrypto;

create table if not exists public.itsm_problemas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  status text not null default 'aberto',
  prioridade text not null default 'media',
  impacto text not null default 'medio',
  urgencia text not null default 'media',
  causa_raiz text,
  solucao text,
  responsavel_id uuid,
  criado_por uuid,
  data_abertura timestamptz not null default now(),
  data_resolucao timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itsm_mudancas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  tipo text not null default 'normal',
  risco text not null default 'medio',
  impacto text not null default 'medio',
  status text not null default 'rascunho',
  solicitante_id uuid,
  aprovador_id uuid,
  plano_execucao text,
  plano_rollback text,
  janela_inicio timestamptz,
  janela_fim timestamptz,
  data_aprovacao timestamptz,
  data_execucao timestamptz,
  resultado text,
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itsm_ativos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null,
  patrimonio text,
  numero_serie text,
  status text not null default 'ativo',
  fabricante text,
  modelo text,
  localizacao text,
  responsavel_id uuid,
  data_aquisicao date,
  fim_garantia date,
  custo numeric(14,2),
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itsm_relacionamentos (
  id uuid primary key default gen_random_uuid(),
  origem_tipo text not null,
  origem_id uuid not null,
  relacao text not null,
  destino_tipo text not null,
  destino_id uuid not null,
  criado_por uuid,
  created_at timestamptz not null default now(),
  unique(origem_tipo, origem_id, relacao, destino_tipo, destino_id)
);

create table if not exists public.itsm_catalogo_avancado (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  categoria text,
  ativo boolean not null default true,
  sla_resposta_minutos integer,
  sla_resolucao_minutos integer,
  formulario jsonb not null default '{}'::jsonb,
  regras jsonb not null default '{}'::jsonb,
  aprovacao_obrigatoria boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itsm_artigos_conhecimento (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  conteudo text not null,
  categoria text,
  status text not null default 'rascunho',
  versao integer not null default 1,
  autor_id uuid,
  revisor_id uuid,
  publicado_em timestamptz,
  validade_ate timestamptz,
  visualizacoes integer not null default 0,
  utilidade integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itsm_auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid,
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  ip text,
  criado_em timestamptz not null default now()
);

create table if not exists public.itsm_governanca (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null,
  descricao text,
  status text not null default 'ativo',
  responsavel_id uuid,
  periodicidade text,
  proxima_revisao date,
  evidencias jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_itsm_problemas_status on public.itsm_problemas(status);
create index if not exists idx_itsm_mudancas_status on public.itsm_mudancas(status);
create index if not exists idx_itsm_ativos_status on public.itsm_ativos(status);
create index if not exists idx_itsm_rel_origem on public.itsm_relacionamentos(origem_tipo, origem_id);
create index if not exists idx_itsm_rel_destino on public.itsm_relacionamentos(destino_tipo, destino_id);
create index if not exists idx_itsm_artigos_status on public.itsm_artigos_conhecimento(status);
create index if not exists idx_itsm_auditoria_entidade on public.itsm_auditoria(entidade, entidade_id);

alter table public.itsm_problemas enable row level security;
alter table public.itsm_mudancas enable row level security;
alter table public.itsm_ativos enable row level security;
alter table public.itsm_relacionamentos enable row level security;
alter table public.itsm_catalogo_avancado enable row level security;
alter table public.itsm_artigos_conhecimento enable row level security;
alter table public.itsm_auditoria enable row level security;
alter table public.itsm_governanca enable row level security;

-- Administração do ITSM avançado fica restrita a gestores/admins.
drop policy if exists itsm_problemas_gestor_admin on public.itsm_problemas;
create policy itsm_problemas_gestor_admin on public.itsm_problemas for all using (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin'));
drop policy if exists itsm_mudancas_gestor_admin on public.itsm_mudancas;
create policy itsm_mudancas_gestor_admin on public.itsm_mudancas for all using (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin'));
drop policy if exists itsm_ativos_gestor_admin on public.itsm_ativos;
create policy itsm_ativos_gestor_admin on public.itsm_ativos for all using (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin'));
drop policy if exists itsm_relacionamentos_gestor_admin on public.itsm_relacionamentos;
create policy itsm_relacionamentos_gestor_admin on public.itsm_relacionamentos for all using (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin'));
drop policy if exists itsm_catalogo_gestor_admin on public.itsm_catalogo_avancado;
create policy itsm_catalogo_gestor_admin on public.itsm_catalogo_avancado for all using (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin'));
drop policy if exists itsm_artigos_gestor_admin on public.itsm_artigos_conhecimento;
create policy itsm_artigos_gestor_admin on public.itsm_artigos_conhecimento for all using (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin'));
drop policy if exists itsm_auditoria_gestor_admin on public.itsm_auditoria;
create policy itsm_auditoria_gestor_admin on public.itsm_auditoria for all using (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin'));
drop policy if exists itsm_governanca_gestor_admin on public.itsm_governanca;
create policy itsm_governanca_gestor_admin on public.itsm_governanca for all using (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'admin'));

grant select, insert, update, delete on public.itsm_problemas, public.itsm_mudancas, public.itsm_ativos, public.itsm_relacionamentos, public.itsm_catalogo_avancado, public.itsm_artigos_conhecimento, public.itsm_auditoria, public.itsm_governanca to authenticated;
