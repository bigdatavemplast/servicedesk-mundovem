-- O catálogo diferencia Acesso, Dúvida e Solicitação de Requisição.
-- A constraint antiga impedia o cadastro dessas regras específicas.

ALTER TABLE public.sla_regras
  DROP CONSTRAINT IF EXISTS sla_regras_tipo_fluxo_check;

ALTER TABLE public.sla_regras
  ADD CONSTRAINT sla_regras_tipo_fluxo_check
  CHECK (
    tipo_fluxo IN (
      'incidente',
      'requisicao',
      'acesso',
      'duvida',
      'solicitacao',
      'melhoria',
      'projeto',
      'triagem'
    )
  );

-- Regras específicas para os fluxos que já são usados pelo catálogo.
INSERT INTO public.sla_regras (
  nome,
  ativo,
  tipo_fluxo,
  calendario_id,
  tempo_resposta_segundos,
  tempo_resolucao_segundos,
  usa_sla_resolucao,
  pausa_aguardando_usuario,
  pausa_aguardando_terceiro,
  pausa_aguardando_aprovacao
)
SELECT
  'Dúvida / Informação - 1h / 8h úteis',
  TRUE,
  'duvida',
  cal.id,
  3600,
  28800,
  TRUE,
  TRUE,
  TRUE,
  TRUE
FROM public.sla_calendarios cal
WHERE cal.nome = 'Horario comercial Vemplast'
  AND NOT EXISTS (
    SELECT 1 FROM public.sla_regras r
    WHERE r.tipo_fluxo = 'duvida'
      AND r.ativo = TRUE
  );

INSERT INTO public.sla_regras (
  nome,
  ativo,
  tipo_fluxo,
  calendario_id,
  tempo_resposta_segundos,
  tempo_resolucao_segundos,
  usa_sla_resolucao,
  pausa_aguardando_usuario,
  pausa_aguardando_terceiro,
  pausa_aguardando_aprovacao
)
SELECT
  'Acesso - 2h / 12h úteis',
  TRUE,
  'acesso',
  cal.id,
  7200,
  43200,
  TRUE,
  TRUE,
  TRUE,
  TRUE
FROM public.sla_calendarios cal
WHERE cal.nome = 'Horario comercial Vemplast'
  AND NOT EXISTS (
    SELECT 1 FROM public.sla_regras r
    WHERE r.tipo_fluxo = 'acesso'
      AND r.ativo = TRUE
  );

INSERT INTO public.sla_regras (
  nome,
  ativo,
  tipo_fluxo,
  calendario_id,
  tempo_resposta_segundos,
  tempo_resolucao_segundos,
  usa_sla_resolucao,
  pausa_aguardando_usuario,
  pausa_aguardando_terceiro,
  pausa_aguardando_aprovacao
)
SELECT
  'Solicitação - Padrão - 4h / 5 dias úteis',
  TRUE,
  'solicitacao',
  cal.id,
  14400,
  144000,
  TRUE,
  TRUE,
  TRUE,
  TRUE
FROM public.sla_calendarios cal
WHERE cal.nome = 'Horario comercial Vemplast'
  AND NOT EXISTS (
    SELECT 1 FROM public.sla_regras r
    WHERE r.tipo_fluxo = 'solicitacao'
      AND r.ativo = TRUE
  );
