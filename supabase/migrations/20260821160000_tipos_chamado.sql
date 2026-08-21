-- =============================================================
-- SERVICE DESK VEMPLAST — Tipos de Chamado
-- =============================================================
-- Tipo de Chamado representa a natureza do atendimento e é
-- independente de Segmento, Categoria e Subcategoria.
--
-- Exemplo:
-- Tipo: Incidente | Segmento: TI | Categoria: Hardware | Subcategoria: Notebook
-- Tipo: Solicitação | Segmento: TI | Categoria: Sistemas | Subcategoria: Nova Solicitação
-- =============================================================

-- ========== TIPOS DE CHAMADO ==========
CREATE TABLE public.tipos_chamado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tipos_chamado_nome UNIQUE (nome)
);

CREATE INDEX idx_tipos_chamado_ativo ON public.tipos_chamado(ativo);
CREATE INDEX idx_tipos_chamado_ordem ON public.tipos_chamado(ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_chamado TO authenticated;
GRANT ALL ON public.tipos_chamado TO service_role;

ALTER TABLE public.tipos_chamado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem tipos de chamado"
  ON public.tipos_chamado
  FOR SELECT
  TO authenticated
  USING (true);

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
  ADD COLUMN tipo_chamado_id UUID REFERENCES public.tipos_chamado(id) ON DELETE SET NULL;

CREATE INDEX idx_chamados_tipo_chamado ON public.chamados(tipo_chamado_id);

-- Atualiza automaticamente o campo de alteração dos tipos de chamado.
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

CREATE TRIGGER trg_tipos_chamado_atualizado_em
BEFORE UPDATE ON public.tipos_chamado
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_tipos_chamado_atualizado_em();

COMMENT ON TABLE public.tipos_chamado IS
  'Tipos que representam a natureza do atendimento do chamado, independentes de segmento, categoria e subcategoria.';

COMMENT ON COLUMN public.chamados.tipo_chamado_id IS
  'Tipo de Chamado que representa a natureza do atendimento.';
