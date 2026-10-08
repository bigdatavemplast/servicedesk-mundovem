-- Restringe leitura e alteração de chamados para atendentes ao próprio grupo/fila.
-- Admin continua com acesso irrestrito.

DROP POLICY IF EXISTS "Staff veem chamados conforme escopo" ON public.chamados;
DROP POLICY IF EXISTS "Escopo obrigatório de leitura dos chamados" ON public.chamados;
DROP POLICY IF EXISTS "Staff atualizam chamados conforme escopo" ON public.chamados;

CREATE POLICY "Staff veem chamados conforme escopo"
ON public.chamados
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'atendente'::app_role)
    AND (
      atendente_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.grupo_atendentes ga
        JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
        WHERE ga.usuario_id = auth.uid()
          AND ga.ativo = TRUE
          AND g.ativo = TRUE
          AND (
            (grupo_atendimento_id IS NOT NULL AND g.id = grupo_atendimento_id)
            OR (grupo_atendimento_id IS NULL AND g.segmento_id = chamados.segmento_id)
          )
      )
    )
  )
  OR (
    has_role(auth.uid(), 'colaborador'::app_role)
    AND solicitante_id = auth.uid()
  )
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND gestor_pode_ver_chamado(auth.uid(), id)
  )
);

CREATE POLICY "Staff atualizam chamados conforme escopo"
ON public.chamados
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'atendente'::app_role)
    AND (
      atendente_id = auth.uid()
      OR (
        atendente_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.grupo_atendentes ga
          JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
          WHERE ga.usuario_id = auth.uid()
            AND ga.ativo = TRUE
            AND g.ativo = TRUE
            AND (
              (grupo_atendimento_id IS NOT NULL AND g.id = grupo_atendimento_id)
              OR (grupo_atendimento_id IS NULL AND g.segmento_id = chamados.segmento_id)
            )
        )
      )
    )
  )
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND gestor_pode_ver_chamado(auth.uid(), id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'atendente'::app_role)
    AND (
      atendente_id = auth.uid()
      OR (
        atendente_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.grupo_atendentes ga
          JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
          WHERE ga.usuario_id = auth.uid()
            AND ga.ativo = TRUE
            AND g.ativo = TRUE
            AND (
              (grupo_atendimento_id IS NOT NULL AND g.id = grupo_atendimento_id)
              OR (grupo_atendimento_id IS NULL AND g.segmento_id = chamados.segmento_id)
            )
        )
      )
    )
  )
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND gestor_pode_ver_chamado(auth.uid(), id)
  )
);
