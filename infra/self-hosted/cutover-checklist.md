# Checklist de cutover — Vemplast Support Hub

## Antes

- [ ] VM com Docker e firewall
- [ ] DNS configurado
- [ ] HTTPS válido
- [ ] Stack self-hosted iniciado
- [ ] Backup externo da origem validado
- [ ] Restore de staging validado
- [ ] `auth.users` presente
- [ ] Perfis/roles presentes
- [ ] RLS validado
- [ ] Bucket `chamados-anexos` presente
- [ ] Objetos do Storage validados
- [ ] SMTP testado
- [ ] Funções/integrações externas testadas
- [ ] Usuário de teste consegue entrar
- [ ] Usuário de teste consegue criar/visualizar chamado
- [ ] Anexo pode ser enviado e baixado
- [ ] Rollback testado

## Durante

- [ ] Congelar mudanças de dados por uma janela curta
- [ ] Fazer backup final
- [ ] Sincronizar alterações finais
- [ ] Atualizar variáveis da aplicação para o endpoint próprio
- [ ] Deploy
- [ ] Smoke test de login
- [ ] Smoke test de chamados
- [ ] Smoke test de anexos
- [ ] Smoke test de permissões
- [ ] Monitorar erros

## Depois

- [ ] Confirmar novos logins
- [ ] Confirmar criação de chamados
- [ ] Confirmar anexos
- [ ] Confirmar e-mails
- [ ] Confirmar automações
- [ ] Confirmar assistente
- [ ] Confirmar logs/alertas
- [ ] Manter origem intacta durante a janela de rollback
- [ ] Só depois retirar dependências antigas
