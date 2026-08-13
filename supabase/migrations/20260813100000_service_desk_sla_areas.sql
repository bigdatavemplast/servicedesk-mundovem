
-- =============================================================
-- SERVICE DESK VEMPLAST - SLA pausável, áreas, gestores e acesso
-- =============================================================

-- 1) ÁREAS
CREATE TABLE IF NOT EXISTS public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem areas" ON public.areas;
CREATE POLICY "Autenticados leem areas" ON public.areas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin gerencia areas" ON public.areas;
CREATE POLICY "Admin gerencia areas" ON public.areas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.areas (nome)
SELECT DISTINCT TRIM(departamento)
FROM public.profiles
WHERE departamento IS NOT NULL AND TRIM(departamento) <> ''
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.areas (nome)
VALUES ('Sem área')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_area_id ON public.profiles(area_id);

UPDATE public.profiles p
SET area_id = a.id
FROM public.areas a
WHERE p.area_id IS NULL
  AND p.departamento IS NOT NULL
  AND TRIM(p.departamento) = a.nome;

-- 2) CAMPOS DE CONTROLE DO SLA DE RESOLUÇÃO
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS sla_pausado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sla_pausado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_tempo_restante_segundos BIGINT;

CREATE INDEX IF NOT EXISTS idx_chamados_sla_pausado
  ON public.chamados(sla_pausado);

CREATE TABLE IF NOT EXISTS public.historico_sla_chamado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('inicio','pausa','retomada','vencimento')),
  autor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tempo_restante_segundos BIGINT,
  prazo_anterior TIMESTAMPTZ,
  novo_prazo TIMESTAMPTZ,
  observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_historico_sla_chamado
  ON public.historico_sla_chamado(chamado_id, criado_em);

GRANT SELECT ON public.historico_sla_chamado TO authenticated;
GRANT ALL ON public.historico_sla_chamado TO service_role;
ALTER TABLE public.historico_sla_chamado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participantes leem historico SLA" ON public.historico_sla_chamado;
CREATE POLICY "Participantes leem historico SLA"
ON public.historico_sla_chamado
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = historico_sla_chamado.chamado_id
      AND (
        c.solicitante_id = auth.uid()
        OR public.has_any_role(auth.uid(), ARRAY['atendente','gestor','admin']::public.app_role[])
      )
  )
);

-- 3) ÁREA DO GESTOR
-- O gestor usa a própria area_id como área que supervisiona.
-- Assim, um administrador consegue classificar o gestor na área
-- e todos os colaboradores daquela área ficam sob sua visão.

CREATE OR REPLACE FUNCTION public.gestor_mesma_area(_gestor_id UUID, _colaborador_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles gestor
    JOIN public.profiles colaborador ON colaborador.id = _colaborador_id
    WHERE gestor.id = _gestor_id
      AND gestor.area_id IS NOT NULL
      AND colaborador.area_id = gestor.area_id
  );
$$;

REVOKE ALL ON FUNCTION public.gestor_mesma_area(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestor_mesma_area(UUID, UUID) TO authenticated;

-- 4) RESTRINGIR CHAMADOS DE GESTORES À PRÓPRIA ÁREA
DROP POLICY IF EXISTS "Atendente/gestor/admin veem todos chamados" ON public.chamados;

CREATE POLICY "Staff veem chamados conforme escopo"
ON public.chamados
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'atendente')
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND public.gestor_mesma_area(auth.uid(), solicitante_id)
  )
);

DROP POLICY IF EXISTS "Atendente/gestor/admin atualizam chamados" ON public.chamados;

CREATE POLICY "Staff atualizam chamados conforme escopo"
ON public.chamados
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'atendente')
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND public.gestor_mesma_area(auth.uid(), solicitante_id)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'atendente')
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND public.gestor_mesma_area(auth.uid(), solicitante_id)
  )
);

-- 5) COMENTÁRIOS/HISTÓRICO RESPEITAM O ESCOPO DO GESTOR
DROP POLICY IF EXISTS "Ler comentários do chamado" ON public.comentarios_chamado;
CREATE POLICY "Ler comentários do chamado"
ON public.comentarios_chamado
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = comentarios_chamado.chamado_id
      AND (
        (c.solicitante_id = auth.uid() AND comentarios_chamado.interno = FALSE)
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'atendente')
        OR (
          public.has_role(auth.uid(), 'gestor')
          AND public.gestor_mesma_area(auth.uid(), c.solicitante_id)
        )
      )
  )
);

DROP POLICY IF EXISTS "Autor cria comentário no próprio chamado ou atendente/gestor/admin" ON public.comentarios_chamado;
CREATE POLICY "Autor cria comentário no próprio chamado ou staff"
ON public.comentarios_chamado
FOR INSERT TO authenticated
WITH CHECK (
  autor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = comentarios_chamado.chamado_id
      AND (
        c.solicitante_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'atendente')
        OR (
          public.has_role(auth.uid(), 'gestor')
          AND public.gestor_mesma_area(auth.uid(), c.solicitante_id)
        )
      )
  )
);

-- 6) HISTÓRICO DE CHAMADO
DROP POLICY IF EXISTS "Ler histórico do chamado" ON public.historico_chamado;
CREATE POLICY "Ler histórico do chamado"
ON public.historico_chamado
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.id = historico_chamado.chamado_id
      AND (
        c.solicitante_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'atendente')
        OR (
          public.has_role(auth.uid(), 'gestor')
          AND public.gestor_mesma_area(auth.uid(), c.solicitante_id)
        )
      )
  )
);

