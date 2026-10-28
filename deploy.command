#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🍶 Deploy do cardápio Chef Dani Teles"
echo "Projeto: $PROJECT_DIR"

for path in wrangler.jsonc src/worker.js public/index.html public/style.css public/script.js public/products.json; do
  if [ ! -f "$path" ]; then
    echo "Arquivo necessário ausente: $path" >&2
    exit 1
  fi
done

if [ ! -d public/assets/chef-dani ]; then
  echo "Pasta de imagens ausente: public/assets/chef-dani" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Node.js/npm não encontrado. Instale o Node.js antes de publicar." >&2
  exit 1
fi

echo
echo "Verificando autenticação da Cloudflare..."
if ! npx --yes wrangler whoami >/dev/null; then
  echo "Cloudflare não autenticada. Execute: npx wrangler login" >&2
  exit 1
fi

echo
echo "Validando o Worker e os arquivos estáticos..."
npx --yes wrangler deploy --config wrangler.jsonc --dry-run

echo
echo "Publicando no serviço testecardapio..."
npx --yes wrangler deploy --config wrangler.jsonc

echo
echo "✓ Deploy concluído."
