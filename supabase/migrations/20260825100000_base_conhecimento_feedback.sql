-- Feedback de utilidade dos artigos da Base de Conhecimento
CREATE TABLE public.base_conhecimento_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artigo_id UUID NOT NULL REFERENCES public.base_conhecimento(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  util BOOLEAN NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artigo_id, usuario_id)
);

CREATE INDEX idx_bc_feedback_artigo ON public.base_conhecimento_feedback(artigo_id);
CREATE INDEX idx_bc_feedback_usuario ON public.base_conhecimento_feedback(usuario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_conhecimento_feedback TO authenticated;
GRANT ALL ON public.base_conhecimento_feedback TO service_role;
ALTER TABLE public.base_conhecimento_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê próprio feedback" ON public.base_conhecimento_feedback
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "Usuário cria próprio feedback" ON public.base_conhecimento_feedback
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "Usuário atualiza próprio feedback" ON public.base_conhecimento_feedback
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "Usuário exclui próprio feedback" ON public.base_conhecimento_feedback
  FOR DELETE TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "Atendente gestor admin consultam feedback" ON public.base_conhecimento_feedback
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['atendente','gestor','admin']::public.app_role[]));

CREATE TRIGGER trg_bc_feedback_updated BEFORE UPDATE ON public.base_conhecimento_feedback
FOR EACH ROW EXECUTE FUNCTION public.tg_atualizado_em();