-- 7) FUNÇÃO CENTRALIZADA PARA PAUSAR/RETOMAR O SLA
CREATE OR REPLACE FUNCTION public.atualizar_sla_por_interacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chamado public.chamados%ROWTYPE;
  v_staff BOOLEAN;
  v_agora TIMESTAMPTZ := COALESCE(NEW.criado_em, NOW());
  v_restante BIGINT;
BEGIN
  SELECT * INTO v_chamado
  FROM public.chamados
  WHERE id = NEW.chamado_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Nota interna não altera o SLA.
  IF NEW.interno THEN
    RETURN NEW;
  END IF;

  v_staff := public.has_any_role(
    NEW.autor_id,
    ARRAY['atendente','gestor','admin']::public.app_role[]
  );

  IF v_staff THEN
    -- Resposta pública da equipe: pausa o SLA de resolução.
    IF NOT COALESCE(v_chamado.sla_pausado, FALSE)
       AND v_chamado.status NOT IN ('resolvido','fechado','cancelado') THEN

      v_restante := GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (COALESCE(v_chamado.prazo_resolucao, v_agora) - v_agora)))::BIGINT
      );

      UPDATE public.chamados
      SET
        sla_pausado = TRUE,
        sla_pausado_em = v_agora,
        sla_tempo_restante_segundos = v_restante,
        status = CASE
          WHEN status IN ('aberto','em_andamento') THEN 'aguardando_usuario'::public.status_chamado
          ELSE status
        END
      WHERE id = NEW.chamado_id;

      INSERT INTO public.historico_sla_chamado(
        chamado_id, tipo, autor_id, criado_em, tempo_restante_segundos,
        prazo_anterior, novo_prazo, observacao
      )
      VALUES (
        NEW.chamado_id, 'pausa', NEW.autor_id, v_agora, v_restante,
        v_chamado.prazo_resolucao, v_chamado.prazo_resolucao,
        'SLA pausado após resposta pública da equipe.'
      );
    END IF;

  ELSE
    -- Resposta pública do solicitante: retoma o SLA usando exatamente
    -- o tempo restante salvo no momento da pausa.
    IF v_chamado.sla_pausado
       AND v_chamado.sla_tempo_restante_segundos IS NOT NULL
       AND v_chamado.status NOT IN ('resolvido','fechado','cancelado') THEN

      v_restante := GREATEST(v_chamado.sla_tempo_restante_segundos, 0);

      UPDATE public.chamados
      SET
        sla_pausado = FALSE,
        sla_pausado_em = NULL,
        sla_tempo_restante_segundos = NULL,
        prazo_resolucao = v_agora + make_interval(secs => v_restante),
        status = CASE
          WHEN status = 'aguardando_usuario' THEN 'em_andamento'::public.status_chamado
          ELSE status
        END
      WHERE id = NEW.chamado_id;

      INSERT INTO public.historico_sla_chamado(
        chamado_id, tipo, autor_id, criado_em, tempo_restante_segundos,
        prazo_anterior, novo_prazo, observacao
      )
      VALUES (
        NEW.chamado_id, 'retomada', NEW.autor_id, v_agora, v_restante,
        v_chamado.prazo_resolucao,
        v_agora + make_interval(secs => v_restante),
        'SLA retomado após resposta do solicitante.'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comentario_atualiza_sla ON public.comentarios_chamado;
CREATE TRIGGER trg_comentario_atualiza_sla
AFTER INSERT ON public.comentarios_chamado
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_sla_por_interacao();

REVOKE ALL ON FUNCTION public.atualizar_sla_por_interacao() FROM PUBLIC, anon, authenticated;

-- 8) REGISTRAR O INÍCIO DO SLA PARA CHAMADOS NOVOS
CREATE OR REPLACE FUNCTION public.chamado_after_insert_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.historico_sla_chamado(
    chamado_id, tipo, autor_id, criado_em, tempo_restante_segundos,
    prazo_anterior, novo_prazo, observacao
  )
  VALUES (
    NEW.id, 'inicio', NEW.solicitante_id, NEW.aberto_em,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NEW.prazo_resolucao - NEW.aberto_em)))::BIGINT),
    NEW.prazo_resolucao, NEW.prazo_resolucao,
    'Início da contagem do SLA de resolução.'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chamado_after_insert_sla ON public.chamados;
CREATE TRIGGER trg_chamado_after_insert_sla
AFTER INSERT ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.chamado_after_insert_sla();

REVOKE ALL ON FUNCTION public.chamado_after_insert_sla() FROM PUBLIC, anon, authenticated;

-- 9) FUNÇÃO PARA EXPOR STATUS DINÂMICO DO SLA
CREATE OR REPLACE FUNCTION public.status_sla_resolucao(
  p_prazo TIMESTAMPTZ,
  p_pausado BOOLEAN,
  p_restante BIGINT
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_pausado THEN 'pausado'
    WHEN p_prazo IS NULL THEN 'sem_sla'
    WHEN p_prazo <= NOW() THEN 'vencido'
    WHEN p_prazo <= NOW() + INTERVAL '1 hour' THEN 'vencendo'
    ELSE 'ok'
  END;
$$;

REVOKE ALL ON FUNCTION public.status_sla_resolucao(TIMESTAMPTZ, BOOLEAN, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.status_sla_resolucao(TIMESTAMPTZ, BOOLEAN, BIGINT) TO authenticated;
