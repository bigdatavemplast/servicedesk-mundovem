-- ITSM Ativos: responsável pode ser uma pessoa externa ao portal.
-- Remove a dependência de profiles e armazena o nome informado livremente.
alter table public.itsm_ativos
  drop column if exists responsavel_id;

alter table public.itsm_ativos
  add column if not exists responsavel_nome text;

-- Dados técnicos são informações operacionais livres, não uma estrutura JSON obrigatória.
alter table public.itsm_ativos
  alter column dados_tecnicos type text
  using case
    when dados_tecnicos is null then null
    else dados_tecnicos::text
  end;
