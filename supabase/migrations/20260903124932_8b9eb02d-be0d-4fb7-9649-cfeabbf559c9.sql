-- Sincronização do módulo ITSM com a Base de Conhecimento:
-- publicado -> cria/atualiza e mantém visível
-- rascunho/em_revisao/arquivado -> mantém o registro no banco, apenas oculta da base pública
CREATE OR REPLACE FUNCTION public.sincronizar_artigo_conhecimento_publicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_slug text;
  v_categoria_id uuid;
begin
  if new.status <> 'publicado' then
    -- Não apaga nada: apenas retira o artigo da visualização pública.
    update public.base_conhecimento
       set publicado = false,
           titulo = new.titulo,
           conteudo = new.conteudo,
           atualizado_em = now()
     where id = new.id;
    return new;
  end if;

  v_slug := public.slugify_conhecimento(new.titulo);

  select c.id into v_categoria_id
  from public.categorias c
  where c.ativo = true and lower(c.nome) = lower(new.categoria)
  limit 1;

  insert into public.base_conhecimento (
    id, titulo, slug, conteudo, categoria_id, publicado,
    visualizacoes, autor_id, criado_em, atualizado_em
  ) values (
    new.id, new.titulo, v_slug, new.conteudo, v_categoria_id, true,
    coalesce(new.visualizacoes, 0), new.autor_id, new.criado_em, now()
  )
  on conflict (id) do update set
    titulo = excluded.titulo,
    slug = excluded.slug,
    conteudo = excluded.conteudo,
    categoria_id = excluded.categoria_id,
    publicado = true,
    visualizacoes = greatest(public.base_conhecimento.visualizacoes, excluded.visualizacoes),
    atualizado_em = now();

  return new;
end;
$function$;

-- Exclusão definitiva remove também o espelho na Base de Conhecimento.
CREATE OR REPLACE FUNCTION public.remover_artigo_base_conhecimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  delete from public.base_conhecimento where id = old.id;
  return old;
end;
$function$;

REVOKE ALL ON FUNCTION public.remover_artigo_base_conhecimento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_remover_artigo_base_conhecimento ON public.itsm_artigos_conhecimento;
CREATE TRIGGER trg_remover_artigo_base_conhecimento
AFTER DELETE ON public.itsm_artigos_conhecimento
FOR EACH ROW EXECUTE FUNCTION public.remover_artigo_base_conhecimento();