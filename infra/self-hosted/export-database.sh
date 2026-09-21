#!/usr/bin/env bash
set -euo pipefail

# Uso:
#   SOURCE_DB_URL='postgres://...' ./export-database.sh /secure/backup-dir
#
# Este script SOMENTE LÊ a origem. Ele não altera o banco.
# SOURCE_DB_URL nunca deve ser commitada.

OUT="${1:-./backup-$(date +%Y%m%d-%H%M%S)}"
: "${SOURCE_DB_URL:?Defina SOURCE_DB_URL com a connection string da origem}"

mkdir -p "$OUT"

echo "Exportando roles..."
supabase db dump --db-url "$SOURCE_DB_URL" -f "$OUT/roles.sql" --role-only

echo "Exportando schema..."
supabase db dump --db-url "$SOURCE_DB_URL" -f "$OUT/schema.sql"

echo "Exportando dados..."
supabase db dump --db-url "$SOURCE_DB_URL" -f "$OUT/data.sql" --use-copy --data-only

chmod 600 "$OUT"/*.sql

echo
echo "Backup lógico criado em: $OUT"
echo "Proteja esse diretório como dado sensível."
echo "Storage e Edge Functions são migrados separadamente."
