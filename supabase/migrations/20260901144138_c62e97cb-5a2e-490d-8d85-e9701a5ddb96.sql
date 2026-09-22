-- 1) search_path fixo
-- Algumas funções são criadas apenas em instalações que incluem módulos
-- opcionais posteriores. O ajuste de segurança é aplicado somente quando
-- a função já existe no estado atual da migration.
DO $$
BEGIN
  IF to_regprocedure('public.atualizar_documentacao_sistema_atualizado_em()') IS NOT NULL THEN
    ALTER FUNCTION public.atualizar_documentacao_sistema_atualizado_em() SET search_path = public;
  END IF;
  IF to_regprocedure('public.sla_aplicar_prazo_calendario()') IS NOT NULL THEN
    ALTER FUNCTION public.sla_aplicar_prazo_calendario() SET search_path = public;
  END IF;
  IF to_regprocedure('public.sla_calcular_prazo_util(timestamp with time zone, bigint, uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.sla_calcular_prazo_util(timestamp with time zone, bigint, uuid) SET search_path = public;
  END IF;
  IF to_regprocedure('public.slugify_conhecimento(text)') IS NOT NULL THEN
    ALTER FUNCTION public.slugify_conhecimento(text) SET search_path = public;
  END IF;
  IF to_regprocedure('public.status_sla_resolucao(timestamp with time zone, boolean, bigint)') IS NOT NULL THEN
    ALTER FUNCTION public.status_sla_resolucao(timestamp with time zone, boolean, bigint) SET search_path = public;
  END IF;
  IF to_regprocedure('public.sincronizar_segmento_categoria()') IS NOT NULL THEN
    ALTER FUNCTION public.sincronizar_segmento_categoria() SET search_path = public;
  END IF;
  IF to_regprocedure('public.atualizar_regra_atribuicao_atualizado_em()') IS NOT NULL THEN
    ALTER FUNCTION public.atualizar_regra_atribuicao_atualizado_em() SET search_path = public;
  END IF;
  IF to_regprocedure('public.validar_item_catalogo()') IS NOT NULL THEN
    ALTER FUNCTION public.validar_item_catalogo() SET search_path = public;
  END IF;
  IF to_regprocedure('public.itsm_itens_catalogo_set_atualizado_em()') IS NOT NULL THEN
    ALTER FUNCTION public.itsm_itens_catalogo_set_atualizado_em() SET search_path = public;
  END IF;
END
$$;

-- 2) SECURITY DEFINER: remover execução para anônimos
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig, p.prorettype = 'trigger'::regtype AS is_trigger
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF NOT r.is_trigger THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END IF;
  END LOOP;
END $$;

-- 3) View respeita permissões do consultante
ALTER VIEW public.itsm_governanca_resumo SET (security_invoker = on);

-- 4) Proteger colunas de gestão em chamados
CREATE OR REPLACE FUNCTION public.proteger_colunas_chamado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_staff boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW; -- operações internas/servidor
  END IF;

  v_staff := has_any_role(v_uid, ARRAY['atendente','gestor','admin']::app_role[]);
  IF v_staff THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'aberto';
    NEW.atendente_id := NULL;
    NEW.grupo_atendimento_id := NULL;
    NEW.respondido_em := NULL;
    NEW.resolvido_em := NULL;
    NEW.fechado_em := NULL;
    NEW.reaberto_em := NULL;
    NEW.sla_resposta_violado := false;
    NEW.sla_resolucao_violado := false;
    NEW.sla_pausado := false;
    NEW.sla_pausado_em := NULL;
    NEW.sla_tempo_restante_segundos := NULL;
    NEW.avaliacao_nota := NULL;
    NEW.avaliacao_comentario := NULL;
    NEW.triagem_por := NULL;
    NEW.triagem_em := NULL;
    NEW.escalonamento_nivel := 0;
    NEW.escalonado := false;
    NEW.escalonado_em := NULL;
    NEW.custo_atendimento := NULL;
    NEW.tempo_atendimento_minutos := NULL;
    NEW.primeira_chamada_resolvida := NULL;
    NEW.atendimento_abandonado := false;
    NEW.primeira_resposta_em := NULL;
    NEW.primeiro_atendimento_em := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: o solicitante pode ajustar apenas conteúdo próprio
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('cancelado'::status_chamado, 'reaberto'::status_chamado) THEN
    RAISE EXCEPTION 'Somente a equipe de atendimento pode alterar o status do chamado.';
  END IF;

  NEW.numero := OLD.numero;
  NEW.solicitante_id := OLD.solicitante_id;
  NEW.atendente_id := OLD.atendente_id;
  NEW.grupo_atendimento_id := OLD.grupo_atendimento_id;
  NEW.prioridade := OLD.prioridade;
  NEW.impacto := OLD.impacto;
  NEW.urgencia := OLD.urgencia;
  NEW.sla_id := OLD.sla_id;
  NEW.sla_regra_id := OLD.sla_regra_id;
  NEW.prazo_resposta := OLD.prazo_resposta;
  NEW.prazo_resolucao := OLD.prazo_resolucao;
  NEW.sla_resposta_violado := OLD.sla_resposta_violado;
  NEW.sla_resolucao_violado := OLD.sla_resolucao_violado;
  NEW.sla_pausado := OLD.sla_pausado;
  NEW.sla_pausado_em := OLD.sla_pausado_em;
  NEW.sla_tempo_restante_segundos := OLD.sla_tempo_restante_segundos;
  NEW.sla_tempo_resposta_segundos := OLD.sla_tempo_resposta_segundos;
  NEW.sla_tempo_resolucao_segundos := OLD.sla_tempo_resolucao_segundos;
  NEW.sla_tempo_pausado_segundos := OLD.sla_tempo_pausado_segundos;
  NEW.respondido_em := OLD.respondido_em;
  NEW.resolvido_em := OLD.resolvido_em;
  NEW.fechado_em := OLD.fechado_em;
  NEW.avaliacao_nota := OLD.avaliacao_nota;
  NEW.avaliacao_comentario := OLD.avaliacao_comentario;
  NEW.triagem_por := OLD.triagem_por;
  NEW.triagem_em := OLD.triagem_em;
  NEW.escalonamento_nivel := OLD.escalonamento_nivel;
  NEW.escalonado := OLD.escalonado;
  NEW.escalonado_em := OLD.escalonado_em;
  NEW.custo_atendimento := OLD.custo_atendimento;
  NEW.tempo_atendimento_minutos := OLD.tempo_atendimento_minutos;
  NEW.primeira_chamada_resolvida := OLD.primeira_chamada_resolvida;
  NEW.atendimento_abandonado := OLD.atendimento_abandonado;
  NEW.primeira_resposta_em := OLD.primeira_resposta_em;
  NEW.primeiro_atendimento_em := OLD.primeiro_atendimento_em;
  NEW.aberto_em := OLD.aberto_em;
  NEW.criado_em := OLD.criado_em;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.proteger_colunas_chamado() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proteger_colunas_chamado() TO service_role;

DROP TRIGGER IF EXISTS trg_proteger_colunas_chamado_ins ON public.chamados;
DROP TRIGGER IF EXISTS trg_proteger_colunas_chamado_upd ON public.chamados;

CREATE TRIGGER trg_proteger_colunas_chamado_ins
BEFORE INSERT ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.proteger_colunas_chamado();

CREATE TRIGGER trg_proteger_colunas_chamado_upd
BEFORE UPDATE ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.proteger_colunas_chamado();