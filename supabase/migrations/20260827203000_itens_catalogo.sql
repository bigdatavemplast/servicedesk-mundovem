create table if not exists public.itsm_itens_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  instrucoes text,
  segmento_id uuid not null references public.segmentos(id) on delete restrict,
  categoria_id uuid not null references public.categorias(id) on delete restrict,
  subcategoria_id uuid references public.subcategorias(id) on delete restrict,
  tipo_chamado_id uuid not null references public.tipos_chamado(id) on delete restrict,
  ativo boolean not null default true,
  publicado boolean not null default false,
  requer_aprovacao boolean not null default false,
  campos_formulario jsonb not null default '[]'::jsonb,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_itens_catalogo_segmento on public.itsm_itens_catalogo(segmento_id);
create index if not exists idx_itens_catalogo_categoria on public.itsm_itens_catalogo(categoria_id);
create index if not exists idx_itens_catalogo_publicado on public.itsm_itens_catalogo(ativo, publicado);

alter table public.itsm_itens_catalogo enable row level security;

drop policy if exists "itens catalogo leitura publicados" on public.itsm_itens_catalogo;
create policy "itens catalogo leitura publicados"
on public.itsm_itens_catalogo for select to authenticated
using (ativo = true and publicado = true);

drop policy if exists "itens catalogo admin leitura" on public.itsm_itens_catalogo;
create policy "itens catalogo admin leitura"
on public.itsm_itens_catalogo for select to authenticated
using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'admin'));

drop policy if exists "itens catalogo admin insercao" on public.itsm_itens_catalogo;
create policy "itens catalogo admin insercao"
on public.itsm_itens_catalogo for insert to authenticated
with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'admin'));

drop policy if exists "itens catalogo admin atualizacao" on public.itsm_itens_catalogo;
create policy "itens catalogo admin atualizacao"
on public.itsm_itens_catalogo for update to authenticated
using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'admin'));

drop policy if exists "itens catalogo admin exclusao" on public.itsm_itens_catalogo;
create policy "itens catalogo admin exclusao"
on public.itsm_itens_catalogo for delete to authenticated
using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'admin'));
