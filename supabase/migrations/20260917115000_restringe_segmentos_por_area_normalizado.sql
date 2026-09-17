-- =============================================================
-- Service Desk - escopo de áreas para atendentes com nomes normalizados
-- =============================================================
-- Aceita variações como "T.I." / "TI" sem abrir acesso a outras áreas.

DROP POLICY IF EXISTS "Autenticados leem segmentos conforme escopo" ON public.segmentos;
DROP POLICY IF EXISTS "Autenticados leem segmentos" ON public.segmentos;

CREATE OR REPLACE FUNCTION public.normalizar_nome_area(_nome TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(upper(trim(COALESCE(_nome, ''))), '[^A-Z0-9]+', '', 'g');
$$;

REVOKE ALL ON FUNCTION public.normalizar_nome_area(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalizar_nome_area(TEXT) TO authenticated;

CREATE POLICY "Autenticados leem segmentos conforme area"
ON public.segmentos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR NOT public.has_role(auth.uid(), 'atendente')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.areas a ON a.id = p.area_id
    WHERE p.id = auth.uid()
      AND a.ativo = TRUE
      AND public.normalizar_nome_area(a.nome) = public.normalizar_nome_area(segmentos.nome)
  )
);
