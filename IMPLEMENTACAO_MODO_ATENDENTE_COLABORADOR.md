# Implementação do modo atendente/colaborador

A migration `20260916150000_modo_atendente_colaborador.sql` adiciona a preferência segura de modo para usuários que possuem o papel `atendente`. O papel real não é removido ao trocar para colaborador.

## Interface esperada

No cabeçalho, somente para atendentes:

Leonardo Neto
Atendente ▼

Ao abrir o menu:
- Atendente
- Colaborador

A troca chama `public.alterar_modo_atendimento('atendente'|'colaborador')` e atualiza o contexto da interface.
