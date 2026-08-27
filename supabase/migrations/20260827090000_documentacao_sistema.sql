create table if not exists public.documentacao_sistema (
  id uuid primary key default gen_random_uuid(),
  categoria text not null default 'Atualização',
  titulo text not null,
  conteudo text not null,
  versao text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists documentacao_sistema_ativo_ordem_idx
  on public.documentacao_sistema (ativo, ordem, atualizado_em desc);

alter table public.documentacao_sistema enable row level security;

drop policy if exists "Admins podem visualizar documentação" on public.documentacao_sistema;
drop policy if exists "Admins podem criar documentação" on public.documentacao_sistema;
drop policy if exists "Admins podem editar documentação" on public.documentacao_sistema;
drop policy if exists "Admins podem excluir documentação" on public.documentacao_sistema;

create policy "Admins podem visualizar documentação"
on public.documentacao_sistema for select to authenticated
using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

create policy "Admins podem criar documentação"
on public.documentacao_sistema for insert to authenticated
with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

create policy "Admins podem editar documentação"
on public.documentacao_sistema for update to authenticated
using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

create policy "Admins podem excluir documentação"
on public.documentacao_sistema for delete to authenticated
using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

insert into public.documentacao_sistema (categoria, titulo, conteudo, versao, ordem, ativo)
select * from (values
  ('Visão geral', 'Como o Service Desk funciona hoje', 'O Service Desk é organizado em áreas/segmentos. O solicitante abre o chamado informando título, descrição, tipo, segmento, categoria e, quando aplicável, subcategoria. O departamento do solicitante é mantido separado do segmento responsável pelo atendimento. A classificação direciona o chamado para a fila/grupo correto.', 'MVP', 10, true),
  ('Operação', 'Fluxo de atendimento', 'Chamados entram na fila correspondente ao segmento e às regras de atribuição. Atendentes trabalham os chamados conforme suas permissões e segmento. A triagem e o escalonamento fazem parte do fluxo operacional. Interações do atendente/gestor/admin pausam o SLA; a resposta do solicitante retoma a contagem conforme as regras configuradas.', 'Fase 2', 20, true),
  ('SLA', 'Regras de SLA', 'O SLA é calculado conforme tipo/fluxo, prioridade, calendário e regras de atendimento. A interface diferencia SLA vencendo, com uma hora restante, de SLA vencido. Existem regras para pausa, retomada, calendário de horas úteis e resolução.', 'Fase 2', 30, true),
  ('Classificação', 'Prioridade de incidentes', 'Para incidentes, a prioridade é calculada automaticamente a partir de impacto e urgência. Impacto pode ser empresa, departamento ou usuário; urgência pode ser crítica, alta, média ou baixa. Para outros tipos de chamado, a prioridade continua sendo selecionável conforme o fluxo.', 'MVP', 40, true),
  ('ITSM', 'ITSM Avançado e permissões', 'O ITSM Avançado não é exclusivo de gestores e administradores. O administrador pode liberar usuários específicos para visualizar módulos e, separadamente, permitir criar, editar e excluir. O acesso ao menu e aos módulos deve respeitar essa matriz. Administradores possuem acesso total.', 'MVP', 50, true),
  ('ITSM', 'Módulos do ITSM Avançado', 'Módulos previstos: Problemas, Mudanças, Ativos/CMDB, Relacionamentos, Serviços, Catálogo, Gestão de Conhecimento, Auditoria e Governança. O usuário somente deve acessar os módulos liberados para ele.', 'MVP', 60, true),
  ('Segurança', 'Modelo de permissões', 'Papéis principais: colaborador, atendente, gestor e admin. O papel controla capacidades gerais do Service Desk. As permissões específicas do ITSM Avançado são complementares e ficam na tabela itsm_permissoes_usuario.', 'Fase 1/MVP', 70, true),
  ('Técnico', 'Arquitetura da aplicação', 'Frontend em React com TanStack Start/Router, Vite e componentes UI. Supabase é utilizado para autenticação, banco de dados, RLS e operações. React Query é usado para consultas/mutações. Funções de servidor ficam em src/lib e rotas em src/routes/_authenticated.', 'MVP', 80, true),
  ('Técnico', 'Estrutura principal do Service Desk', 'Entidades principais incluem profiles, user_roles, chamados, comentarios_chamado, historico_chamado, anexos_chamado, segmentos, categorias, subcategorias, tipos_chamado, grupos, SLAs e tabelas de apoio às automações e permissões ITSM.', 'MVP', 90, true),
  ('Técnico', 'Regra de manutenção desta documentação', 'Toda mudança relevante de processo, regra de negócio, permissão, automação, integração, banco de dados ou arquitetura deve ser registrada nesta tela. Use a categoria apropriada, descreva o comportamento atual e informe a versão/fase relacionada.', 'MVP', 100, true)
) as seed(categoria,titulo,conteudo,versao,ordem,ativo)
where not exists (select 1 from public.documentacao_sistema);

create or replace function public.atualizar_documentacao_sistema_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_documentacao_sistema_atualizado_em on public.documentacao_sistema;
create trigger trg_documentacao_sistema_atualizado_em
before update on public.documentacao_sistema
for each row execute function public.atualizar_documentacao_sistema_atualizado_em();
