-- 1. Colunas novas em ai_messages
ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS fontes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confianca NUMERIC;

-- Permitir excluir conversas próprias + leitura para admin/atendente
DROP POLICY IF EXISTS "Usuário exclui suas conversas" ON public.ai_conversations;
CREATE POLICY "Usuário exclui suas conversas"
ON public.ai_conversations FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuário atualiza suas conversas" ON public.ai_conversations;
CREATE POLICY "Usuário atualiza suas conversas"
ON public.ai_conversations FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin e atendente veem conversas" ON public.ai_conversations;
CREATE POLICY "Admin e atendente veem conversas"
ON public.ai_conversations FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','atendente']::app_role[]));

DROP POLICY IF EXISTS "Admin e atendente veem mensagens" ON public.ai_messages;
CREATE POLICY "Admin e atendente veem mensagens"
ON public.ai_messages FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','atendente']::app_role[]));

-- 2. Embedding nos chamados
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Documentos do assistente
CREATE TABLE IF NOT EXISTS public.documentos_assistente (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'texto',
  categoria TEXT,
  conteudo TEXT NOT NULL,
  embedding vector(1536),
  criado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_assistente TO authenticated;
GRANT ALL ON public.documentos_assistente TO service_role;
ALTER TABLE public.documentos_assistente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem documentos ativos"
ON public.documentos_assistente FOR SELECT TO authenticated
USING (ativo = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin cria documentos"
ON public.documentos_assistente FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin edita documentos"
ON public.documentos_assistente FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin exclui documentos"
ON public.documentos_assistente FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_documentos_assistente_updated
BEFORE UPDATE ON public.documentos_assistente
FOR EACH ROW EXECUTE FUNCTION public.tg_atualizado_em();

-- 4. Perguntas sem resposta
CREATE TABLE IF NOT EXISTS public.perguntas_sem_resposta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pergunta TEXT NOT NULL,
  contexto TEXT,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confianca NUMERIC,
  resolvida BOOLEAN NOT NULL DEFAULT false,
  resposta_oficial TEXT,
  respondido_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perguntas_sem_resposta TO authenticated;
GRANT ALL ON public.perguntas_sem_resposta TO service_role;
ALTER TABLE public.perguntas_sem_resposta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário registra suas perguntas"
ON public.perguntas_sem_resposta FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuário vê suas perguntas"
ON public.perguntas_sem_resposta FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','atendente']::app_role[]));

CREATE POLICY "Admin responde perguntas"
ON public.perguntas_sem_resposta FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin exclui perguntas"
ON public.perguntas_sem_resposta FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_perguntas_sem_resposta_updated
BEFORE UPDATE ON public.perguntas_sem_resposta
FOR EACH ROW EXECUTE FUNCTION public.tg_atualizado_em();

-- 5. Índices vetoriais (1536 dims: índice direto)
CREATE INDEX IF NOT EXISTS idx_bc_embedding ON public.base_conhecimento
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chamados_embedding ON public.chamados
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_doc_assistente_embedding ON public.documentos_assistente
  USING hnsw (embedding vector_cosine_ops);

-- 6. Busca unificada por similaridade
CREATE OR REPLACE FUNCTION public.match_conhecimento(
  query_embedding vector(1536),
  match_threshold double precision DEFAULT 0.55,
  match_count integer DEFAULT 8
)
RETURNS TABLE (
  origem TEXT,
  ref_id UUID,
  titulo TEXT,
  conteudo TEXT,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.match_conhecimento(vector, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_conhecimento(vector, double precision, integer) TO authenticated, service_role;
