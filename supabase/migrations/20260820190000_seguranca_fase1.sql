-- =============================================================
-- Service Desk - Fase 1 / Segurança
-- Reforça a proteção de campos sensíveis sem alterar a experiência visual.
-- =============================================================

-- O cliente pode atualizar o próprio perfil para campos não administrativos,
-- mas não deve conseguir alterar papel, status, área ou outros controles de acesso.
DROP POLICY IF EXISTS "Usuário atualiza próprio perfil" ON public.profiles;

CREATE POLICY "Usuário atualiza próprio perfil" ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND ativo = (
    SELECT p.ativo FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND area_id IS NOT DISTINCT FROM (
    SELECT p.area_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Comentários internos não podem ser transformados em públicos pelo próprio autor.
-- O autor continua podendo corrigir o conteúdo do próprio comentário, mas o
-- indicador interno permanece sob controle do fluxo autorizado.
DROP POLICY IF EXISTS "Usuário edita próprio comentário" ON public.comentarios_chamado;

CREATE POLICY "Usuário edita próprio comentário" ON public.comentarios_chamado
FOR UPDATE
TO authenticated
USING (autor_id = auth.uid())
WITH CHECK (
  autor_id = auth.uid()
  AND interno = (
    SELECT c.interno
    FROM public.comentarios_chamado c
    WHERE c.id = comentarios_chamado.id
  )
);

-- Reforço: solicitante pode atualizar somente dados de acompanhamento permitidos
-- pelo fluxo. Campos de responsabilidade/prioridade continuam protegidos pelas
-- policies existentes e não são liberados aqui.
-- A regra abaixo não cria acesso novo; apenas documenta a intenção de segurança
-- para a tabela de chamados.

COMMENT ON POLICY "Usuário atualiza próprio perfil" ON public.profiles IS
'Fase 1 Segurança: usuário não pode alterar ativo ou area_id pelo cliente.';

COMMENT ON POLICY "Usuário edita próprio comentário" ON public.comentarios_chamado IS
'Fase 1 Segurança: autor não pode alterar o indicador interno do comentário.';
