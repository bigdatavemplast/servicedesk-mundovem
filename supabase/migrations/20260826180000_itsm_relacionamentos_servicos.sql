-- Fase 6 - Relacionamentos entre serviços / CIs
-- A tabela base foi criada na fundação da Fase 6. Esta migration completa
-- integridade, tipos de relação, políticas e índices necessários à operação.

alter table public.itsm_relacionamentos
  drop constraint if exists itsm_relacionamentos_relacao_check;

alter table public.itsm_relacionamentos
  add constraint itsm_relacionamentos_relacao_check
  check (relacao in (
    'depende_de',
    'suporta',
    'hospeda',
    'conecta_com',
    'impacta',
    'substitui',
    'relacionado_a'
  ));

alter table public.itsm_relacionamentos
  drop constraint if exists itsm_relacionamentos_origem_tipo_check;

alter table public.itsm_relacionamentos
  add constraint itsm_relacionamentos_origem_tipo_check
  check (origem_tipo in ('servico','ativo','problema','mudanca','artigo','politica'));

alter table public.itsm_relacionamentos
  drop constraint if exists itsm_relacionamentos_destino_tipo_check;

alter table public.itsm_relacionamentos
  add constraint itsm_relacionamentos_destino_tipo_check
  check (destino_tipo in ('servico','ativo','problema','mudanca','artigo','politica'));

-- Evita auto-relacionamento do mesmo CI.
alter table public.itsm_relacionamentos
  drop constraint if exists itsm_relacionamentos_no_self;

alter table public.itsm_relacionamentos
  add constraint itsm_relacionamentos_no_self
  check (origem_id <> destino_id or origem_tipo <> destino_tipo);

create index if not exists idx_itsm_rel_relacao on public.itsm_relacionamentos(relacao);
create index if not exists idx_itsm_rel_origem_destino on public.itsm_relacionamentos(origem_id, destino_id);

-- A policy ampla criada na fundação da Fase 6 é removida para que a regra
-- operacional seja realmente: leitura/cadastro para atendente, gestor e admin;
-- alteração para gestor/admin; exclusão somente admin.
drop policy if exists "ITSM gestores administram relacionamentos" on public.itsm_relacionamentos;

do $$ begin
  create policy "ITSM operadores consultam relacionamentos"
    on public.itsm_relacionamentos for select to authenticated
    using (public.itsm_tem_papel(array['atendente','gestor','admin']));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "ITSM operadores cadastram relacionamentos"
    on public.itsm_relacionamentos for insert to authenticated
    with check (public.itsm_tem_papel(array['atendente','gestor','admin']));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "ITSM gestores alteram relacionamentos"
    on public.itsm_relacionamentos for update to authenticated
    using (public.itsm_tem_papel(array['gestor','admin']))
    with check (public.itsm_tem_papel(array['gestor','admin']));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "ITSM admin exclui relacionamentos"
    on public.itsm_relacionamentos for delete to authenticated
    using (public.itsm_tem_papel(array['admin']));
exception when duplicate_object then null; end $$;
