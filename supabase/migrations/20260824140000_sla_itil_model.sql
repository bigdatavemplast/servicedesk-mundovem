-- ============================================================
-- Fase 2 - SLA / modelo ITIL
-- Estrutura de dados para Incidentes, Requisições, Triagem,
-- Melhorias e Projetos. Esta migration cria o modelo; o motor
-- de calculo/pausa/retomada sera ligado na proxima etapa.
-- ============================================================

-- Classificacao operacional do chamado.
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS impacto VARCHAR(20),
  ADD COLUMN IF NOT EXISTS urgencia VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tipo_fluxo VARCHAR(30),
  ADD COLUMN IF NOT EXISTS sla_regra_id UUID,
  ADD COLUMN IF NOT EXISTS sla_tempo_resposta_segundos BIGINT,
  ADD COLUMN IF NOT EXISTS sla_tempo_resolucao_segundos BIGINT,
  ADD COLUMN IF NOT EXISTS sla_tempo_pausado_segundos BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamados_impacto_chk') THEN
    ALTER TABLE public.chamados ADD CONSTRAINT chamados_impacto_chk
      CHECK (impacto IS NULL OR impacto IN ('empresa', 'departamento', 'usuario'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamados_urgencia_chk') THEN
    ALTER TABLE public.chamados ADD CONSTRAINT chamados_urgencia_chk
      CHECK (urgencia IS NULL OR urgencia IN ('critica', 'alta', 'media', 'baixa'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamados_tipo_fluxo_chk') THEN
    ALTER TABLE public.chamados ADD CONSTRAINT chamados_tipo_fluxo_chk
      CHECK (tipo_fluxo IS NULL OR tipo_fluxo IN ('incidente', 'requisicao', 'triagem', 'melhoria', 'projeto'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sla_calendarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sla_calendario_horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id UUID NOT NULL REFERENCES public.sla_calendarios(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (hora_inicio < hora_fim),
  UNIQUE (calendario_id, dia_semana, hora_inicio, hora_fim)
);

CREATE TABLE IF NOT EXISTS public.sla_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(150) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  tipo_fluxo VARCHAR(30) NOT NULL CHECK (tipo_fluxo IN ('incidente', 'requisicao', 'triagem', 'melhoria', 'projeto')),
  segmento_id UUID REFERENCES public.segmentos(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  catalogo_item_id UUID,
  prioridade public.prioridade_chamado,
  impacto VARCHAR(20) CHECK (impacto IS NULL OR impacto IN ('empresa', 'departamento', 'usuario')),
  urgencia VARCHAR(20) CHECK (urgencia IS NULL OR urgencia IN ('critica', 'alta', 'media', 'baixa')),
  calendario_id UUID REFERENCES public.sla_calendarios(id) ON DELETE SET NULL,
  tempo_resposta_segundos BIGINT CHECK (tempo_resposta_segundos IS NULL OR tempo_resposta_segundos >= 0),
  tempo_resolucao_segundos BIGINT CHECK (tempo_resolucao_segundos IS NULL OR tempo_resolucao_segundos >= 0),
  usa_sla_resolucao BOOLEAN NOT NULL DEFAULT TRUE,
  pausa_aguardando_usuario BOOLEAN NOT NULL DEFAULT TRUE,
  pausa_aguardando_terceiro BOOLEAN NOT NULL DEFAULT TRUE,
  pausa_aguardando_aprovacao BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (tipo_fluxo <> 'incidente' OR (prioridade IS NOT NULL AND impacto IS NOT NULL AND urgencia IS NOT NULL)),
  CHECK (tipo_fluxo <> 'projeto' OR usa_sla_resolucao = FALSE)
);

ALTER TABLE public.chamados
  DROP CONSTRAINT IF EXISTS chamados_sla_regra_id_fkey;
ALTER TABLE public.chamados
  ADD CONSTRAINT chamados_sla_regra_id_fkey
  FOREIGN KEY (sla_regra_id) REFERENCES public.sla_regras(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.sla_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  sla_regra_id UUID REFERENCES public.sla_regras(id) ON DELETE SET NULL,
  tipo VARCHAR(40) NOT NULL CHECK (tipo IN (
    'iniciado', 'resposta', 'pausa_usuario', 'retomada_usuario',
    'pausa_terceiro', 'retomada_terceiro', 'pausa_aprovacao',
    'retomada_aprovacao', 'escalacao_50', 'escalacao_75',
    'escalacao_90', 'vencido', 'recalculado', 'encerrado'
  )),
  motivo TEXT,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrado_em TIMESTAMPTZ,
  duracao_segundos BIGINT CHECK (duracao_segundos IS NULL OR duracao_segundos >= 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_regras_busca
  ON public.sla_regras(tipo_fluxo, segmento_id, categoria_id, prioridade, ativo);
CREATE INDEX IF NOT EXISTS idx_sla_eventos_chamado
  ON public.sla_eventos(chamado_id, iniciado_em);
CREATE INDEX IF NOT EXISTS idx_sla_eventos_abertos
  ON public.sla_eventos(chamado_id, tipo)
  WHERE encerrado_em IS NULL;

-- Calendario 24x7 para P1 e operacoes criticas.
INSERT INTO public.sla_calendarios (nome, descricao, timezone)
VALUES ('24x7', 'Atendimento continuo, todos os dias da semana.', 'America/Sao_Paulo')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.sla_calendarios (nome, descricao, timezone)
VALUES ('Horario comercial Vemplast', 'Segunda a sexta, das 08:00 as 18:00.', 'America/Sao_Paulo')
ON CONFLICT (nome) DO NOTHING;

-- Horario comercial: 1=segunda ... 5=sexta no padrao ISO.
INSERT INTO public.sla_calendario_horarios (calendario_id, dia_semana, hora_inicio, hora_fim)
SELECT c.id, d, '08:00'::time, '18:00'::time
FROM public.sla_calendarios c
CROSS JOIN generate_series(1,5) AS d
WHERE c.nome = 'Horario comercial Vemplast'
ON CONFLICT DO NOTHING;

-- Incidentes: matriz Impacto x Urgencia -> P1..P4.
INSERT INTO public.sla_regras
  (nome, tipo_fluxo, prioridade, impacto, urgencia, calendario_id,
   tempo_resposta_segundos, tempo_resolucao_segundos)
SELECT v.nome, 'incidente', v.prioridade::public.prioridade_chamado,
       v.impacto, v.urgencia, c.id,
       v.resposta_min * 60, v.resolucao_h * 3600
FROM (VALUES
  ('Incidente P1 - Critica', 'critica', 'empresa', 'critica', 15, 4),
  ('Incidente P1 - Critica', 'critica', 'empresa', 'alta',    15, 4),
  ('Incidente P1 - Critica', 'critica', 'departamento', 'critica', 15, 4),
  ('Incidente P2 - Alta',    'alta',    'empresa', 'media', 30, 8),
  ('Incidente P2 - Alta',    'alta',    'departamento', 'alta', 30, 8),
  ('Incidente P2 - Alta',    'alta',    'usuario', 'critica', 30, 8),
  ('Incidente P3 - Media',   'media',   'departamento', 'media', 120, 24),
  ('Incidente P3 - Media',   'media',   'usuario', 'alta', 120, 24),
  ('Incidente P4 - Baixa',   'baixa',   'usuario', 'media', 240, 48),
  ('Incidente P4 - Baixa',   'baixa',   'usuario', 'baixa', 240, 48)
) AS v(nome, prioridade, impacto, urgencia, resposta_min, resolucao_h)
JOIN public.sla_calendarios c ON c.nome = CASE WHEN v.prioridade = 'critica' THEN '24x7' ELSE 'Horario comercial Vemplast' END
WHERE NOT EXISTS (
  SELECT 1 FROM public.sla_regras r
  WHERE r.tipo_fluxo = 'incidente'
    AND r.prioridade = v.prioridade::public.prioridade_chamado
    AND r.impacto = v.impacto
    AND r.urgencia = v.urgencia
);

-- Regras base de triagem, melhoria e projeto.
INSERT INTO public.sla_regras
  (nome, tipo_fluxo, calendario_id, tempo_resposta_segundos,
   tempo_resolucao_segundos, usa_sla_resolucao)
SELECT 'Triagem - 20 minutos', 'triagem', c.id, 20 * 60, NULL, FALSE
FROM public.sla_calendarios c
WHERE c.nome = '24x7'
  AND NOT EXISTS (SELECT 1 FROM public.sla_regras WHERE tipo_fluxo = 'triagem');

INSERT INTO public.sla_regras
  (nome, tipo_fluxo, calendario_id, tempo_resposta_segundos,
   tempo_resolucao_segundos, usa_sla_resolucao)
SELECT 'Melhoria - Analise de viabilidade - 5 dias uteis', 'melhoria', c.id,
       5 * 8 * 3600, 5 * 8 * 3600, TRUE
FROM public.sla_calendarios c
WHERE c.nome = 'Horario comercial Vemplast'
  AND NOT EXISTS (SELECT 1 FROM public.sla_regras WHERE tipo_fluxo = 'melhoria');

INSERT INTO public.sla_regras
  (nome, tipo_fluxo, calendario_id, tempo_resposta_segundos,
   tempo_resolucao_segundos, usa_sla_resolucao)
SELECT 'Projeto - sem SLA operacional', 'projeto', c.id, NULL, NULL, FALSE
FROM public.sla_calendarios c
WHERE c.nome = 'Horario comercial Vemplast'
  AND NOT EXISTS (SELECT 1 FROM public.sla_regras WHERE tipo_fluxo = 'projeto');

-- Regras de acesso: leitura autenticada; administracao restrita.
GRANT SELECT ON public.sla_calendarios, public.sla_calendario_horarios, public.sla_regras, public.sla_eventos TO authenticated;
GRANT ALL ON public.sla_calendarios, public.sla_calendario_horarios, public.sla_regras, public.sla_eventos TO service_role;

ALTER TABLE public.sla_calendarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_calendario_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios consultam calendarios SLA" ON public.sla_calendarios;
CREATE POLICY "Usuarios consultam calendarios SLA" ON public.sla_calendarios
FOR SELECT TO authenticated USING (ativo = TRUE OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Usuarios consultam horarios SLA" ON public.sla_calendario_horarios;
CREATE POLICY "Usuarios consultam horarios SLA" ON public.sla_calendario_horarios
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sla_calendarios c WHERE c.id = calendario_id AND (c.ativo = TRUE OR public.has_role(auth.uid(), 'admin')))
);

DROP POLICY IF EXISTS "Usuarios consultam regras SLA" ON public.sla_regras;
CREATE POLICY "Usuarios consultam regras SLA" ON public.sla_regras
FOR SELECT TO authenticated USING (ativo = TRUE OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin gerencia calendarios SLA" ON public.sla_calendarios;
CREATE POLICY "Admin gerencia calendarios SLA" ON public.sla_calendarios
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin gerencia horarios SLA" ON public.sla_calendario_horarios;
CREATE POLICY "Admin gerencia horarios SLA" ON public.sla_calendario_horarios
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin gerencia regras SLA" ON public.sla_regras;
CREATE POLICY "Admin gerencia regras SLA" ON public.sla_regras
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Usuarios consultam eventos SLA" ON public.sla_eventos;
CREATE POLICY "Usuarios consultam eventos SLA" ON public.sla_eventos
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = chamado_id AND (
    c.solicitante_id = auth.uid()
    OR c.atendente_id = auth.uid()
    OR public.has_role(auth.uid(), 'gestor')
    OR public.has_role(auth.uid(), 'admin')
  ))
);

DROP POLICY IF EXISTS "Service role grava eventos SLA" ON public.sla_eventos;
CREATE POLICY "Service role grava eventos SLA" ON public.sla_eventos
FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
