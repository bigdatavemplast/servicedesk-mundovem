-- Permite que admin e gestor alternem o contexto da interface entre atendente e colaborador.
-- O papel real do usuário permanece intacto.

DROP POLICY IF EXISTS "Usuário cria próprio modo" ON public.preferencias_atendimento;
CREATE POLICY "Usuário cria próprio modo"
ON public.preferencias_atendimento FOR INSERT TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'atendente')
    OR public.has_role(auth.uid(), 'gestor')
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "Usuário atualiza próprio modo" ON public.preferencias_atendimento;
CREATE POLICY "Usuário atualiza próprio modo"
ON public.preferencias_atendimento FOR UPDATE TO authenticated
USING (
  usuario_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'atendente')
    OR public.has_role(auth.uid(), 'gestor')
    OR public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (
  usuario_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'atendente')
    OR public.has_role(auth.uid(), 'gestor')
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE OR REPLACE FUNCTION public.alterar_modo_atendimento(_modo VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'atendente')
    OR public.has_role(auth.uid(), 'gestor')
    OR public.has_role(auth.uid(), 'admin')
  ) THEN
    RAISE EXCEPTION 'Usuário sem permissão para alternar o modo de atendimento';
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
