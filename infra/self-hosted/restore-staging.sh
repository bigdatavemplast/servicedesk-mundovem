#!/usr/bin/env bash
set -euo pipefail

# Uso:
#   DEST_DB_URL='postgres://...' ./restore-staging.sh ./backup-dir
#
# Execute APENAS em uma instância self-hosted de homologação.
# Nunca aponte DEST_DB_URL para a produção gerenciada.

BACKUP_DIR="${1:?Informe o diretório do backup}"
: "${DEST_DB_URL:?Defina DEST_DB_URL para o Postgres self-hosted de homologação}"

for f in roles.sql schema.sql data.sql; do
  test -s "$BACKUP_DIR/$f" || { echo "Arquivo ausente: $BACKUP_DIR/$f" >&2; exit 1; }
done

echo "Restaurando em destino de homologação..."
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$BACKUP_DIR/roles.sql" \
  --file "$BACKUP_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$BACKUP_DIR/data.sql" \
  --dbname "$DEST_DB_URL"

echo "Validando auth.users..."
psql "$DEST_DB_URL" -Atc 'select count(*) from auth.users;'

echo "Restore concluído. Faça os testes funcionais antes do cutover."
