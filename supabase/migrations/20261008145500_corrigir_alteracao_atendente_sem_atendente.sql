-- Corrige a política de UPDATE para permitir que o atendente edite o chamado
-- enquanto ele ainda está sem responsável. A atribuição para si é opcional.
DROP POLICY IF EXISTS "Staff atualizam chamados conforme escopo" ON public.chamados;

CREATE POLICY "Staff atualizam chamados conforme escopo"
ON public.chamados
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'atendente'::app_role)
    AND chamados.atendente_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.grupo_atendentes ga
      JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
      WHERE ga.usuario_id = auth.uid()
        AND ga.ativo = TRUE
        AND g.ativo = TRUE
        AND (
          (chamados.grupo_atendimento_id IS NOT NULL AND g.id = chamados.grupo_atendimento_id)
          OR (chamados.grupo_atendimento_id IS NULL AND g.segmento_id = chamados.segmento_id)
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
    AND (chamados.atendente_id IS NULL OR chamados.atendente_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.grupo_atendentes ga
      JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
      WHERE ga.usuario_id = auth.uid()
        AND ga.ativo = TRUE
        AND g.ativo = TRUE
        AND (
          (chamados.grupo_atendimento_id IS NOT NULL AND g.id = chamados.grupo_atendimento_id)
          OR (chamados.grupo_atendimento_id IS NULL AND g.segmento_id = chamados.segmento_id)
        )
    )
  )
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND gestor_pode_ver_chamado(auth.uid(), id)
  )
);

CREATE OR REPLACE FUNCTION public.validar_permissoes_chamado_por_papel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_evaluation_close boolean := false;
  v_reopen boolean := false;
BEGIN
  IF v_actor IS NULL THEN RETURN NEW; END IF;

  SELECT ur.role INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_actor
  ORDER BY CASE ur.role
    WHEN 'admin' THEN 1
    WHEN 'gestor' THEN 2
    WHEN 'atendente' THEN 3
    WHEN 'colaborador' THEN 4
  END
  LIMIT 1;

  IF v_role = 'admin' THEN RETURN NEW; END IF;

  v_evaluation_close := v_role = 'colaborador'
    AND OLD.solicitante_id = v_actor AND NEW.solicitante_id = v_actor
    AND OLD.status = 'resolvido' AND NEW.status = 'fechado'
    AND OLD.avaliacao_nota IS NULL AND NEW.avaliacao_nota IS NOT NULL;

  v_reopen := v_role = 'colaborador'
    AND OLD.solicitante_id = v_actor AND NEW.solicitante_id = v_actor
    AND OLD.status IN ('resolvido','fechado') AND NEW.status = 'reaberto'
    AND OLD.resolvido_em IS NOT NULL
    AND OLD.resolvido_em > now() - interval '48 hours';

  IF v_role = 'colaborador' THEN
    IF OLD.solicitante_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Colaborador só pode alterar os próprios chamados.';
    END IF;
    IF v_reopen THEN RETURN NEW; END IF;
    IF NOT v_evaluation_close AND (
      NEW.atendente_id IS DISTINCT FROM OLD.atendente_id OR
      NEW.grupo_atendimento_id IS DISTINCT FROM OLD.grupo_atendimento_id OR
      NEW.segmento_id IS DISTINCT FROM OLD.segmento_id OR
      NEW.categoria_id IS DISTINCT FROM OLD.categoria_id OR
      NEW.subcategoria_id IS DISTINCT FROM OLD.subcategoria_id OR
      NEW.prioridade IS DISTINCT FROM OLD.prioridade OR
      NEW.impacto IS DISTINCT FROM OLD.impacto OR
      NEW.urgencia IS DISTINCT FROM OLD.urgencia OR
      NEW.status IS DISTINCT FROM OLD.status OR
      NEW.sla_id IS DISTINCT FROM OLD.sla_id OR
      NEW.sla_regra_id IS DISTINCT FROM OLD.sla_regra_id OR
      NEW.prazo_resposta IS DISTINCT FROM OLD.prazo_resposta OR
      NEW.prazo_resolucao IS DISTINCT FROM OLD.prazo_resolucao
    ) THEN
      RAISE EXCEPTION 'Colaborador não possui permissão para alterar a operação do chamado.';
    END IF;
    RETURN NEW;
  END IF;

  IF v_role = 'atendente' THEN
    IF OLD.atendente_id IS NOT NULL THEN
      RAISE EXCEPTION 'Atendente só pode operar chamados que ainda não possuem atendente.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.grupo_atendentes ga
      JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
      WHERE ga.usuario_id = v_actor
        AND ga.ativo = TRUE
        AND g.ativo = TRUE
        AND (
          (OLD.grupo_atendimento_id IS NOT NULL AND g.id = OLD.grupo_atendimento_id)
          OR (OLD.grupo_atendimento_id IS NULL AND g.segmento_id = OLD.segmento_id)
        )
    ) THEN
      RAISE EXCEPTION 'Atendente só pode operar chamados sem atendente da própria área/grupo.';
    END IF;

    IF NEW.atendente_id IS DISTINCT FROM OLD.atendente_id
       AND NEW.atendente_id IS NOT NULL
       AND NEW.atendente_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Atendente só pode assumir o chamado para si mesmo.';
    END IF;

    IF NEW.solicitante_id IS DISTINCT FROM OLD.solicitante_id OR
       NEW.grupo_atendimento_id IS DISTINCT FROM OLD.grupo_atendimento_id OR
       NEW.segmento_id IS DISTINCT FROM OLD.segmento_id OR
       NEW.sla_id IS DISTINCT FROM OLD.sla_id OR
       NEW.sla_regra_id IS DISTINCT FROM OLD.sla_regra_id OR
       NEW.prazo_resposta IS DISTINCT FROM OLD.prazo_resposta OR
       NEW.prazo_resolucao IS DISTINCT FROM OLD.prazo_resolucao OR
       NEW.sla_tempo_resposta_segundos IS DISTINCT FROM OLD.sla_tempo_resposta_segundos OR
       NEW.sla_tempo_resolucao_segundos IS DISTINCT FROM OLD.sla_tempo_resolucao_segundos OR
       NEW.escalonamento_nivel IS DISTINCT FROM OLD.escalonamento_nivel OR
       NEW.escalonado IS DISTINCT FROM OLD.escalonado THEN
      RAISE EXCEPTION 'Atendente não pode alterar roteamento, setor ou regras de SLA.';
    END IF;

    RETURN NEW;
  END IF;

  IF v_role = 'gestor' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.grupo_atendentes ga
      JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
      WHERE ga.usuario_id = v_actor
        AND ga.ativo = TRUE
        AND g.ativo = TRUE
        AND (
          (OLD.grupo_atendimento_id IS NOT NULL AND g.id = OLD.grupo_atendimento_id)
          OR (OLD.grupo_atendimento_id IS NULL AND g.segmento_id = OLD.segmento_id)
        )
    ) AND NOT public.gestor_pode_ver_chamado(v_actor, OLD.id) THEN
      RAISE EXCEPTION 'Gestor não possui permissão para operar este chamado.';
    END IF;

    IF NEW.segmento_id IS DISTINCT FROM OLD.segmento_id THEN
      RAISE EXCEPTION 'Gestor não pode mover chamados para outro setor.';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Usuário não possui permissão para alterar chamados.';
END;
$function$;
