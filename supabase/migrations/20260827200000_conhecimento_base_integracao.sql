-- Integração oficial entre Gestão de Conhecimento e Base de Conhecimento.
-- Publicar um artigo passa a disponibilizá-lo na base pública/operacional.

-- A tabela de origem usa categoria por nome; a Base usa categoria_id.
-- O vínculo entre as duas tabelas é o mesmo UUID do artigo.

CREATE OR REPLACE FUNCTION public.incrementar_visualizacao_base_conhecimento(p_artigo_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.base_conhecimento
  SET visualizacoes = COALESCE(visualizacoes, 0) + 1
  WHERE id = p_artigo_id
    AND publicado = true;
$$;

GRANT EXECUTE ON FUNCTION public.incrementar_visualizacao_base_conhecimento(uuid) TO authenticated;

-- Corrige a contabilização para ocorrer no registro da Base, de forma atômica.
-- A aplicação chama a função acima em vez de fazer leitura + incremento.

-- Sincroniza artigos já publicados que existam no módulo de Gestão de Conhecimento.
INSERT INTO public.base_conhecimento (
  id, titulo, conteudo, categoria_id, publicado, visualizacoes, autor_id, criado_em, atualizado_em
)
SELECT
  a.id,
  a.titulo,
  a.conteudo,
  c.id,
  true,
  COALESCE(a.visualizacoes, 0),
  a.autor_id,
  a.criado_em,
  a.atualizado_em
FROM public.itsm_artigos_conhecimento a
LEFT JOIN public.categorias c ON c.nome = a.categoria AND c.ativo = true
WHERE a.status = 'publicado'
ON CONFLICT (id) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  conteudo = EXCLUDED.conteudo,
  categoria_id = EXCLUDED.categoria_id,
  publicado = true,
  atualizado_em = EXCLUDED.atualizado_em;
