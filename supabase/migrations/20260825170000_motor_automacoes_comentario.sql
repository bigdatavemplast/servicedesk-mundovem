-- Fase 2 — Operação: motor inicial de automações.
-- Primeiro evento suportado: resposta_solicitante.
-- Primeira ação suportada: reabrir.
-- A automação altera o status de resolvido para aberto.

CREATE OR REPLACE FUNCTION public.executar_automacoes_apos_comentario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chamado public.chamados%ROWTYPE;
  v_regra public.automacoes_service_desk%ROWTYPE;
  v_status_condicao text;
BEGIN
  -- Notas internas nunca representam resposta do solicitante.
  IF NEW.interno IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO v_chamado
    FROM public.chamados
   WHERE id = NEW.chamado_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- O evento só ocorre quando quem comentou é o próprio solicitante.
  IF NEW.autor_id IS DISTINCT FROM v_chamado.solicitante_id THEN
    RETURN NEW;
  END IF;

  FOR v_regra IN
    SELECT *
      FROM public.automacoes_service_desk
     WHERE ativo = TRUE
       AND evento = 'resposta_solicitante'
     ORDER BY ordem, criado_em
  LOOP
    -- Condição opcional de status.
    v_status_condicao := NULLIF(v_regra.condicoes ->> 'status', '');

    IF v_status_condicao IS NOT NULL
       AND v_status_condicao <> v_chamado.status::text THEN
      CONTINUE;
    END IF;

    -- Primeira ação do motor: Reabrir chamado.
    -- No fluxo operacional, reabrir significa voltar para ABERTO.
    IF v_regra.acao = 'reabrir'
       AND v_chamado.status = 'resolvido' THEN
      UPDATE public.chamados
         SET status = 'aberto',
             resolvido_em = NULL,
             fechado_em = NULL,
             sla_pausado = FALSE,
             sla_pausado_em = NULL,
             reaberto_em = now(),
             atualizado_em = now()
       WHERE id = v_chamado.id;

      INSERT INTO public.historico_chamado (
        chamado_id,
        autor_id,
        acao,
        de,
        para
      ) VALUES (
        v_chamado.id,
        NEW.autor_id,
        'automacao_reabertura',
        'resolvido',
        'aberto'
      );

      -- Atualiza o registro local para impedir que outra regra da mesma execução
      -- reabra novamente o mesmo chamado.
      v_chamado.status := 'aberto';
      v_chamado.resolvido_em := NULL;
      v_chamado.fechado_em := NULL;
      v_chamado.sla_pausado := FALSE;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_executar_automacoes_apos_comentario
  ON public.comentarios_chamado;

CREATE TRIGGER trg_executar_automacoes_apos_comentario
AFTER INSERT ON public.comentarios_chamado
FOR EACH ROW
EXECUTE FUNCTION public.executar_automacoes_apos_comentario();

REVOKE ALL ON FUNCTION public.executar_automacoes_apos_comentario()
  FROM PUBLIC, anon, authenticated;
