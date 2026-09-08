-- Corrige a persistência da atribuição de chamados usando o usuário autenticado.
-- A função usa SECURITY DEFINER para não depender de RLS durante o update,
-- mas valida explicitamente o papel do usuário que executou a ação.
create or replace function public.atribuir_chamado(_chamado_id uuid, _atendente_id uuid)
returns public.chamados
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.chamados;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.has_any_role(auth.uid(), array['atendente','gestor','admin']::public.app_role[]) then
    raise exception 'Você não tem permissão para atribuir o chamado.';
  end if;

  if _atendente_id is not null and not exists (
    select 1
      from public.user_roles ur
     where ur.user_id = _atendente_id
       and ur.role in ('atendente','gestor','admin')
  ) then
    raise exception 'O responsável selecionado não possui perfil de atendimento.';
  end if;

  update public.chamados
     set atendente_id = _atendente_id
   where id = _chamado_id
   returning * into v_result;

  if not found then
    raise exception 'Chamado não encontrado.';
  end if;

  return v_result;
end;
$$;

grant execute on function public.atribuir_chamado(uuid, uuid) to authenticated;
