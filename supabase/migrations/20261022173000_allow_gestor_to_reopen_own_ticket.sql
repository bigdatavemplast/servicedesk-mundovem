CREATE OR REPLACE FUNCTION public.bloquear_alteracao_chamado_por_gestor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  -- Permite a reabertura estritamente validada pela RPC reabrir_chamado.
  -- A exceção só vale para o próprio chamado do gestor, dentro das 48 horas,
  -- sem alterar os demais dados operacionais.
  IF current_setting('app.solicitante_reabre_chamado', true) = 'on'
     AND auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(), 'gestor'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND OLD.solicitante_id = auth.uid()
     AND NEW.solicitante_id = auth.uid()
     AND OLD.status IN ('resolvido', 'fechado')
     AND NEW.status = 'reaberto'
     AND OLD.resolvido_em IS NOT NULL
     AND OLD.resolvido_em > now() - interval '48 hours'
     AND NEW.atendente_id IS NOT DISTINCT FROM OLD.atendente_id
     AND NEW.grupo_atendimento_id IS NOT DISTINCT FROM OLD.grupo_atendimento_id
     AND NEW.segmento_id IS NOT DISTINCT FROM OLD.segmento_id
     AND NEW.categoria_id IS NOT DISTINCT FROM OLD.categoria_id
     AND NEW.subcategoria_id IS NOT DISTINCT FROM OLD.subcategoria_id
     AND NEW.prioridade IS NOT DISTINCT FROM OLD.prioridade
     AND NEW.impacto IS NOT DISTINCT FROM OLD.impacto
     AND NEW.urgencia IS NOT DISTINCT FROM OLD.urgencia
     AND NEW.sla_id IS NOT DISTINCT FROM OLD.sla_id
     AND NEW.sla_regra_id IS NOT DISTINCT FROM OLD.sla_regra_id
     AND NEW.prazo_resposta IS NOT DISTINCT FROM OLD.prazo_resposta
     AND NEW.prazo_resolucao IS NOT DISTINCT FROM OLD.prazo_resolucao
     AND NEW.reaberto_em IS NOT NULL
     AND NEW.sla_pausado IS FALSE
     AND NEW.sla_pausado_em IS NULL
     AND NEW.fechado_em IS NULL
     AND NEW.avaliacao_nota IS NULL
     AND NEW.avaliacao_comentario IS NULL
     AND pg_trigger_depth() = 1
  THEN
    RETURN NEW;
  END IF;

  -- Mantém a exceção original para avaliação validada pela RPC.
  IF current_setting('app.avaliacao_chamado_validada', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(), 'gestor'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'Perfil Gestor: chamados não podem ser alterados. É permitido apenas adicionar comentários públicos.';
  END IF;
  RETURN NEW;
END;
$function$;
