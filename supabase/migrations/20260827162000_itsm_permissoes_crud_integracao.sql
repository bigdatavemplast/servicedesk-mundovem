-- Permissões por ação para os módulos ITSM avançados.
-- Admin permanece com acesso total; demais perfis dependem da permissão individual.

-- Problemas
drop policy if exists "ITSM gestores administram problemas" on public.itsm_problemas;
drop policy if exists "ITSM usuario cria problemas" on public.itsm_problemas;
drop policy if exists "ITSM usuario edita problemas" on public.itsm_problemas;
drop policy if exists "ITSM usuario exclui problemas" on public.itsm_problemas;
do $$ begin
  create policy "ITSM usuario cria problemas" on public.itsm_problemas for insert to authenticated
    with check (public.itsm_tem_permissao('problemas','criar'));
  create policy "ITSM usuario edita problemas" on public.itsm_problemas for update to authenticated
    using (public.itsm_tem_permissao('problemas','editar'))
    with check (public.itsm_tem_permissao('problemas','editar'));
  create policy "ITSM usuario exclui problemas" on public.itsm_problemas for delete to authenticated
    using (public.itsm_tem_permissao('problemas','excluir'));
exception when duplicate_object then null; end $$;

-- Mudanças
drop policy if exists "ITSM gestores administram mudancas" on public.itsm_mudancas;
drop policy if exists "ITSM usuario cria mudancas" on public.itsm_mudancas;
drop policy if exists "ITSM usuario edita mudancas" on public.itsm_mudancas;
drop policy if exists "ITSM usuario exclui mudancas" on public.itsm_mudancas;
do $$ begin
  create policy "ITSM usuario cria mudancas" on public.itsm_mudancas for insert to authenticated
    with check (public.itsm_tem_permissao('mudancas','criar'));
  create policy "ITSM usuario edita mudancas" on public.itsm_mudancas for update to authenticated
    using (public.itsm_tem_permissao('mudancas','editar'))
    with check (public.itsm_tem_permissao('mudancas','editar'));
  create policy "ITSM usuario exclui mudancas" on public.itsm_mudancas for delete to authenticated
    using (public.itsm_tem_permissao('mudancas','excluir'));
exception when duplicate_object then null; end $$;

-- Ativos
drop policy if exists "ITSM gestores administram ativos" on public.itsm_ativos;
drop policy if exists "ITSM usuario cria ativos" on public.itsm_ativos;
drop policy if exists "ITSM usuario edita ativos" on public.itsm_ativos;
drop policy if exists "ITSM usuario exclui ativos" on public.itsm_ativos;
do $$ begin
  create policy "ITSM usuario cria ativos" on public.itsm_ativos for insert to authenticated
    with check (public.itsm_tem_permissao('ativos','criar'));
  create policy "ITSM usuario edita ativos" on public.itsm_ativos for update to authenticated
    using (public.itsm_tem_permissao('ativos','editar'))
    with check (public.itsm_tem_permissao('ativos','editar'));
  create policy "ITSM usuario exclui ativos" on public.itsm_ativos for delete to authenticated
    using (public.itsm_tem_permissao('ativos','excluir'));
exception when duplicate_object then null; end $$;

-- Conhecimento
drop policy if exists "ITSM gestores administram conhecimento" on public.itsm_artigos_conhecimento;
drop policy if exists "ITSM usuario cria conhecimento" on public.itsm_artigos_conhecimento;
drop policy if exists "ITSM usuario edita conhecimento" on public.itsm_artigos_conhecimento;
drop policy if exists "ITSM usuario exclui conhecimento" on public.itsm_artigos_conhecimento;
do $$ begin
  create policy "ITSM usuario cria conhecimento" on public.itsm_artigos_conhecimento for insert to authenticated
    with check (public.itsm_tem_permissao('conhecimento','criar'));
  create policy "ITSM usuario edita conhecimento" on public.itsm_artigos_conhecimento for update to authenticated
    using (public.itsm_tem_permissao('conhecimento','editar'))
    with check (public.itsm_tem_permissao('conhecimento','editar'));
  create policy "ITSM usuario exclui conhecimento" on public.itsm_artigos_conhecimento for delete to authenticated
    using (public.itsm_tem_permissao('conhecimento','excluir'));
