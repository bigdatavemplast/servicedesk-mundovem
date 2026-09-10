-- ============================================================
-- SLA: pausa por status de espera
-- Ao entrar em Aguardando Usuário/Terceiro, congela o tempo
-- restante. Ao voltar para status ativo, retoma desse ponto.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sla_pausar_retomar_por_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agora TIMESTAMPTZ := NOW();
  v_restante BIGINT;
  v_prazo_retomado TIMESTAMPTZ;
  v_autor UUID := auth.uid();
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('aguardando_usuario', 'aguardando_terceiro')
       AND OLD.status IN ('aguardando_usuario', 'aguardando_terceiro')
       AND OLD.sla_pausado THEN
      NEW.sla_pausado := TRUE;
      NEW.sla_pausado_em := OLD.sla_pausado_em;
      NEW.sla_tempo_restante_segundos := OLD.sla_tempo_restante_segundos;
      NEW.prazo_resolucao := OLD.prazo_resolucao;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('aguardando_usuario', 'aguardando_terceiro')
     AND OLD.status NOT IN ('aguardando_usuario', 'aguardando_terceiro') THEN
    v_restante := GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (COALESCE(OLD.prazo_resolucao, v_agora) - v_agora)))::BIGINT
    );
    NEW.sla_pausado := TRUE;
    NEW.sla_pausado_em := v_agora;
    NEW.sla_tempo_restante_segundos := v_restante;
    NEW.prazo_resolucao := OLD.prazo_resolucao;
    INSERT INTO public.historico_sla_chamado (chamado_id, tipo, autor_id, criado_em, tempo_restante_segundos, prazo_anterior, novo_prazo, observacao)
    VALUES (NEW.id, 'pausa', v_autor, v_agora, v_restante, OLD.prazo_resolucao, OLD.prazo_resolucao,
      CASE NEW.status WHEN 'aguardando_usuario' THEN 'SLA pausado ao entrar em Aguardando Usuário.' ELSE 'SLA pausado ao entrar em Aguardando Terceiro.' END);
    RETURN NEW;
  END IF;

  IF OLD.status IN ('aguardando_usuario', 'aguardando_terceiro')
     AND NEW.status IN ('aberto', 'em_andamento', 'reaberto') THEN
    v_restante := GREATEST(0, COALESCE(OLD.sla_tempo_restante_segundos, 0));
    v_prazo_retomado := v_agora + make_interval(secs => v_restante);
    NEW.sla_pausado := FALSE;
    NEW.sla_pausado_em := NULL;
    NEW.sla_tempo_restante_segundos := NULL;
    NEW.prazo_resolucao := v_prazo_retomado;
    INSERT INTO public.historico_sla_chamado (chamado_id, tipo, autor_id, criado_em, tempo_restante_segundos, prazo_anterior, novo_prazo, observacao)
    VALUES (NEW.id, 'retomada', v_autor, v_agora, v_restante, OLD.prazo_resolucao, v_prazo_retomado,
      'SLA retomado ao voltar para um status de atendimento ativo.');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zz_sla_pausa_retomada_status ON public.chamados;
CREATE TRIGGER trg_zz_sla_pausa_retomada_status
BEFORE UPDATE OF status ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.sla_pausar_retomar_por_status();

REVOKE ALL ON FUNCTION public.sla_pausar_retomar_por_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sla_pausar_retomar_por_status() TO service_role;
