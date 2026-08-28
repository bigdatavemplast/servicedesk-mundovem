-- RPCs do feedback de utilidade da Base de Conhecimento.
-- A tabela base_conhecimento_feedback já existe em migration anterior.

CREATE OR REPLACE FUNCTION public.avaliar_artigo_base_conhecimento(
  p_artigo_id uuid,
  p_util boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.base_conhecimento
    WHERE id = p_artigo_id
      AND publicado = true
  ) THEN
    RAISE EXCEPTION 'Artigo não encontrado ou não publicado';
  END IF;

  INSERT INTO public.base_conhecimento_feedback (artigo_id, usuario_id, util)
  VALUES (p_artigo_id, auth.uid(), p_util)
  ON CONFLICT (artigo_id, usuario_id)
  DO UPDATE SET
    util = EXCLUDED.util,
    atualizado_em = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_feedback_artigo_base_conhecimento(
  p_artigo_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'util_sim', COUNT(*) FILTER (WHERE f.util),
    'util_nao', COUNT(*) FILTER (WHERE NOT f.util),
    'total', COUNT(*),
    'percentual', CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE f.util))::numeric * 100 / COUNT(*), 0)
    END,
    'meu_voto', (
      SELECT CASE WHEN f2.util THEN 'sim' ELSE 'nao' END
      FROM public.base_conhecimento_feedback f2
      WHERE f2.artigo_id = p_artigo_id
        AND f2.usuario_id = auth.uid()
      LIMIT 1
    )
  )
  FROM public.base_conhecimento_feedback f
  WHERE f.artigo_id = p_artigo_id;
$$;

REVOKE ALL ON FUNCTION public.avaliar_artigo_base_conhecimento(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avaliar_artigo_base_conhecimento(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.obter_feedback_artigo_base_conhecimento(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_feedback_artigo_base_conhecimento(uuid) TO authenticated;
