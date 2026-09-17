-- Atendentes ficam limitados à área atribuída somente no modo atendente.
-- Ao alternar para colaborador, o mesmo usuário pode visualizar todas as áreas.

DROP POLICY IF EXISTS "Autenticados leem segmentos conforme area" ON public.segmentos;

CREATE POLICY "Autenticados leem segmentos conforme area e modo"
ON public.segmentos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR NOT public.has_role(auth.uid(), 'atendente')
  OR EXISTS (
    SELECT 1
    FROM public.preferencias_atendimento pa
    WHERE pa.usuario_id = auth.uid()
      AND pa.modo_ativo = 'colaborador'
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.areas a ON a.id = p.area_id
    WHERE p.id = auth.uid()
      AND a.ativo = TRUE
      AND public.normalizar_nome_area(a.nome) = public.normalizar_nome_area(public.segmentos.nome)
  )
);
