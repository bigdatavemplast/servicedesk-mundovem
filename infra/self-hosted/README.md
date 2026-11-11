# Migração para backend próprio (self-hosted)

## Objetivo

Remover a dependência do **Supabase gerenciado** sem reescrever o aplicativo nem criar uma autenticação caseira insegura.

A primeira etapa usa o **Supabase self-hosted** (PostgreSQL + GoTrue/Auth + PostgREST + Storage + Realtime + Functions). Isso mantém a compatibilidade com o código atual e permite preservar `auth.users`, RLS e as tabelas existentes.

> Esta pasta não contém segredos e não altera o ambiente de produção atual.

## Estado

- Aplicação: pronta para receber uma nova `SUPABASE_URL`/chave por ambiente.
- Banco: migrações versionadas já estão no repositório.
- Auth: continua usando o protocolo Supabase/GoTrue; os usuários podem ser restaurados a partir de `auth.users`.
- Storage: o bucket `chamados-anexos` precisa ser migrado separadamente, porque dump SQL não transporta os objetos.
- Infraestrutura: **BLOQUEADA** até existir uma VM/VPS Linux com Docker, DNS e HTTPS.

## Versão de referência

A configuração self-hosted oficial usada neste plano é `self-hosted/v0.8.1` (snapshot publicado em setembro de 2026). Ela deve ser atualizada conscientemente, e não simplesmente seguir `master`.

O Supabase documenta Docker como o caminho recomendado para self-hosting e informa que o operador passa a ser responsável por servidor, segurança, backups, atualizações e recuperação de desastre.

## 1. Provisionar a VM

Recomendação inicial para este sistema:

- Linux 64-bit
- 4 vCPU
- 8 GB RAM
- 80 GB SSD
- Docker Engine + Docker Compose
- firewall permitindo somente 80/443 e SSH administrativo
- DNS: `api.seudominio` apontando para a VM

Não exponha Postgres, Studio, Realtime ou Storage diretamente à internet.

## 2. Baixar a configuração oficial

Na VM:

```bash
git clone --depth 1 --branch self-hosted/v0.8.1 https://github.com/supabase/supabase
mkdir -p /opt/vemplast-supabase
cp -rf supabase/docker/. /opt/vemplast-supabase/
cd /opt/vemplast-supabase
cp .env.example .env
printf 'ref=self-hosted/v0.8.1\n' > .supabase-version
```

Gere/defina todos os segredos no servidor. **Nenhum segredo deve entrar neste repositório.**

## 3. HTTPS e URL pública

O Auth self-hosted atual usa `API_EXTERNAL_URL` com o prefixo `/auth/v1`.

Exemplo:

```
API_EXTERNAL_URL=https://api.seudominio.com/auth/v1
```

O domínio público da aplicação deve estar em `GOTRUE_SITE_URL` e na lista de redirects permitidos.

## 4. Backup do Supabase gerenciado — antes de qualquer cutover

**Não executar contra produção sem primeiro verificar o destino e o espaço disponível.**

A estratégia oficial é exportar separadamente:

1. roles;
2. schema;
3. data.

O dump precisa preservar os schemas `auth` e `storage` necessários para manter usuários e metadados. Os objetos binários do Storage devem ser copiados separadamente.

Guardar os arquivos de backup fora da VM de destino e testar o restore antes do cutover.

## 5. Preservação da autenticação

O dump do banco inclui `auth.users` e dados relacionados. Portanto, as contas existentes podem ser preservadas.

**Importante:** o JWT secret da instância nova será diferente. Tokens emitidos pela instância gerenciada antiga deixarão de ser válidos; os usuários precisarão fazer login novamente depois do cutover.

Não exportar senhas para arquivos de aplicação e nunca copiar o conteúdo de `.env` para o Git.

## 6. Migração do Storage

O aplicativo usa o bucket:

```
chamados-anexos
```

A tabela `anexos_chamado` guarda `storage_path`, então os objetos precisam ser copiados mantendo exatamente esses caminhos.

Checklist:

- criar o bucket no destino;
- copiar cada objeto;
- validar quantidade e tamanho;
- validar amostras por hash/tamanho;
- só depois alterar o frontend para a nova URL;
- manter o storage antigo intacto até o rollback window terminar.

## 7. Cutover da aplicação

A aplicação já lê:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Assim, o mesmo código pode apontar para a instância própria.

Antes do cutover:

1. subir a instância própria;
2. restaurar banco em staging;
3. restaurar Storage;
4. testar login com usuário migrado;
5. testar RLS;
6. testar criação/consulta de chamado;
7. testar anexos;
8. testar funções/assistente;
9. testar recuperação de senha;
10. validar logs;
11. fazer backup final;
12. congelar alterações por alguns minutos;
13. fazer o cutover;
14. monitorar.

## 8. Rollback

Não desligar nem apagar o projeto gerenciado durante a migração.

Rollback = apontar novamente as variáveis de ambiente para a URL/chave antigas e redeployar a aplicação.

O banco gerenciado deve permanecer somente leitura ou operacional durante a janela de validação, conforme a estratégia de consistência escolhida.

## 9. O que ainda bloqueia a execução

Faltam recursos que não podem ser inventados pelo repositório:

- VM/VPS para hospedar o stack;
- domínio/subdomínio;
- acesso DNS;
- acesso administrativo à origem para fazer o backup completo;
- destino de backup externo;
- estratégia/credenciais para copiar o Storage;
- credenciais SMTP se recuperação de senha/e-mails forem usados;
- janela de cutover.

Depois desses itens, a migração pode ser executada sem modificar o banco atual até a etapa final.
