-- =============================================================
-- SERVICE DESK VEMPLAST — Tipos de Chamado
-- =============================================================
-- Migration idempotente: preserva estruturas/dados já existentes.

-- ========== TIPOS DE CHAMADO ==========
CREATE TABLE IF NOT EXISTS public.tipos_chamado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tipos_chamado
  ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.tipos_chamado
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.tipos_chamado
  ADD COLUMN IF NOT EXISTS ordem INT NOT NULL DEFAULT 0;
ALTER TABLE public.tipos_chamado
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.tipos_chamado
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_chamado_nome
  ON public.tipos_chamado(nome);
CREATE INDEX IF NOT EXISTS idx_tipos_chamado_ativo
  ON public.tipos_chamado(ativo);
CREATE INDEX IF NOT EXISTS idx_tipos_chamado_ordem
  ON public.tipos_chamado(ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_chamado TO authenticated;
GRANT ALL ON public.tipos_chamado TO service_role;

ALTER TABLE public.tipos_chamado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem tipos de chamado" ON public.tipos_chamado;
CREATE POLICY "Autenticados leem tipos de chamado"
  ON public.tipos_chamado
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin gerencia tipos de chamado" ON public.tipos_chamado;
CREATE POLICY "Admin gerencia tipos de chamado"
  ON public.tipos_chamado
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== TIPOS INICIAIS ==========
INSERT INTO public.tipos_chamado (nome, descricao, ordem) VALUES
  ('Incidente', 'Interrupção ou falha inesperada de um serviço, sistema, equipamento ou processo.', 1),
  ('Solicitação', 'Pedido de serviço, acesso, informação, configuração ou atendimento padrão.', 2),
  ('Dúvida', 'Pedido de esclarecimento, orientação ou informação sobre sistemas, serviços ou processos.', 3),
  ('Acesso', 'Solicitação relacionada à criação, alteração, desbloqueio ou remoção de acesso.', 4),
  ('Projeto', 'Demanda relacionada à implantação ou execução de um projeto.', 5),
  ('Melhoria', 'Sugestão ou demanda para melhorar um sistema, serviço, processo ou recurso existente.', 6),
  ('Outros', 'Demanda que não se enquadra nos demais tipos disponíveis.', 7)
ON CONFLICT (nome) DO NOTHING;

-- ========== RELACIONAMENTO COM CHAMADOS ==========
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS tipo_chamado_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chamados_tipo_chamado_id_fkey'
      AND conrelid = 'public.chamados'::regclass
  ) THEN
    ALTER TABLE public.chamados
      ADD CONSTRAINT chamados_tipo_chamado_id_fkey
      FOREIGN KEY (tipo_chamado_id)
      REFERENCES public.tipos_chamado(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chamados_tipo_chamado
  ON public.chamados(tipo_chamado_id);

-- ========== ATUALIZAÇÃO ==========
CREATE OR REPLACE FUNCTION public.atualizar_tipos_chamado_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tipos_chamado_atualizado_em ON public.tipos_chamado;
CREATE TRIGGER trg_tipos_chamado_atualizado_em
BEFORE UPDATE ON public.tipos_chamado
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_tipos_chamado_atualizado_em();

COMMENT ON TABLE public.tipos_chamado IS
  'Tipos que representam a natureza do atendimento do chamado, independentes de segmento, categoria e subcategoria.';

COMMENT ON COLUMN public.chamados.tipo_chamado_id IS
  'Tipo de Chamado que representa a natureza do atendimento.';
