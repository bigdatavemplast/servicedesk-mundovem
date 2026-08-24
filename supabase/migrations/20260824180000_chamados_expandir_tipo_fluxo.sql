-- O catálogo possui tipos distintos para Acesso, Dúvida e Solicitação.
-- A coluna chamados.tipo_fluxo precisa aceitar os mesmos fluxos usados
-- pelo motor de SLA e pelo catálogo.

ALTER TABLE public.chamados
  DROP CONSTRAINT IF EXISTS chamados_tipo_fluxo_chk;

ALTER TABLE public.chamados
  ADD CONSTRAINT chamados_tipo_fluxo_chk
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