exception when duplicate_object then null; end $$;

-- Governança
drop policy if exists "ITSM gestores administram governanca" on public.itsm_politicas_governanca;
drop policy if exists "ITSM usuario cria governanca" on public.itsm_politicas_governanca;
drop policy if exists "ITSM usuario edita governanca" on public.itsm_politicas_governanca;
drop policy if exists "ITSM usuario exclui governanca" on public.itsm_politicas_governanca;
do $$ begin
  create policy "ITSM usuario cria governanca" on public.itsm_politicas_governanca for insert to authenticated
    with check (public.itsm_tem_permissao('governanca','criar'));
  create policy "ITSM usuario edita governanca" on public.itsm_politicas_governanca for update to authenticated
    using (public.itsm_tem_permissao('governanca','editar'))
    with check (public.itsm_tem_permissao('governanca','editar'));
  create policy "ITSM usuario exclui governanca" on public.itsm_politicas_governanca for delete to authenticated
    using (public.itsm_tem_permissao('governanca','excluir'));
exception when duplicate_object then null; end $$;

-- Auditoria é somente leitura. A escrita ocorre pelo trigger security definer.
-- Serviços: gestão por permissão individual, mantendo leitura para todos os autenticados.
drop policy if exists "ITSM serviços gestão" on public.itsm_servicos;
do $$ begin
  create policy "ITSM usuario cria servicos" on public.itsm_servicos for insert to authenticated
    with check (public.itsm_tem_permissao('servicos','criar'));
  create policy "ITSM usuario edita servicos" on public.itsm_servicos for update to authenticated
    using (public.itsm_tem_permissao('servicos','editar'))
    with check (public.itsm_tem_permissao('servicos','editar'));
  create policy "ITSM usuario exclui servicos" on public.itsm_servicos for delete to authenticated
    using (public.itsm_tem_permissao('servicos','excluir'));
exception when duplicate_object then null; end $$;

-- Relacionamentos: leitura/criação/edição/exclusão seguem a permissão do módulo.
drop policy if exists "ITSM operadores consultam relacionamentos" on public.itsm_relacionamentos;
drop policy if exists "ITSM operadores cadastram relacionamentos" on public.itsm_relacionamentos;
drop policy if exists "ITSM gestores alteram relacionamentos" on public.itsm_relacionamentos;
drop policy if exists "ITSM admin exclui relacionamentos" on public.itsm_relacionamentos;
do $$ begin
  create policy "ITSM usuario consulta relacionamentos por permissao" on public.itsm_relacionamentos for select to authenticated
    using (public.itsm_tem_permissao('relacionamentos','visualizar'));
  create policy "ITSM usuario cria relacionamentos por permissao" on public.itsm_relacionamentos for insert to authenticated
    with check (public.itsm_tem_permissao('relacionamentos','criar'));
  create policy "ITSM usuario edita relacionamentos por permissao" on public.itsm_relacionamentos for update to authenticated
    using (public.itsm_tem_permissao('relacionamentos','editar'))
    with check (public.itsm_tem_permissao('relacionamentos','editar'));
  create policy "ITSM usuario exclui relacionamentos por permissao" on public.itsm_relacionamentos for delete to authenticated
    using (public.itsm_tem_permissao('relacionamentos','excluir'));
exception when duplicate_object then null; end $$;

-- Permite registrar chamados como origem/destino e relacioná-los aos objetos ITSM.
comment on table public.itsm_auditoria is 'Trilha imutável de operações nos módulos ITSM. Registros são gerados automaticamente por triggers.';
