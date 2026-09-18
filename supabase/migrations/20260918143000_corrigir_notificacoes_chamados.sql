-- Centraliza notificacoes de abertura no trigger principal e remove duplicidades.
DROP TRIGGER IF EXISTS trg_notificar_chamado_aberto ON public.chamados;

WITH duplicadas AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY destinatario_id, chamado_id, tipo
           ORDER BY criado_em ASC, id ASC
         ) AS rn
  FROM public.notificacoes
  WHERE tipo = 'chamado_aberto'
    AND chamado_id IS NOT NULL
)
DELETE FROM public.notificacoes n
USING duplicadas d
WHERE n.id = d.id
  AND d.rn > 1;
