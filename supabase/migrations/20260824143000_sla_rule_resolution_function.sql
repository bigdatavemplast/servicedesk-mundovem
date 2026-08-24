-- Motor inicial de selecao da regra SLA.
-- A funcao retorna a regra mais especifica aplicavel ao chamado.

CREATE OR REPLACE FUNCTION public.selecionar_regra_sla(
  p_tipo_fluxo VARCHAR,
  p_segmento_id UUID DEFAULT NULL,
  p_categoria_id UUID DEFAULT NULL,
  p_prioridade public.prioridade_chamado DEFAULT NULL,
  p_impacto VARCHAR DEFAULT NULL,
  p_urgencia VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nome VARCHAR,
  tipo_fluxo VARCHAR,
  calendario_id UUID,
  tempo_resposta_segundos BIGINT,
  tempo_resolucao_segundos BIGINT,
  usa_sla_resolucao BOOLEAN,
  pausa_aguardando_usuario BOOLEAN,
  pausa_aguardando_terceiro BOOLEAN,
  pausa_aguardando_aprovacao BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    r.id, r.nome, r.tipo_fluxo, r.calendario_id,
    r.tempo_resposta_segundos, r.tempo_resolucao_segundos,
    r.usa_sla_resolucao, r.pausa_aguardando_usuario,
    r.pausa_aguardando_terceiro, r.pausa_aguardando_aprovacao
  FROM public.sla_regras r
  WHERE r.ativo = TRUE
    AND r.tipo_fluxo = p_tipo_fluxo
    AND (r.segmento_id IS NULL OR r.segmento_id = p_segmento_id)
    AND (r.categoria_id IS NULL OR r.categoria_id = p_categoria_id)
    AND (r.prioridade IS NULL OR r.prioridade = p_prioridade)
    AND (r.impacto IS NULL OR r.impacto = p_impacto)
    AND (r.urgencia IS NULL OR r.urgencia = p_urgencia)
  ORDER BY
    (r.segmento_id IS NOT NULL)::int DESC,
    (r.categoria_id IS NOT NULL)::int DESC,
    (r.prioridade IS NOT NULL)::int DESC,
    (r.impacto IS NOT NULL)::int DESC,
    (r.urgencia IS NOT NULL)::int DESC,
    r.atualizado_em DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.selecionar_regra_sla(VARCHAR, UUID, UUID, public.prioridade_chamado, VARCHAR, VARCHAR) TO authenticated;
