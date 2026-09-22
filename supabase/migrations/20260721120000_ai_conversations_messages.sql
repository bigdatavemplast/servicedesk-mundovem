-- AI assistant conversation history.
-- These tables are referenced by later migrations and must exist before them.

-- Vector search is used by later AI migrations.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id
  ON public.ai_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at
  ON public.ai_conversations(created_at);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.ai_conversations TO authenticated;

DROP POLICY IF EXISTS "Users can view own AI conversations" ON public.ai_conversations;
CREATE POLICY "Users can view own AI conversations"
  ON public.ai_conversations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own AI conversations" ON public.ai_conversations;
CREATE POLICY "Users can insert own AI conversations"
  ON public.ai_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own AI conversations" ON public.ai_conversations;
CREATE POLICY "Users can update own AI conversations"
  ON public.ai_conversations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  fontes JSONB NOT NULL DEFAULT '[]'::jsonb,
  confianca NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id
  ON public.ai_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at
  ON public.ai_messages(created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_messages_conversation_fk'
      AND conrelid = 'public.ai_messages'::regclass
  ) THEN
    ALTER TABLE public.ai_messages
      ADD CONSTRAINT ai_messages_conversation_fk
      FOREIGN KEY (conversation_id)
      REFERENCES public.ai_conversations(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.ai_messages TO authenticated;

DROP POLICY IF EXISTS "Users can view own AI messages" ON public.ai_messages;
CREATE POLICY "Users can view own AI messages"
  ON public.ai_messages
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own AI messages" ON public.ai_messages;
CREATE POLICY "Users can insert own AI messages"
  ON public.ai_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );
