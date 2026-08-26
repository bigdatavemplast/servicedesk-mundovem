-- Leitura e cadastro: usuários ITSM autorizados (atendente), gestores e admins.
-- Alteração: somente gestor/admin.
-- Exclusão: somente admin.
create or replace function public.itsm_tem_papel(papeis text[]) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = any(papeis)
  );
$$;
revoke all on function public.itsm_tem_papel(text[]) from public;
grant execute on function public.itsm_tem_papel(text[]) to authenticated;

-- Problemas
do $$ begin create policy "ITSM operadores consultam problemas" on public.itsm_problemas for select to authenticated using (public.itsm_tem_papel(array['atendente','gestor','admin'])); exception when duplicate_object then null; end $$;
do $$ begin create policy "ITSM operadores cadastram problemas" on public.itsm_problemas for insert to authenticated with check (public.itsm_tem_papel(array['atendente','gestor','admin'])); exception when duplicate_object then null; end $$;
do $$ begin create policy "ITSM gestores alteram problemas" on public.itsm_problemas for update to authenticated using (public.itsm_tem_papel(array['gestor','admin'])) with check (public.itsm_tem_papel(array['gestor','admin'])); exception when duplicate_object then null; end $$;
do $$ begin create policy "ITSM admin exclui problemas" on public.itsm_problemas for delete to authenticated using (public.itsm_tem_papel(array['admin'])); exception when duplicate_object then null; end $$;

-- Mudanças
do $$ begin create policy "ITSM operadores consultam mudancas" on public.itsm_mudancas for select to authenticated using (public.itsm_tem_papel(array['atendente','gestor','admin'])); exception when duplicate_object then null; end $$;
do $$ begin create policy "ITSM operadores cadastram mudancas" on public.itsm_mudancas for insert to authenticated with check (public.itsm_tem_papel(array['atendente','gestor','admin'])); exception when duplicate_object then null; end $$;
do $$ begin create policy "ITSM gestores alteram mudancas" on public.itsm_mudancas for update to authenticated using (public.itsm_tem_papel(array['gestor','admin'])) with check (public.itsm_tem_papel(array['gestor','admin'])); exception when duplicate_object then null; end $$;
do $$ begin create policy "ITSM admin exclui mudancas" on public.itsm_mudancas for delete to authenticated using (public.itsm_tem_papel(array['admin'])); exception when duplicate_object then null; end $$;

-- Ativos / CMDB
do $$ begin create policy "ITSM operadores consultam ativos" on public.itsm_ativos for select to authenticated using (public.itsm_tem_papel(array['atendente','gestor','admin'])); exception when duplicate_object then null; end $$;
do $$ begin create policy "ITSM operadores cadastram ativos" on public.itsm_ativos for insert to authenticated with check (public.itsm_tem_papel(array['atendente','gestor','admin'])); exception when duplicate_object then null; end $$;
do $$ begin create policy "ITSM gestores alteram ativos" on public.itsm_ativos for update to authenticated using (public.itsm_tem_papel(array['gestor','admin'])) with check (public.itsm_tem_papel(array['gestor','admin'])); exception when duplicate_object then null; end $$;
do $$ begin create policy "ITSM admin exclui ativos" on public.itsm_ativos for delete to authenticated using (public.itsm_tem_papel(array['admin'])); exception when duplicate_object then null; end $$;
