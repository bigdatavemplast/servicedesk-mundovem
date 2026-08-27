-- A tabela base_conhecimento exige slug. A integracao anterior nao o preenchia.
-- Esta migration corrige a sincronizacao dos artigos ja publicados e cria
-- trigger para manter a Base de Conhecimento sincronizada nas publicacoes futuras.

create or replace function public.slugify_conhecimento(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  v_slug text;
begin
  v_slug := lower(trim(coalesce(p_text, '')));
  v_slug := translate(v_slug,
    'áàãâäéèêëíìîïóòõôöúùûüçñÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn');
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '(^-|-$)', '', 'g');
  if v_slug = '' then v_slug := 'artigo'; end if;
  return v_slug;
end;
$$;

-- Corrige registros publicados já existentes que possam estar sem slug.
update public.base_conhecimento bc
set slug = public.slugify_conhecimento(bc.titulo)
where bc.slug is null or trim(bc.slug) = '';

-- Garante slug único sem alterar o título original.
with duplicados as (
  select id, slug,
         row_number() over (partition by slug order by criado_em, id) as rn
  from public.base_conhecimento
  where slug is not null
)
update public.base_conhecimento bc
set slug = bc.slug || '-' || d.rn
from duplicados d
where bc.id = d.id and d.rn > 1;

-- Sincroniza artigos ITSM publicados para a Base de Conhecimento.
create or replace function public.sincronizar_artigo_conhecimento_publicado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_categoria_id uuid;
begin
  if new.status <> 'publicado' then
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
$$;

drop trigger if exists trg_sincronizar_artigo_conhecimento_publicado
on public.itsm_artigos_conhecimento;

create trigger trg_sincronizar_artigo_conhecimento_publicado
after insert or update of status, titulo, conteudo, categoria
on public.itsm_artigos_conhecimento
for each row
execute function public.sincronizar_artigo_conhecimento_publicado();
