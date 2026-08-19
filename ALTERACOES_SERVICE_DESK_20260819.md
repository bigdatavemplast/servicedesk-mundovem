# Alterações do Service Desk — 19/08/2026

## Implementado

- Dashboard por perfil: colaborador, atendente, gestor e admin.
- Colaborador: somente indicadores e chamados próprios.
- Atendente: indicadores da própria operação, com fila própria + chamados sem atendente no total.
- Gestor: dashboard gerencial limitado aos chamados da própria equipe/área.
- Admin: dashboard completo.
- Filtro de segmento no dashboard gerencial.
- Segmentos iniciais: TI, RH, Projetos, Financeiro e Outros.
- Segmento do chamado herdado automaticamente da categoria.
- Chamados existentes recebem o segmento da categoria atual.
- Cards do painel admin transformados em atalhos clicáveis.
- Colaborador não pode alterar prioridade nem atendente, inclusive pelo backend/banco.
- Nota interna disponível para envio e visualização somente por atendentes.
- Status, prioridade e atendente exigem confirmação antes da gravação.

## Migration

Arquivo:

`supabase/migrations/20260819090000_dashboard_perfis_segmentos.sql`

Aplicar a migration no projeto Supabase antes de testar as novas telas.

## Observação sobre validação

O código foi submetido a uma verificação sintática/TypeScript dos arquivos alterados. A validação de build completo não pôde ser executada neste ambiente porque as dependências do projeto não estavam instaladas e a instalação via npm excedeu o tempo disponível.
