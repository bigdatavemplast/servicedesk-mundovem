-- Alternancia temporária de contexto do atendente para colaborador.
-- O papel real do usuário permanece intacto; o frontend usa esta preferência
-- apenas para alternar a experiência de abertura de chamados.

CREATE TABLE IF NOT EXISTS public.preferencias_atendimento (
  usuario_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  modo_ativo VARCHAR(20) NOT NULL DEFAULT 'atendente',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT preferencias_atendimento_modo_check
    CHECK (modo_ativo IN ('atendente', 'colaborador'))
);

ALTER TABLE public.preferencias_atendimento ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.preferencias_atendimento TO authenticated;
GRANT ALL ON public.preferencias_atendimento TO service_role;

DROP POLICY IF EXISTS "Usuário lê próprio modo" ON public.preferencias_atendimento;
CREATE POLICY "Usuário lê próprio modo"
ON public.preferencias_atendimento FOR SELECT TO authenticated
USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Usuário cria próprio modo" ON public.preferencias_atendimento;
CREATE POLICY "Usuário cria próprio modo"
ON public.preferencias_atendimento FOR INSERT TO authenticated
WITH CHECK (usuario_id = auth.uid() AND public.has_role(auth.uid(), 'atendente'));

DROP POLICY IF EXISTS "Usuário atualiza próprio modo" ON public.preferencias_atendimento;
CREATE POLICY "Usuário atualiza próprio modo"
ON public.preferencias_atendimento FOR UPDATE TO authenticated
USING (usuario_id = auth.uid() AND public.has_role(auth.uid(), 'atendente'))
WITH CHECK (usuario_id = auth.uid() AND public.has_role(auth.uid(), 'atendente'));

CREATE OR REPLACE FUNCTION public.alterar_modo_atendimento(_modo VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'atendente') THEN
    RAISE EXCEPTION 'Somente atendente pode alternar o modo de atendimento';
  END IF;

  IF _modo NOT IN ('atendente', 'colaborador') THEN
    RAISE EXCEPTION 'Modo inválido';
  END IF;

  INSERT INTO public.preferencias_atendimento (usuario_id, modo_ativo, atualizado_em)
  VALUES (auth.uid(), _modo, NOW())
  ON CONFLICT (usuario_id)
  DO UPDATE SET modo_ativo = EXCLUDED.modo_ativo, atualizado_em = NOW();

  RETURN _modo;
END;
$$;

REVOKE ALL ON FUNCTION public.alterar_modo_atendimento(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_modo_atendimento(VARCHAR) TO authenticated;
