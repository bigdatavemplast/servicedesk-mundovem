-- Notifica os gestores sobre alterações de dados nos módulos do Service Desk.
create or replace function public.notificar_gestores_atividade_sistema()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  registro jsonb;
  evento text;
  nome_modulo text;
  titulo_notificacao text;
  mensagem_notificacao text;
  id_chamado uuid;
  autor_id uuid;
  gestor record;
begin
  if tg_op = 'DELETE' then
    registro := to_jsonb(old);
    evento := 'excluído';
  elsif tg_op = 'INSERT' then
    registro := to_jsonb(new);
    evento := 'criado';
  else
    if to_jsonb(old) = to_jsonb(new) then
      return new;
    end if;
    registro := to_jsonb(new);
    evento := 'atualizado';
  end if;

  autor_id := auth.uid();
  nome_modulo := case tg_table_name
    when 'chamados' then 'chamado'
    when 'comentarios_chamado' then 'comentário de chamado'
    when 'anexos_chamado' then 'anexo de chamado'
    when 'profiles' then 'usuário'
    when 'user_roles' then 'perfil de acesso'
    when 'areas' then 'área'
    when 'departamentos' then 'departamento'
    when 'categorias' then 'categoria'
    when 'subcategorias' then 'subcategoria'
    when 'tipos_chamado' then 'tipo de chamado'
    when 'base_conhecimento' then 'artigo da base de conhecimento'
    when 'itsm_ativos' then 'ativo de TI'
    when 'itsm_problemas' then 'problema ITSM'
    when 'itsm_mudancas' then 'mudança ITSM'
    when 'itsm_servicos' then 'serviço ITSM'
    when 'itsm_relacionamentos' then 'relacionamento ITSM'
    when 'itsm_artigos_conhecimento' then 'artigo de conhecimento ITSM'
    when 'itsm_governanca' then 'registro de governança ITSM'
    when 'itsm_politicas_governanca' then 'política de governança'
    when 'itsm_aprovacoes' then 'aprovação ITSM'
    when 'itsm_itens_catalogo' then 'item do catálogo'
    when 'itsm_catalogo_avancado' then 'item do catálogo avançado'
    when 'alteracoes_service_desk' then 'alteração do Service Desk'
    when 'automacoes_service_desk' then 'automação'
    when 'regras_atribuicao_automatica' then 'regra de atribuição automática'
    when 'escalonamento_regras' then 'regra de escalonamento'
    when 'grupos_atendimento' then 'grupo de atendimento'
    when 'grupo_atendentes' then 'membro de grupo de atendimento'
    when 'gestao_capacidade' then 'registro de capacidade'
    when 'itsm_permissoes_usuario' then 'permissão ITSM'
    when 'documentacao_sistema' then 'documentação do sistema'
    else replace(replace(tg_table_name, 'itsm_', 'ITSM '), '_', ' ')
  end;

  id_chamado := null;
  if tg_table_name = 'chamados' then
    id_chamado := nullif(registro->>'id', '')::uuid;
  elsif coalesce(registro->>'chamado_id', '') <> '' then
    id_chamado := (registro->>'chamado_id')::uuid;
  end if;

  titulo_notificacao := 'Atividade no sistema: ' || nome_modulo;
  mensagem_notificacao := 'Um registro foi ' || evento || ' no módulo ' || nome_modulo ||
    case when coalesce(registro->>'numero', '') <> '' then ' (' || (registro->>'numero') || ')' else '' end || '.';

  for gestor in
    select distinct ur.user_id
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.role = 'gestor'::public.app_role
      and p.ativo = true
      and (autor_id is null or ur.user_id <> autor_id)
  loop
    insert into public.notificacoes (destinatario_id, tipo, titulo, mensagem, chamado_id)
    values (gestor.user_id, 'status_alterado'::public.tipo_notificacao, titulo_notificacao, mensagem_notificacao, id_chamado);
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  tabela text;
  tabelas text[] := array[
    'chamados','comentarios_chamado','anexos_chamado',
    'profiles','user_roles','areas','departamentos','segmentos',
    'categorias','subcategorias','tipos_chamado','slas','sla_regras',
    'sla_calendarios','sla_calendario_horarios',
    'base_conhecimento','base_conhecimento_avaliacoes','base_conhecimento_feedback',
    'itsm_ativos','itsm_problemas','itsm_mudancas','itsm_servicos',
    'itsm_relacionamentos','itsm_artigos_conhecimento','itsm_governanca',
    'itsm_politicas_governanca','itsm_aprovacoes','itsm_itens_catalogo',
    'itsm_catalogo_avancado','itsm_permissoes_usuario','itsm_mudanca_chamado',
    'itsm_problema_chamado','itsm_servico_chamado','alteracoes_service_desk',
    'automacoes_service_desk','regras_atribuicao_automatica','escalonamento_regras',
    'grupos_atendimento','grupo_atendentes','grupo_sequencias','gestao_capacidade',
    'documentacao_sistema','perguntas_sem_resposta','pesquisas_satisfacao_equipe',
    'preferencias_atendimento'
  ];
begin
  foreach tabela in array tabelas loop
    if to_regclass(format('public.%I', tabela)) is not null then
      execute format('drop trigger if exists trg_notificar_gestores_atividade on public.%I', tabela);
      execute format(
        'create trigger trg_notificar_gestores_atividade after insert or update or delete on public.%I for each row execute function public.notificar_gestores_atividade_sistema()',
        tabela
      );
    end if;
  end loop;
end;
$$;
