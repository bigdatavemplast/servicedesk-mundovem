-- Fase 2 - SLA / Requisições
-- Regras específicas por categoria, com fallback operacional para qualquer
-- requisição que ainda não possua uma categoria mapeada.

-- Dúvidas / informações: 1h resposta, 8h úteis para conclusão.
INSERT INTO public.sla_regras (
  nome, tipo_fluxo, categoria_id, calendario_id,
  tempo_resposta_segundos, tempo_resolucao_segundos,
  usa_sla_resolucao, pausa_aguardando_usuario,
  pausa_aguardando_terceiro, pausa_aguardando_aprovacao
)
SELECT
  'Requisição - Dúvida / Informação - 1h / 8h',
  'requisicao', c.id, cal.id,
  1 * 3600, 8 * 3600,
  TRUE, TRUE, TRUE, TRUE
FROM public.categorias c
JOIN public.sla_calendarios cal ON cal.nome = 'Horario comercial Vemplast'
WHERE c.ativo = TRUE
  AND (
    lower(unaccent(c.nome)) LIKE '%duvida%'
    OR lower(unaccent(c.nome)) LIKE '%informacao%'
    OR lower(unaccent(c.nome)) LIKE '%informacao%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sla_regras r
    WHERE r.tipo_fluxo = 'requisicao' AND r.categoria_id = c.id
  );

-- Acessos: 2h resposta, 12h úteis para conclusão.
INSERT INTO public.sla_regras (
  nome, tipo_fluxo, categoria_id, calendario_id,
  tempo_resposta_segundos, tempo_resolucao_segundos,
  usa_sla_resolucao, pausa_aguardando_usuario,
  pausa_aguardando_terceiro, pausa_aguardando_aprovacao
)
SELECT
  'Requisição - Acesso - 2h / 12h',
  'requisicao', c.id, cal.id,
  2 * 3600, 12 * 3600,
  TRUE, TRUE, TRUE, TRUE
FROM public.categorias c
JOIN public.sla_calendarios cal ON cal.nome = 'Horario comercial Vemplast'
WHERE c.ativo = TRUE
  AND lower(unaccent(c.nome)) LIKE '%acesso%'
  AND NOT EXISTS (
    SELECT 1 FROM public.sla_regras r
    WHERE r.tipo_fluxo = 'requisicao' AND r.categoria_id = c.id
  );

-- Hardware / Software / requisições técnicas: 4h resposta e até 5 dias úteis.
INSERT INTO public.sla_regras (
  nome, tipo_fluxo, categoria_id, calendario_id,
  tempo_resposta_segundos, tempo_resolucao_segundos,
  usa_sla_resolucao, pausa_aguardando_usuario,
  pausa_aguardando_terceiro, pausa_aguardando_aprovacao
)
SELECT
  'Requisição - Hardware / Software - 4h / 5 dias',
  'requisicao', c.id, cal.id,
  4 * 3600, 5 * 8 * 3600,
  TRUE, TRUE, TRUE, TRUE
FROM public.categorias c
JOIN public.sla_calendarios cal ON cal.nome = 'Horario comercial Vemplast'
WHERE c.ativo = TRUE
  AND (
    lower(unaccent(c.nome)) LIKE '%hardware%'
    OR lower(unaccent(c.nome)) LIKE '%software%'
    OR lower(unaccent(c.nome)) LIKE '%requisi%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sla_regras r
    WHERE r.tipo_fluxo = 'requisicao' AND r.categoria_id = c.id
  );

-- Fallback: toda requisição sem regra específica continua tendo SLA.
-- A regra específica por categoria sempre vence pela função selecionar_regra_sla.
INSERT INTO public.sla_regras (
  nome, tipo_fluxo, calendario_id,
  tempo_resposta_segundos, tempo_resolucao_segundos,
  usa_sla_resolucao, pausa_aguardando_usuario,
  pausa_aguardando_terceiro, pausa_aguardando_aprovacao
)
SELECT
  'Requisição - Padrão - 4h / 5 dias úteis',
  'requisicao', cal.id,
  4 * 3600, 5 * 8 * 3600,
  TRUE, TRUE, TRUE, TRUE
FROM public.sla_calendarios cal
WHERE cal.nome = 'Horario comercial Vemplast'
  AND NOT EXISTS (
    SELECT 1 FROM public.sla_regras r
    WHERE r.tipo_fluxo = 'requisicao'
      AND r.categoria_id IS NULL
  );

-- Garante novamente a regra operacional de triagem de 20 minutos.
INSERT INTO public.sla_regras (
  nome, tipo_fluxo, calendario_id,
  tempo_resposta_segundos, tempo_resolucao_segundos,
  usa_sla_resolucao, pausa_aguardando_usuario,
  pausa_aguardando_terceiro, pausa_aguardando_aprovacao
)
SELECT
  'Triagem - 20 minutos', 'triagem', cal.id,
  20 * 60, NULL,
  FALSE, FALSE, FALSE, FALSE
FROM public.sla_calendarios cal
WHERE cal.nome = '24x7'
  AND NOT EXISTS (
    SELECT 1 FROM public.sla_regras r
    WHERE r.tipo_fluxo = 'triagem'
  );
