# Plano de migração do Service Desk para Supabase próprio

Data: 2026-09-22

## Objetivo

Migrar o Service Desk para um projeto Supabase próprio, sem depender do Lovable Cloud pausado, preservando o schema, regras de segurança, Auth, Storage e RPCs existentes.

## Inventário confirmado no repositório

- 124 migrations em `supabase/migrations/`.
- 57 tabelas declaradas no snapshot `src/integrations/supabase/types.ts`.
- 1 view: `itsm_governanca_resumo`.
- 30 RPCs/funções declaradas no snapshot de tipos.
- Enums principais: `app_role`, `prioridade_chamado`, `status_chamado`, `tipo_notificacao`.
- Extensões utilizadas: `pgcrypto` e `unaccent`.
- RLS e policies são parte essencial do funcionamento.
- Triggers são usados para Auth/perfis, histórico, notificações, status, auditoria e automações.
- Auth utiliza Supabase Auth e `auth.users`; o login do frontend usa `signInWithPassword`.
- Storage utilizado pelo aplicativo: bucket `chamados-anexos`.
- Anexos: png, jpg, jpeg, webp, pdf, docx, xlsx e txt; limite de 10 MB por arquivo.
- Não foi encontrada uma pasta `supabase/functions/`; não há evidência de Edge Functions próprias do projeto.
- O frontend/server code chama RPCs PostgreSQL diretamente e usa Supabase Storage pelo SDK.

## RPCs declaradas

```
atribuir_chamado
avaliar_artigo_base_conhecimento
avaliar_chamado
buscar_artigos_semanticos
dashboard_escopo_gestor
executar_escalonamento_sla_n1_n2
fechar_chamado_apos_avaliacao
gestao_atualizar_abandonos
gestao_csat
gestor_mesma_area
has_any_role
has_role
incrementar_visualizacao_base_conhecimento
itsm_e_gestor_ou_admin
itsm_tem_papel
itsm_tem_permissao
match_conhecimento
obter_feedback_artigo_base_conhecimento
obter_satisfacao_artigo_base_conhecimento
obter_satisfacao_artigos_base_conhecimento
perfil_visivel_por_chamado
processar_escalonamentos_sla
proximo_numero_fila
registrar_evento_gestao_atendimento
registrar_evento_sla
selecionar_regra_sla
sla_calcular_prazo_util
slugify_conhecimento
status_sla_resolucao
unaccent
```

## Tabelas do snapshot

1. ai_conversations
2. ai_messages
3. alteracoes_service_desk
4. alteracoes_service_desk_historico
5. anexos_chamado
6. areas
7. assistant_logs
8. automacoes_service_desk
9. avaliacoes_atendimento
10. base_conhecimento
11. base_conhecimento_avaliacoes
12. base_conhecimento_feedback
13. categorias
14. chamados
15. comentarios_chamado
16. departamentos
17. documentacao_sistema
18. documentos_assistente
19. escalonamento_regras
20. escalonamentos_chamado
21. gestao_atendimento_eventos
22. gestao_capacidade
23. grupo_atendentes
24. grupo_sequencias
25. grupos_atendimento
26. historico_chamado
27. historico_sla_chamado
28. itsm_aprovacoes
29. itsm_artigos_conhecimento
30. itsm_ativos
31. itsm_auditoria
32. itsm_catalogo_avancado
33. itsm_governanca
34. itsm_itens_catalogo
35. itsm_mudanca_chamado
36. itsm_mudancas
37. itsm_permissoes_usuario
38. itsm_politicas_governanca
39. itsm_problema_chamado
40. itsm_problemas
41. itsm_relacionamentos
42. itsm_servico_chamado
43. itsm_servicos
44. notificacoes
45. perguntas_sem_resposta
46. pesquisas_satisfacao_equipe
47. profiles
48. regras_atribuicao_automatica
49. segmentos
50. sla_calendario_horarios
51. sla_calendarios
52. sla_eventos
53. sla_regras
54. slas
55. subcategorias
56. tipos_chamado
57. user_roles

## O que será migrado automaticamente pelas migrations

O novo projeto deve receber as migrations existentes, em ordem cronológica, depois de uma validação local. Não devemos editar a sequência histórica sem necessidade.

Fluxo planejado:

1. Criar projeto Supabase próprio.
2. Copiar/usar as migrations existentes do repositório.
3. Executar `supabase db reset` localmente para validar a sequência completa.
4. Corrigir somente erros de reprodução encontrados.
5. Fazer `supabase link --project-ref <novo-ref>`.
6. Executar primeiro `supabase db push --dry-run`.
7. Revisar a lista.
8. Executar `supabase db push`.
9. Gerar novamente os tipos TypeScript e comparar com `src/integrations/supabase/types.ts`.

## Itens que NÃO devem ser tratados como resolvidos apenas pelas migrations

### Auth

As migrations podem criar referências, triggers e lógica relacionada a `auth.users`, mas não devem ser consideradas uma cópia dos usuários atuais.

Os usuários do projeto antigo precisam ser tratados separadamente. Não vamos inventar senhas nem copiar credenciais.

Primeiro objetivo: criar o novo Auth e testar cadastro/login. A migração de usuários existentes será uma etapa separada, dependendo do método de export/import permitido pelo Supabase e dos dados disponíveis.

### Storage

O aplicativo usa:

`chamados-anexos`

O bucket e suas policies precisam existir no novo projeto.

O código confirmado usa:
- `upload`
- `createSignedUrl`
- `remove`

As policies específicas do Storage não estão suficientemente evidentes no snapshot TypeScript para serem inventadas. Antes da produção, elas devem ser obtidas das migrations atuais ou do projeto antigo, se o Cloud voltar a ficar acessível.

### Dados

Schema e dados são coisas diferentes.

As migrations podem conter inserts/seed/configurações, mas isso não significa que elas contenham todos os chamados, comentários, anexos, usuários e histórico do ambiente atual.

A migração de dados operacionais será uma etapa separada.

## Critérios de validação

Antes de apontar o frontend para o novo projeto:

- [ ] todas as migrations aplicam sem erro
- [ ] 57 tabelas presentes
- [ ] view `itsm_governanca_resumo` presente
- [ ] funções/RPC presentes
- [ ] enums presentes
- [ ] RLS habilitado nas tabelas esperadas
- [ ] policies testadas com usuário colaborador
- [ ] policies testadas com atendente
- [ ] policies testadas com gestor
- [ ] policies testadas com admin
- [ ] Auth login funcionando
- [ ] criação de profile funcionando
- [ ] bucket `chamados-anexos` funcionando
- [ ] upload de anexo funcionando
- [ ] signed URL funcionando
- [ ] remoção de anexo respeitando autorização
- [ ] criação de chamado funcionando
- [ ] comentários/histórico funcionando
- [ ] SLAs/RPCs funcionando
- [ ] notificações funcionando
- [ ] tipos TypeScript regenerados e sem divergência relevante

## Regra de segurança

Não alterar nem apagar o projeto Cloud antigo para executar esta migração.

O novo projeto deve ser construído em paralelo. O frontend só será apontado para o novo Supabase depois que Auth, banco e Storage forem validados.

## Próxima execução

A próxima etapa operacional é preparar o ambiente local para executar todas as 124 migrations e produzir um relatório de erros/ordem de dependências.

Depois disso, o projeto Supabase novo pode ser criado e receber o schema via `supabase db push`.
