-- RESET SEGURO DO AMBIENTE OPERACIONAL
-- Preserva usuários, papéis, departamentos, áreas, categorias, SLAs,
-- configurações e demais cadastros mestres.
--
-- Execute esta migration somente quando quiser limpar chamados/comentários
-- e demais registros operacionais de teste antes da entrada em produção.

BEGIN;

-- Comentários dependem de chamados.
TRUNCATE TABLE public.comentarios_chamado RESTART IDENTITY CASCADE;

-- Chamados são dados operacionais/teste. O CASCADE remove somente registros
-- dependentes dessas ocorrências (ex.: histórico/vínculos), sem apagar cadastros.
TRUNCATE TABLE public.chamados RESTART IDENTITY CASCADE;

COMMIT;
