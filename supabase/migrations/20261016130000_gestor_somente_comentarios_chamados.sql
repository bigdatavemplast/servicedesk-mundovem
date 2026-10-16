-- Gestor: somente leitura de chamados e inclusão de comentários públicos.
-- Reforça a regra no banco, além dos controles da interface.

CREATE OR REPLACE FUNCTION public.bloquear_alteracao_chamado_por_gestor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Permite efeitos automáticos de triggers internos (por exemplo, atualização
  -- de SLA após um comentário), mas bloqueia UPDATEs iniciados pelo gestor.
  IF auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(), 'gestor'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'Perfil Gestor: chamados não podem ser alterados. É permitido apenas adicionar comentários públicos.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aaa_gestor_somente_comentarios ON public.chamados;
CREATE TRIGGER trg_aaa_gestor_somente_comentarios
BEFORE UPDATE ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_alteracao_chamado_por_gestor();

CREATE OR REPLACE FUNCTION public.bloquear_anexos_por_gestor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(), 'gestor'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Perfil Gestor: não é permitido adicionar ou remover anexos de chamados.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gestor_bloqueia_anexos ON public.anexos_chamado;
CREATE TRIGGER trg_gestor_bloqueia_anexos
BEFORE INSERT OR DELETE ON public.anexos_chamado
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_anexos_por_gestor();

CREATE OR REPLACE FUNCTION public.bloquear_edicao_comentario_por_gestor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(), 'gestor'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF TG_OP <> 'INSERT' THEN
      RAISE EXCEPTION 'Perfil Gestor: comentários podem ser adicionados, mas não editados ou removidos.';
    END IF;
    IF COALESCE(NEW.interno, FALSE) THEN
      RAISE EXCEPTION 'Perfil Gestor: somente comentários públicos são permitidos.';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gestor_comentarios_publicos ON public.comentarios_chamado;
CREATE TRIGGER trg_gestor_comentarios_publicos
BEFORE INSERT OR UPDATE OR DELETE ON public.comentarios_chamado
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_edicao_comentario_por_gestor();

DROP POLICY IF EXISTS "Gestor não altera chamados" ON public.chamados;
CREATE POLICY "Gestor não altera chamados"
ON public.chamados AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
)
WITH CHECK (
  NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Gestor não envia anexos" ON public.anexos_chamado;
CREATE POLICY "Gestor não envia anexos"
ON public.anexos_chamado AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Gestor não remove anexos" ON public.anexos_chamado;
CREATE POLICY "Gestor não remove anexos"
ON public.anexos_chamado AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Gestor só adiciona comentários" ON public.comentarios_chamado;
CREATE POLICY "Gestor só adiciona comentários"
ON public.comentarios_chamado AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
)
WITH CHECK (
  NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Gestor não remove comentários" ON public.comentarios_chamado;
CREATE POLICY "Gestor não remove comentários"
ON public.comentarios_chamado AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Gestor não insere histórico manual" ON public.historico_chamado;
CREATE POLICY "Gestor não insere histórico manual"
ON public.historico_chamado AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Gestor não envia arquivos ao storage" ON storage.objects;
CREATE POLICY "Gestor não envia arquivos ao storage"
ON storage.objects AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id <> 'chamados-anexos'
  OR NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Gestor não remove arquivos do storage" ON storage.objects;
CREATE POLICY "Gestor não remove arquivos do storage"
ON storage.objects AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  bucket_id <> 'chamados-anexos'
  OR NOT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);
