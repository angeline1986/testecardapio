#!/bin/bash

set -u

echo
echo "🍶 CONFIGURAÇÃO DO CARDÁPIO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

ERROS=0

verificar_comando() {
    local comando="$1"
    local nome="$2"

    if command -v "$comando" >/dev/null 2>&1; then
        echo "✓ $nome"
    else
        echo "✗ $nome não encontrado"
        ERROS=$((ERROS + 1))
    fi
}

echo "Verificando ambiente..."
echo

verificar_comando node "Node.js"
verificar_comando npm "npm"
verificar_comando git "Git"
verificar_comando npx "npx"

echo

if [ "$ERROS" -ne 0 ]; then
    echo "❌ Ambiente incompleto: $ERROS requisito(s) ausente(s)."
    exit 1
fi

echo "Verificando Wrangler..."

if npx wrangler --version >/dev/null 2>&1; then
    WRANGLER_VERSION="$(npx wrangler --version 2>/dev/null | tail -n 1)"
    echo "✓ Wrangler $WRANGLER_VERSION"
else
    echo "✗ Wrangler não está disponível."
    exit 1
fi

echo
echo "Verificando autenticação Cloudflare..."

if npx wrangler whoami >/dev/null 2>&1; then
    echo "✓ Cloudflare autenticada"
else
    echo "✗ Cloudflare não autenticada"
    echo
    echo "Execute:"
    echo "  npx wrangler login"
    exit 1
fi

echo
echo "Verificando projeto..."

if [ ! -f "wrangler.jsonc" ]; then
    echo "○ Projeto ainda não configurado."
else
    WORKER_NAME="$(
        node -e "
            const fs = require('fs');
            const c = fs.readFileSync('wrangler.jsonc', 'utf8');
            const m = c.match(/\"name\"\\s*:\\s*\"([^\"]+)\"/);
            if (m) process.stdout.write(m[1]);
        "
    )"

    DATASET_NAME="$(
        node -e "
            const fs = require('fs');
            const c = fs.readFileSync('wrangler.jsonc', 'utf8');
            const m = c.match(/\"dataset\"\\s*:\\s*\"([^\"]+)\"/);
            if (m) process.stdout.write(m[1]);
        "
    )"

    if [ -n "$WORKER_NAME" ]; then
        echo "✓ Worker: $WORKER_NAME"
    else
        echo "✗ Nome do Worker não encontrado em wrangler.jsonc"
        exit 1
    fi

    if [ -n "$DATASET_NAME" ]; then
        echo "✓ Analytics: $DATASET_NAME"
    else
        echo "✗ Dataset do Analytics não encontrado em wrangler.jsonc"
        exit 1
    fi

    echo "✓ Projeto já configurado"
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Ambiente pronto para configurar o cardápio."
echo
