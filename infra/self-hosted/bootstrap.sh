#!/usr/bin/env bash
set -euo pipefail

# Bootstrap seguro do stack self-hosted.
# Não executa restore, não toca no banco gerenciado e não grava segredos no Git.

REF="${SUPABASE_SELF_HOSTED_REF:-self-hosted/v0.8.1}"
BASE="${SUPABASE_INSTALL_DIR:-/opt/vemplast-supabase}"

if [[ -e "${BASE}/.supabase-version" ]]; then
  echo "Instalação já existe em ${BASE}; não sobrescrevendo."
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone --depth 1 --branch "$REF" https://github.com/supabase/supabase "$tmp/supabase"
mkdir -p "$BASE"
cp -rf "$tmp/supabase/docker/." "$BASE/"
cp "$tmp/supabase/docker/.env.example" "$BASE/.env.example"
printf 'ref=%s\n' "$REF" > "$BASE/.supabase-version"

cd "$BASE"
if [[ ! -f .env ]]; then
  cp .env.example .env
fi

echo
echo "Configuração copiada para $BASE"
echo "IMPORTANTE: edite $BASE/.env localmente e gere todos os segredos antes de iniciar."
echo "Não execute restore de produção nesta etapa."
