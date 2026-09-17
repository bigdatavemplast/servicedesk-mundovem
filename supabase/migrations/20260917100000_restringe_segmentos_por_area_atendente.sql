-- =============================================================
-- Service Desk - restringe áreas/segmentos para atendentes
-- =============================================================
-- Atendentes devem acessar somente o segmento cujo nome corresponde
-- à área atribuída em public.profiles.area_id.
-- Admins e demais perfis continuam podendo consultar os segmentos ativos.

DROP POLICY IF EXISTS "Autenticados leem segmentos" ON public.segmentos;

CREATE POLICY "Autenticados leem segmentos conforme escopo"
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
      AND a.nome = segmentos.nome
  )
);
