-- Permite que colaboradores visualizem todos os chamados que estão abertos,
-- independentemente da área do solicitante.
-- Não concede permissão de edição nem acesso a chamados já encerrados.
CREATE POLICY "Colaborador vê chamados abertos de todas as áreas"
  ON public.chamados
  FOR SELECT TO authenticated
  USING (
    status = 'aberto'
    AND public.has_role(auth.uid(), 'colaborador')
  );
