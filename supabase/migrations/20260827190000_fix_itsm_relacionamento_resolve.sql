-- Corrige o CHECK da coluna relacao para ficar alinhado à interface
-- de Relacionamentos ITSM.

alter table public.itsm_relacionamentos
  drop constraint if exists itsm_relacionamentos_relacao_check;

alter table public.itsm_relacionamentos
  add constraint itsm_relacionamentos_relacao_check
  check (relacao in (
    'causado_por',
    'origina',
    'impacta',
    'resolve',
    'depende_de',
    'suporta',
    'hospeda',
    'conecta_com',
    'substitui',
    'relacionado_a'
  ));
