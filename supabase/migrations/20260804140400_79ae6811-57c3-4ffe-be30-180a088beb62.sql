-- 1) match_conhecimento: escopar chamados ao usuário chamador
CREATE OR REPLACE FUNCTION public.match_conhecimento(query_embedding vector, match_threshold double precision DEFAULT 0.55, match_count integer DEFAULT 8)
 RETURNS TABLE(origem text, ref_id uuid, titulo text, conteudo text, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH artigos AS (
    SELECT 'base_conhecimento'::text AS origem, b.id AS ref_id, b.titulo::text AS titulo,
           b.conteudo AS conteudo, 1 - (b.embedding <=> query_embedding) AS similarity
    FROM public.base_conhecimento b
    WHERE b.publicado = true AND b.embedding IS NOT NULL
  ),
  tickets AS (
    SELECT 'chamado'::text AS origem, c.id AS ref_id,
           (c.numero || ' — ' || c.titulo)::text AS titulo,
           c.descricao AS conteudo, 1 - (c.embedding <=> query_embedding) AS similarity
    FROM public.chamados c
    WHERE c.status IN ('resolvido','fechado') AND c.embedding IS NOT NULL
      AND auth.uid() IS NOT NULL
      AND (
        c.solicitante_id = auth.uid()
        OR c.atendente_id = auth.uid()
        OR public.has_any_role(auth.uid(), ARRAY['atendente','gestor','admin']::app_role[])
      )
  ),
  docs AS (
    SELECT 'documento'::text AS origem, d.id AS ref_id, d.titulo AS titulo,
           d.conteudo AS conteudo, 1 - (d.embedding <=> query_embedding) AS similarity
    FROM public.documentos_assistente d
    WHERE d.ativo = true AND d.embedding IS NOT NULL
  ),
  todos AS (
    SELECT * FROM artigos UNION ALL SELECT * FROM tickets UNION ALL SELECT * FROM docs
  )
  SELECT t.origem, t.ref_id, t.titulo, t.conteudo, t.similarity
  FROM todos t
  WHERE t.similarity >= match_threshold
  ORDER BY (CASE t.origem WHEN 'base_conhecimento' THEN 0 WHEN 'chamado' THEN 1 ELSE 2 END),
           t.similarity DESC
  LIMIT match_count;
$function$;

-- 2) histórico do chamado: exigir vínculo com o chamado
DROP POLICY IF EXISTS "Sistema/usuário insere histórico" ON public.historico_chamado;
CREATE POLICY "Sistema/usuário insere histórico"
ON public.historico_chamado FOR INSERT TO authenticated
WITH CHECK (
  (autor_id IS NULL OR autor_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = historico_chamado.chamado_id
      AND (
        c.solicitante_id = auth.uid()
        OR c.atendente_id = auth.uid()
        OR public.has_any_role(auth.uid(), ARRAY['atendente','gestor','admin']::app_role[])
      )
  )
);

-- 3) remover políticas duplicadas no papel public
DROP POLICY IF EXISTS "Users can view own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can view own messages" ON public.ai_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.ai_messages;

-- manter acesso por dono da conversa (mensagens do assistente têm user_id nulo)
DROP POLICY IF EXISTS "Usuários podem visualizar suas mensagens" ON public.ai_messages;
CREATE POLICY "Usuários podem visualizar suas mensagens"
ON public.ai_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ai_conversations c
  WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Usuários podem inserir suas mensagens" ON public.ai_messages;
CREATE POLICY "Usuários podem inserir suas mensagens"
ON public.ai_messages FOR INSERT TO authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
  )
);

-- 4) search_path fixo em funções sem configuração
CREATE OR REPLACE FUNCTION public.tg_atualizado_em()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.atualizado_em := NOW(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.buscar_artigos_semanticos(query_embedding vector, match_count integer DEFAULT 5)
 RETURNS TABLE(id uuid, titulo text, conteudo text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select b.id, b.titulo::text, b.conteudo, 1 - (b.embedding <=> query_embedding) as similarity
  from public.base_conhecimento b
  where b.publicado = true and b.embedding is not null
  order by b.embedding <=> query_embedding
  limit match_count;
$function$;

-- 5) restringir EXECUTE de funções SECURITY DEFINER
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.chamado_before_insert() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.tg_atualizado_em() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.buscar_artigos_semanticos(vector, integer) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.match_conhecimento(vector, double precision, integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.has_any_role(uuid, app_role[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.match_conhecimento(vector, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated;