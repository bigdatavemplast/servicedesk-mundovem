-- Ensure the active Logística segment has exactly one operational queue.
-- Idempotent so this migration is safe if the queue was created manually first.
insert into public.grupos_atendimento (nome, descricao, segmento_id, ativo, ordem, prefixo)
select 'Fila Logística', 'Atendimento das solicitações da área de Logística', s.id, true, 1, 'SD-LOG'
from public.segmentos s
where s.id = 'd31690cd-3215-4e23-a59b-0e9021243d29'::uuid
  and s.ativo = true
  and not exists (
    select 1
    from public.grupos_atendimento g
    where g.segmento_id = s.id
      and g.ativo = true
  );
