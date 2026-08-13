# Correções implementadas — Service Desk

## Banco de dados
Aplicar a migration:
`supabase/migrations/20260813100000_service_desk_sla_areas.sql`

Ela cria:
- `areas`
- `profiles.area_id`
- `historico_sla_chamado`
- campos de pausa do SLA em `chamados`
- regras de escopo por área para gestores
- trigger automático de pausa/retomada do SLA
- status dinâmico do SLA

## SLA
Regra implementada:
- mais de 1h restante: OK
- até 1h restante: Vencendo
- prazo ultrapassado: Vencido
- resposta pública de atendente/gestor/admin: Pausa
- resposta pública do solicitante: Retoma com o tempo restante
- nota interna: não altera o SLA

O SLA pode passar por vários ciclos de pausa/retomada sem reiniciar o prazo.

## Dashboard
- acesso somente para gestor/admin;
- admin vê todos os chamados;
- gestor fica limitado, no banco, aos chamados dos usuários da mesma `area_id`;
- menu do dashboard não aparece para atendentes/colaboradores.

## Áreas
A área é armazenada em `profiles.area_id`.
A migration tenta transformar os departamentos existentes em áreas.
Ao cadastrar/editar usuário, se for informado um departamento sem selecionar uma área, o sistema cria/reutiliza automaticamente uma área com aquele nome.

## E-mail
O projeto não possuía implementação de envio de e-mail. Foi criada integração com a API do Resend.

Configure no ambiente de execução:
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SERVICE_DESK_N1_EMAIL`
- `SERVICE_DESK_PUBLIC_URL` (ou `APP_URL`)

Exemplo:
`SERVICE_DESK_N1_EMAIL=n1@empresa.com.br`

Os e-mails implementados são:
- abertura de chamado -> N1;
- resposta pública da equipe -> solicitante;
- fechamento -> solicitante.

Sem `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, o Service Desk continua funcionando, mas o envio de e-mail fica desabilitado e é registrado no log do servidor.

## Arquivos principais alterados
- `src/lib/chamado.functions.ts`
- `src/lib/email.service.ts`
- `src/lib/admin-users.functions.ts`
- `src/routes/_authenticated/chamados.novo.tsx`
- `src/routes/_authenticated/chamados.$id.tsx`
- `src/routes/_authenticated/fila.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- `src/routes/_authenticated/route.tsx`
- `src/routes/_authenticated/admin.usuarios.tsx`
- `src/lib/mcp/tools/criar-chamado.ts`
- `src/lib/mcp/tools/comentar-chamado.ts`
- migration SQL acima
