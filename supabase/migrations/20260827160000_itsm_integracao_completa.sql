-- Integração dos módulos ITSM avançados
-- Objetivo: transformar os cadastros em uma malha operacional conectada,
-- mantendo o histórico e permitindo relacionar chamados, problemas, mudanças,
-- ativos, serviços e conhecimento.

-- 1. Relacionamentos passam a aceitar chamados como entidade de origem/destino.
alter table public.itsm_relacionamentos
  drop constraint if exists itsm_relacionamentos_origem_tipo_check;
alter table public.itsm_relacionamentos
  add constraint itsm_relacionamentos_origem_tipo_check
  check (origem_tipo in ('chamado','servico','ativo','problema','mudanca','artigo','politica'));

alter table public.itsm_relacionamentos
  drop constraint if exists itsm_relacionamentos_destino_tipo_check;
alter table public.itsm_relacionamentos
  add constraint itsm_relacionamentos_destino_tipo_check
  check (destino_tipo in ('chamado','servico','ativo','problema','mudanca','artigo','politica'));

-- 2. Função de auditoria segura para qualquer tabela ITSM.
create or replace function public.itsm_registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.itsm_auditoria(
    entidade, entidade_id, acao, usuario_id, antes, depois
  ) values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

-- 3. Auditoria dos serviços e relacionamentos.
drop trigger if exists trg_itsm_audit_servicos on public.itsm_servicos;
create trigger trg_itsm_audit_servicos
after insert or update or delete on public.itsm_servicos
for each row execute function public.itsm_registrar_auditoria();

drop trigger if exists trg_itsm_audit_relacionamentos on public.itsm_relacionamentos;
create trigger trg_itsm_audit_relacionamentos
after insert or update or delete on public.itsm_relacionamentos
for each row execute function public.itsm_registrar_auditoria();

-- 4. Auditoria dos chamados: cada criação/alteração passa a compor a trilha ITSM.
drop trigger if exists trg_itsm_audit_chamados on public.chamados;
create trigger trg_itsm_audit_chamados
after insert or update or delete on public.chamados
for each row execute function public.itsm_registrar_auditoria();

-- 5. Índices para a malha de relacionamento.
create index if not exists idx_itsm_rel_origem_full
  on public.itsm_relacionamentos(origem_tipo, origem_id, relacao);
create index if not exists idx_itsm_rel_destino_full
  on public.itsm_relacionamentos(destino_tipo, destino_id, relacao);
create index if not exists idx_itsm_auditoria_usuario_data
  on public.itsm_auditoria(usuario_id, criado_em desc);

-- 6. View de governança operacional.
-- A view não altera dados; consolida indicadores para o painel de governança.
create or replace view public.itsm_governanca_resumo as
select
  (select count(*) from public.chamados) as total_chamados,
  (select count(*) from public.chamados where status in ('aberto','em_andamento','aguardando_usuario')) as chamados_abertos,
  (select count(*) from public.itsm_problemas where status not in ('fechado','resolvido')) as problemas_abertos,
  (select count(*) from public.itsm_mudancas where status not in ('concluido','cancelado','rejeitado')) as mudancas_pendentes,
  (select count(*) from public.itsm_ativos where status = 'ativo') as ativos_ativos,
  (select count(*) from public.itsm_servicos where status = 'ativo') as servicos_ativos,
  (select count(*) from public.itsm_relacionamentos) as relacionamentos,
  (select count(*) from public.itsm_artigos_conhecimento where status = 'publicado') as artigos_publicados,
  (select count(*) from public.itsm_auditoria) as eventos_auditoria,
  (select count(*) from public.itsm_politicas_governanca where status = 'vigente') as politicas_vigentes;

grant select on public.itsm_governanca_resumo to authenticated;

-- 7. Atualiza o comentário conceitual da estrutura.
comment on table public.itsm_relacionamentos is
'Catálogo de relacionamentos ITSM entre chamados, serviços, ativos, problemas, mudanças, conhecimento e políticas.';
comment on table public.itsm_servicos is
'Serviços de TI e negócio consumidos pelo usuário e suportados pela operação.';
comment on table public.itsm_problemas is
'Registros de causa e recorrência associados à gestão de problemas.';
comment on table public.itsm_mudancas is
'Registros controlados de alterações planejadas no ambiente ou serviços.';
