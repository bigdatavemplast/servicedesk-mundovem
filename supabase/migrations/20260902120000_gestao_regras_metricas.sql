-- Regras definitivas dos indicadores de Gestão
-- Abandono: 30 dias sem ação do atendimento. Comentário/cobrança do solicitante NÃO reinicia o prazo.

ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS ultima_acao_atendimento_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chamados_ultima_acao_atendimento
  ON public.chamados(segmento_id, ultima_acao_atendimento_em, status);

-- A abertura inicia o relógio. Atualizações feitas pelo solicitante não reiniciam.
CREATE OR REPLACE FUNCTION public.gestao_registrar_acao_atendimento_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.ultima_acao_atendimento_em := COALESCE(NEW.criado_em, NOW());
    RETURN NEW;
  END IF;

  -- Ação autenticada de atendimento. O solicitante não reinicia o contador.
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM NEW.solicitante_id THEN
    IF ROW(NEW.status, NEW.atendente_id, NEW.grupo_atendimento_id, NEW.prioridade, NEW.categoria_id)
       IS DISTINCT FROM ROW(OLD.status, OLD.atendente_id, OLD.grupo_atendimento_id, OLD.prioridade, OLD.categoria_id)
    THEN
      NEW.ultima_acao_atendimento_em := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gestao_acao_atendimento_chamado ON public.chamados;
CREATE TRIGGER trg_gestao_acao_atendimento_chamado
BEFORE INSERT OR UPDATE OF status, atendente_id, grupo_atendimento_id, prioridade, categoria_id
ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.gestao_registrar_acao_atendimento_chamado();

-- Comentários do atendimento reiniciam; comentários do solicitante não.
CREATE OR REPLACE FUNCTION public.gestao_registrar_acao_atendimento_comentario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.interno, FALSE) = TRUE THEN
    UPDATE public.chamados SET ultima_acao_atendimento_em = NEW.criado_em WHERE id = NEW.chamado_id;
  ELSIF NEW.autor_id IS NOT NULL THEN
    UPDATE public.chamados c
       SET ultima_acao_atendimento_em = NEW.criado_em
     WHERE c.id = NEW.chamado_id
       AND c.solicitante_id IS DISTINCT FROM NEW.autor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gestao_acao_atendimento_comentario ON public.comentarios_chamado;
CREATE TRIGGER trg_gestao_acao_atendimento_comentario
AFTER INSERT ON public.comentarios_chamado
FOR EACH ROW EXECUTE FUNCTION public.gestao_registrar_acao_atendimento_comentario();

-- Marca os chamados elegíveis no momento da consulta. Não depende de um comentário do usuário.
CREATE OR REPLACE FUNCTION public.gestao_atualizar_abandonos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.chamados c
     SET atendimento_abandonado = TRUE
   WHERE c.resolvido_em IS NULL
     AND c.status NOT IN ('resolvido','fechado','cancelado')
     AND COALESCE(c.ultima_acao_atendimento_em, c.criado_em) <= NOW() - INTERVAL '30 days'
     AND c.atendimento_abandonado IS DISTINCT FROM TRUE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.gestao_atendimento_eventos(chamado_id, tipo, motivo)
  SELECT c.id, 'abandono', '30 dias sem ação do atendimento'
    FROM public.chamados c
   WHERE c.atendimento_abandonado = TRUE
     AND c.resolvido_em IS NULL
     AND c.status NOT IN ('resolvido','fechado','cancelado')
     AND COALESCE(c.ultima_acao_atendimento_em, c.criado_em) <= NOW() - INTERVAL '30 days'
     AND NOT EXISTS (
       SELECT 1 FROM public.gestao_atendimento_eventos e
       WHERE e.chamado_id = c.id AND e.tipo = 'abandono'
     );
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.gestao_atualizar_abandonos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestao_atualizar_abandonos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestao_atualizar_abandonos() TO service_role;

-- Reabertura ou nova ação de atendimento retira o estado de abandono.
CREATE OR REPLACE FUNCTION public.gestao_reabrir_abandono()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ultima_acao_atendimento_em IS DISTINCT FROM OLD.ultima_acao_atendimento_em
     AND NEW.atendimento_abandonado = TRUE
     AND NEW.resolvido_em IS NULL
  THEN
    NEW.atendimento_abandonado := FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gestao_reabrir_abandono ON public.chamados;
CREATE TRIGGER trg_gestao_reabrir_abandono
BEFORE UPDATE OF ultima_acao_atendimento_em ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.gestao_reabrir_abandono();

-- Mantém o custo calculado quando o parâmetro de custo/hora for alterado depois da resolução.
CREATE OR REPLACE FUNCTION public.gestao_recalcular_custos_configuracao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chamados c
     SET custo_atendimento = ROUND((COALESCE(c.tempo_atendimento_minutos, 0) / 60.0) * NEW.custo_hora, 2)
   WHERE c.resolvido_em IS NOT NULL
     AND c.atendente_id = NEW.usuario_id
     AND NEW.usuario_id IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gestao_recalcular_custo_usuario ON public.gestao_capacidade;
CREATE TRIGGER trg_gestao_recalcular_custo_usuario
AFTER INSERT OR UPDATE OF custo_hora, ativo ON public.gestao_capacidade
FOR EACH ROW WHEN (NEW.usuario_id IS NOT NULL AND NEW.ativo = TRUE)
EXECUTE FUNCTION public.gestao_recalcular_custos_configuracao();

-- Para o TMA, o valor oficial passa a ser tempo efetivamente trabalhado.
-- A tela deve preferir chamados.tempo_atendimento_minutos e usar o intervalo bruto
-- somente para dados legados que ainda não possuem o campo calculado.
