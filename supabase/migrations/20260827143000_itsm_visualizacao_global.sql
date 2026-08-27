-- ITSM: visualizacao global por permissao.
-- Um usuario que possui visualizar=true em um modulo pode consultar todos
-- os registros daquele modulo, independentemente do seu papel.
-- Admin permanece com acesso total.

create or replace function public.itsm_tem_permissao(p_modulo text, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
    or exists (
      select 1
      from public.itsm_permissoes_usuario p
      where p.user_id = auth.uid()
        and p.modulo = p_modulo
        and case p_acao
          when 'visualizar' then p.visualizar
          when 'criar' then p.criar
          when 'editar' then p.editar
          when 'atribuir' then p.atribuir
          when 'excluir' then p.excluir
          else false
        end
    );
$$;

grant execute on function public.itsm_tem_permissao(text,text) to authenticated;

-- Remove somente as policies de leitura criadas pela migration anterior,
-- tornando a migration idempotente.
drop policy if exists "ITSM usuario visualiza problemas" on public.itsm_problemas;
drop policy if exists "ITSM usuario visualiza mudancas" on public.itsm_mudancas;
drop policy if exists "ITSM usuario visualiza ativos" on public.itsm_ativos;
drop policy if exists "ITSM usuario visualiza relacionamentos" on public.itsm_relacionamentos;
drop policy if exists "ITSM usuario visualiza conhecimento" on public.itsm_artigos_conhecimento;
drop policy if exists "ITSM usuario visualiza auditoria" on public.itsm_auditoria;
drop policy if exists "ITSM usuario visualiza governanca" on public.itsm_politicas_governanca;

create policy "ITSM visualizar problemas" on public.itsm_problemas
  for select to authenticated
  using (public.itsm_tem_permissao('problemas','visualizar'));

create policy "ITSM visualizar mudancas" on public.itsm_mudancas
  for select to authenticated
  using (public.itsm_tem_permissao('mudancas','visualizar'));

create policy "ITSM visualizar ativos" on public.itsm_ativos
  for select to authenticated
  using (public.itsm_tem_permissao('ativos','visualizar'));

create policy "ITSM visualizar relacionamentos" on public.itsm_relacionamentos
  for select to authenticated
  using (public.itsm_tem_permissao('relacionamentos','visualizar'));

create policy "ITSM visualizar conhecimento" on public.itsm_artigos_conhecimento
  for select to authenticated
  using (public.itsm_tem_permissao('conhecimento','visualizar'));

create policy "ITSM visualizar auditoria" on public.itsm_auditoria
  for select to authenticated
  using (public.itsm_tem_permissao('auditoria','visualizar'));

create policy "ITSM visualizar governanca" on public.itsm_politicas_governanca
  for select to authenticated
  using (public.itsm_tem_permissao('governanca','visualizar'));
