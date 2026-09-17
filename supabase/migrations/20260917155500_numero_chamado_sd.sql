-- ============================================================
-- Numeração amigável dos chamados
-- Novo padrão: SD-000001, SD-000002, ...
-- ============================================================

-- Mantém a sequência existente, mas garante que novos chamados
-- recebam o padrão visual único do Service Desk.
CREATE OR REPLACE FUNCTION public.numero_chamado_padrao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR BTRIM(NEW.numero) = '' THEN
    NEW.numero := 'SD-' || LPAD(nextval('public.chamado_seq')::TEXT, 6, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_numero_chamado_padrao ON public.chamados;
CREATE TRIGGER trg_numero_chamado_padrao
BEFORE INSERT ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.numero_chamado_padrao();

REVOKE ALL ON FUNCTION public.numero_chamado_padrao() FROM PUBLIC, anon, authenticated;

-- Padroniza números antigos que já estavam no formato SD-00001,
-- preservando os demais identificadores históricos para não quebrar
-- referências existentes.
UPDATE public.chamados
SET numero = 'SD-' || LPAD(SUBSTRING(numero FROM '^SD-([0-9]+)$'), 6, '0')
WHERE numero ~ '^SD-[0-9]+$'
  AND LENGTH(SUBSTRING(numero FROM '^SD-([0-9]+)$')) < 6;
