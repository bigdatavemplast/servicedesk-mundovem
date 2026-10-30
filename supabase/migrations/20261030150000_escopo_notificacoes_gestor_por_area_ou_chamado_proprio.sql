-- Escopa notificações de gestores a chamados próprios ou relacionados à sua área.
create or replace function public.notificar_gestores_atividade_sistema()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  registro jsonb;
  evento text;
  id_chamado uuid;
  autor_id uuid;
  nome_modulo text;
  mensagem_notificacao text;
  chamado public.chamados%rowtype;
  gestor record;
begin
  if tg_op = 'DELETE' then registro := to_jsonb(old); evento := 'excluído';
  elsif tg_op = 'INSERT' then registro := to_jsonb(new); evento := 'criado';
  else
    if to_jsonb(old) = to_jsonb(new) then return new; end if;
    registro := to_jsonb(new); evento := 'atualizado';
  end if;

  autor_id := auth.uid();
  id_chamado := nullif(registro->>'id', '')::uuid;
  if tg_table_name <> 'chamados' then id_chamado := nullif(registro->>'chamado_id', '')::uuid; end if;
  if id_chamado is null then if tg_op = 'DELETE' then return old; else return new; end if; end if;

  select * into chamado from public.chamados c where c.id = id_chamado;
  if not found then
    if tg_table_name = 'chamados' and tg_op = 'DELETE' then
      chamado.id := (registro->>'id')::uuid;
      chamado.solicitante_id := nullif(registro->>'solicitante_id','')::uuid;
      chamado.categoria_id := nullif(registro->>'categoria_id','')::uuid;
      chamado.segmento_id := nullif(registro->>'segmento_id','')::uuid;
      chamado.numero := registro->>'numero';
      chamado.titulo := registro->>'titulo';
    else
      if tg_op = 'DELETE' then return old; else return new; end if;
    end if;
  end if;

  nome_modulo := case tg_table_name when 'chamados' then 'chamado' when 'comentarios_chamado' then 'comentário' when 'anexos_chamado' then 'anexo' else replace(tg_table_name, '_', ' ') end;
  mensagem_notificacao := 'O ' || nome_modulo || ' do chamado ' || coalesce(chamado.numero, left(chamado.id::text, 8)) || ' foi ' || evento || case when coalesce(chamado.titulo,'') <> '' then ': ' || chamado.titulo else '' end || '.';

  for gestor in
    select distinct p.id as user_id
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role = 'gestor'::public.app_role
    left join public.categorias cat on cat.id = chamado.categoria_id
    where p.ativo = true
      and (p.id = chamado.solicitante_id or (p.area_id is not null and (p.area_id = chamado.segmento_id or p.area_id = cat.segmento_id)))
      and (autor_id is null or p.id <> autor_id)
  loop
    insert into public.notificacoes (destinatario_id, tipo, titulo, mensagem, chamado_id)
    values (gestor.user_id,
      case when tg_table_name = 'chamados' and tg_op = 'INSERT' then 'chamado_aberto'::public.tipo_notificacao else 'status_alterado'::public.tipo_notificacao end,
      case when tg_table_name = 'chamados' and tg_op = 'INSERT' then 'Chamado relacionado à sua área foi aberto' else 'Atualização em chamado relacionado à sua área' end,
      mensagem_notificacao, chamado.id);
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare r record;
begin
  for r in
    select c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and t.tgname='trg_notificar_gestores_atividade' and not t.tgisinternal
  loop
    execute format('drop trigger if exists trg_notificar_gestores_atividade on public.%I', r.relname);
  end loop;
  create trigger trg_notificar_gestores_atividade after insert or update or delete on public.chamados for each row execute function public.notificar_gestores_atividade_sistema();
  create trigger trg_notificar_gestores_atividade after insert or update or delete on public.comentarios_chamado for each row execute function public.notificar_gestores_atividade_sistema();
  create trigger trg_notificar_gestores_atividade after insert or update or delete on public.anexos_chamado for each row execute function public.notificar_gestores_atividade_sistema();
end;
$$;

delete from public.notificacoes where titulo like 'Atividade no sistema:%';
