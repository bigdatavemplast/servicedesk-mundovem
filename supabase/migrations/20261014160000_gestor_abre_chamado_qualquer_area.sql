-- Gestores podem abrir chamados para qualquer segmento ativo.
-- A autorização continua exigindo que o solicitante seja o próprio usuário;
-- a categoria/segmento escolhido é validado pela função de criação e pelos triggers.
DROP POLICY IF EXISTS "Gestor abre chamado na própria área" ON public.chamados;

CREATE POLICY "Gestor abre chamado em qualquer área"
ON public.chamados
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  AND solicitante_id = auth.uid()
  AND segmento_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.segmentos s
    WHERE s.id = chamados.segmento_id
      AND s.ativo = true
  )
);
