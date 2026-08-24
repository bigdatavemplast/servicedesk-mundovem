-- Completa a separação dos fluxos ITIL usados pelo catálogo.
-- Acesso, Dúvida e Solicitação não devem cair no fluxo requisicao.

-- Dúvida / Informação: 1h de resposta e até 8h úteis de resolução.
INSERT INTO public.sla_regras (
  nome, tipo_fluxo, calendario_id,
  tempo_resposta_segundos, tempo_resolucao_segundos,
  usa_sla_resolucao, pausa_aguardando_usuario,
  pausa_aguardando_terceiro, pausa_aguardando_aprovacao
)
SELECT
  'Dúvida / Informação - 1h / 8h úteis',
  'duvida', cal.id,
  1 * 3600, 8 * 3600,
  TRUE, TRUE, TRUE, TRUE
FROM public.sla_calendarios cal
WHERE cal.nome = 'Horario comercial Vemplast'
  AND NOT EXISTS (
    SELECT 1 FROM public.sla_regras r
    WHERE r.tipo_fluxo = 'duvida'
      AND r.categoria_id IS NULL
      AND r.segmento_id IS NULL
  );

-- Acesso: 2h de resposta e até 12h úteis de resolução.
INSERT INTO public.sla_regras (
  nome, tipo_fluxo, calendario_id,
  tempo_resposta_segundos, tempo_resolucao_segundos,
  usa_sla_resolucao, pausa_aguardando_usuario,
  pausa_aguardando_terceiro, pausa_aguardando_aprovacao
)
SELECT
  'Acesso - 2h / 12h úteis',
  'acesso', cal.id,
  2 * 3600, 12 * 3600,
  TRUE, TRUE, TRUE, TRUE
FROM public.sla_calendarios cal
WHERE cal.nome = 'Horario comercial Vemplast'
  AND NOT EXISTS (
    SELECT 1 FROM public.sla_regras r
    WHERE r.tipo_fluxo = 'acesso'
      AND r.categoria_id IS NULL
      AND r.segmento_id IS NULL
  );

-- Solicitação: fluxo operacional padrão de Service Request,
-- 4h de resposta e até 5 dias úteis de resolução.
INSERT INTO public.sla_regras (
  nome, tipo_fluxo, calendario_id,
  tempo_resposta_segundos, tempo_resolucao_segundos,
  usa_sla_resolucao, pausa_aguardando_usuario,
  pausa_aguardando_terceiro, pausa_aguardando_aprovacao
)
SELECT
  'Solicitação - Padrão - 4h / 5 dias úteis',
  'solicitacao', cal.id,
  4 * 3600, 5 * 8 * 3600,
  TRUE, TRUE, TRUE, TRUE
FROM public.sla_calendarios cal
WHERE cal.nome = 'Horario comercial Vemplast'
  AND NOT EXISTS (
    SELECT 1 FROM public.sla_regras r
    WHERE r.tipo_fluxo = 'solicitacao'
      AND r.categoria_id IS NULL
      AND r.segmento_id IS NULL
  );
