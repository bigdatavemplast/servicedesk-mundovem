-- Garante uma fila ativa para cada área operacional nova.
-- Os atendentes são associados pela aplicação/administração de usuários.

INSERT INTO public.grupos_atendimento (segmento_id, nome, descricao, ativo, ordem, prefixo)
SELECT s.id, v.nome, v.descricao, TRUE, 1, v.prefixo
FROM public.segmentos s
JOIN (
  VALUES
    ('Comercial',  'Fila Comercial',  'Atendimento das solicitações da área Comercial',  'SD-COM'),
    ('E-commerce', 'Fila E-commerce', 'Atendimento das solicitações da área E-commerce', 'SD-ECOM'),
    ('Expedição',  'Fila Expedição',  'Atendimento das solicitações da área de Expedição', 'SD-EXP'),
    ('Fábrica',    'Fila Fábrica',    'Atendimento das solicitações da área de Fábrica',   'SD-FAB'),
    ('Marketing',  'Fila Marketing',  'Atendimento das solicitações da área de Marketing', 'SD-MKT')
) AS v(area, nome, descricao, prefixo) ON s.nome = v.area
ON CONFLICT (segmento_id, nome)
DO UPDATE SET
  ativo = TRUE,
  descricao = EXCLUDED.descricao,
  prefixo = EXCLUDED.prefixo,
  ordem = EXCLUDED.ordem;
