#!/bin/bash

set -u

echo
echo "🍶 DEPLOY DO CARDÁPIO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

ERROS=0

if [ -f "wrangler.jsonc" ]; then
    echo "✓ wrangler.jsonc"
else
    echo "✗ wrangler.jsonc não encontrado"
    ERROS=$((ERROS + 1))
fi

if [ -d "public" ]; then
    echo "✓ public/"
else
    echo "✗ public/ não encontrado"
    ERROS=$((ERROS + 1))
fi

if [ -f "src/worker.js" ]; then
    echo "✓ src/worker.js"
else
    echo "✗ src/worker.js não encontrado"
    ERROS=$((ERROS + 1))
fi

if [ "$ERROS" -ne 0 ]; then
    echo
    echo "❌ Projeto incompleto: $ERROS item(ns) ausente(s)."
    echo "Deploy não executado."
    exit 1
fi

echo
echo "Validando autenticação Cloudflare..."

if npx wrangler whoami >/dev/null 2>&1; then
    echo "✓ Cloudflare autenticada"
else
    echo "✗ Cloudflare não autenticada"
    echo "Deploy não executado."
    exit 1
fi

echo
echo "Executando validação local do deploy..."

if npx wrangler deploy --dry-run; then
    echo
    echo "✓ Dry-run concluído com sucesso."
    echo "Nenhum arquivo foi publicado na Cloudflare."
else
    echo
    echo "✗ Dry-run falhou."
    echo "Deploy não executado."
    exit 1
fi

echo
echo "Dry-run aprovado. O projeto está pronto para publicação."
echo
printf "Publicar agora na Cloudflare? [s/N]: "
read -r CONFIRMAR_DEPLOY

case "$CONFIRMAR_DEPLOY" in
    s|S|sim|SIM|Sim)
        echo
        echo "Publicando na Cloudflare..."

        if npx wrangler deploy; then
            echo
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "✓ Deploy concluído com sucesso."
        else
            echo
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "✗ Falha no deploy."
            exit 1
        fi
        ;;
    *)
        echo
        echo "Publicação cancelada."
        echo "Nenhuma alteração foi enviada à Cloudflare."
        echo
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✓ Validação concluída sem publicação."
        ;;
esac
