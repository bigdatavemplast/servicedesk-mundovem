-- =============================================================
-- Service Desk - corrige o escopo dos segmentos pela área atribuída
-- =============================================================
-- A regra anterior dependia de has_role(..., 'atendente').
-- Para a tela de Áreas, o vínculo explícito profiles.area_id é a fonte
-- de verdade. Usuário com área atribuída vê somente o segmento equivalente.
-- Admin continua com acesso global; usuário sem área mantém o catálogo global.

DROP POLICY IF EXISTS "Autenticados leem segmentos conforme area" ON public.segmentos;
DROP POLICY IF EXISTS "Autenticados leem segmentos conforme escopo" ON public.segmentos;
DROP POLICY IF EXISTS "Autenticados leem segmentos" ON public.segmentos;

CREATE POLICY "Autenticados leem segmentos conforme area atribuida"
ON public.segmentos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.area_id IS NOT NULL
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.areas a ON a.id = p.area_id
    WHERE p.id = auth.uid()
      AND p.area_id IS NOT NULL
      AND a.ativo = TRUE
      AND public.normalizar_nome_area(a.nome) = public.normalizar_nome_area(segmentos.nome)
  )
);
