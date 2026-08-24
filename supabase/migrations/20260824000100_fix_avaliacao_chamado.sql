create or replace function public.avaliar_chamado(
  _chamado_id uuid,
  _nota integer,
  _comentario text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chamado public.chamados%rowtype;
  v_agora timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if _nota < 1 or _nota > 5 then
    raise exception 'A nota deve estar entre 1 e 5.';
  end if;

  select * into v_chamado from public.chamados where id = _chamado_id for update;

  if not found then raise exception 'Chamado não encontrado.'; end if;
  if v_chamado.solicitante_id <> auth.uid() then raise exception 'Somente o solicitante pode avaliar o chamado.'; end if;
  if v_chamado.status <> 'resolvido' then raise exception 'O chamado precisa estar resolvido para ser avaliado.'; end if;
  if v_chamado.avaliacao_nota is not null then raise exception 'Este chamado já foi avaliado.'; end if;

  update public.chamados
     set avaliacao_nota = _nota,
         avaliacao_comentario = nullif(trim(coalesce(_comentario, '')), ''),
         status = 'fechado',
         fechado_em = v_agora,
         sla_pausado = false
   where id = _chamado_id;

  insert into public.historico_chamado (chamado_id, autor_id, acao, de, para)
  values (_chamado_id, auth.uid(), 'avaliacao_registrada', 'resolvido', 'fechado');

  return jsonb_build_object('ok', true, 'status', 'fechado', 'avaliacao_nota', _nota, 'fechado_em', v_agora);
end;
$$;

revoke all on function public.avaliar_chamado(uuid, integer, text) from public;
grant execute on function public.avaliar_chamado(uuid, integer, text) to authenticated;
grant execute on function public.avaliar_chamado(uuid, integer, text) to service_role;
