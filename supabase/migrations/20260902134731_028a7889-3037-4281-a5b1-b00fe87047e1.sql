CREATE OR REPLACE FUNCTION public.perfil_visivel_por_chamado(_perfil_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.solicitante_id = _user_id
      AND (c.atendente_id = _perfil_id OR c.triagem_por = _perfil_id)
  );
$$;

REVOKE ALL ON FUNCTION public.perfil_visivel_por_chamado(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perfil_visivel_por_chamado(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Solicitante vê atendente do seu chamado" ON public.profiles;
CREATE POLICY "Solicitante vê atendente do seu chamado"
ON public.profiles FOR SELECT TO authenticated
USING (public.perfil_visivel_por_chamado(id, auth.uid()));