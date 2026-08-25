-- Correção do modelo atual:
-- chamados.escalonamento_nivel usa 0 para N1.
-- A tabela grupo_atendentes continua usando N1/N2/N3.

CREATE OR REPLACE FUNCTION public.executar_escalonamento_sla_n1_n2()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chamado public.chamados%ROWTYPE;
  v_atendente_n2 uuid;
  v_count integer := 0;
BEGIN
  FOR v_chamado IN
    SELECT c.*
      FROM public.chamados c
     WHERE c.grupo_atendimento_id IS NOT NULL
       AND c.atendente_id IS NOT NULL
       AND c.prazo_resolucao IS NOT NULL
       AND c.prazo_resolucao > now()
       AND c.prazo_resolucao <= now() + interval '1 hour'
       AND c.status::text IN ('aberto', 'em_andamento')
       AND COALESCE(c.sla_pausado, false) = false
       AND COALESCE(c.escalonamento_nivel, 0) = 0
     ORDER BY c.prazo_resolucao, c.criado_em
  LOOP
    SELECT ga.usuario_id
      INTO v_atendente_n2
      FROM public.grupo_atendentes ga
     WHERE ga.grupo_id = v_chamado.grupo_atendimento_id
       AND ga.ativo = true
       AND upper(trim(ga.nivel_atendimento)) = 'N2'
       AND public.has_any_role(
             ga.usuario_id,
             ARRAY['atendente','gestor','admin']::public.app_role[]
           )
     ORDER BY ga.usuario_id
     LIMIT 1;

    IF v_atendente_n2 IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.chamados
       SET atendente_id = v_atendente_n2,
           escalonamento_nivel = 2,
           escalonado_em = now(),
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
      v_atendente_n2,
      'automacao_escalonamento_sla',
      'N1',
      'N2'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.executar_escalonamento_sla_n1_n2()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.executar_escalonamento_sla_n1_n2()
  TO service_role;
