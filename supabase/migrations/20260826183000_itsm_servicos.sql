create table if not exists public.itsm_servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  segmento_id uuid references public.segmentos(id) on delete set null,
  proprietario_id uuid references auth.users(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists ux_itsm_servicos_nome on public.itsm_servicos(lower(nome));
create index if not exists idx_itsm_servicos_segmento on public.itsm_servicos(segmento_id);
create index if not exists idx_itsm_servicos_status on public.itsm_servicos(status);
alter table public.itsm_servicos enable row level security;
do $$ begin
 create policy "ITSM serviços consulta" on public.itsm_servicos for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "ITSM serviços gestão" on public.itsm_servicos for all to authenticated using (public.itsm_tem_papel(array['gestor','admin'])) with check (public.itsm_tem_papel(array['gestor','admin']));
exception when duplicate_object then null; end $$;
