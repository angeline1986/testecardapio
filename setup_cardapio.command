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
echo "Verificando estrutura do template..."
echo

ESTRUTURA_ERROS=0

if [ -d "public" ]; then
    echo "✓ public/"
else
    echo "✗ public/ não encontrado"
    ESTRUTURA_ERROS=$((ESTRUTURA_ERROS + 1))
fi

if [ -f "src/worker.js" ]; then
    echo "✓ src/worker.js"
else
    echo "✗ src/worker.js não encontrado"
    ESTRUTURA_ERROS=$((ESTRUTURA_ERROS + 1))
fi

if [ "$ESTRUTURA_ERROS" -ne 0 ]; then
    echo
    echo "❌ Estrutura do template incompleta: $ESTRUTURA_ERROS item(ns) ausente(s)."
    echo "Nenhuma configuração foi criada ou alterada."
    exit 1
fi

echo
echo "Verificando projeto..."

if [ ! -f "wrangler.jsonc" ]; then
    echo "○ Projeto ainda não configurado."
    echo

    while true; do
        printf "Nome do projeto/Worker: "
        read -r WORKER_NAME

        if [ -z "$WORKER_NAME" ]; then
            echo "✗ O nome não pode ficar vazio."
            continue
        fi

        if ! printf '%s' "$WORKER_NAME" | grep -Eq '^[a-z0-9]+([a-z0-9-]*[a-z0-9])?$'; then
            echo "✗ Use somente letras minúsculas, números e hífen."
            echo "  Exemplo: cardapio-restaurante-x"
            continue
        fi

        break
    done

    DATASET_NAME="$(printf '%s' "$WORKER_NAME" | tr '-' '_')_events"

    echo
    echo "Configuração proposta:"
    echo
    echo "  Worker:    $WORKER_NAME"
    echo "  Analytics: $DATASET_NAME"
    echo

    printf "Criar wrangler.jsonc com essa configuração? [s/N]: "
    read -r CONFIRMAR

    case "$CONFIRMAR" in
        s|S|sim|SIM|Sim)
            COMPATIBILITY_DATE="$(date +%Y-%m-%d)"

            if cat > wrangler.jsonc <<WRANGLER_EOF
{
  "\$schema": "node_modules/wrangler/config-schema.json",
  "name": "$WORKER_NAME",
  "main": "src/worker.js",
  "compatibility_date": "$COMPATIBILITY_DATE",
  "assets": {
    "directory": "./public",
    "binding": "ASSETS"
  },
  "analytics_engine_datasets": [
    {
      "binding": "ANALYTICS",
      "dataset": "$DATASET_NAME"
    }
  ]
}
WRANGLER_EOF
            then
                echo
                echo "✓ wrangler.jsonc criado"
                echo "✓ Worker: $WORKER_NAME"
                echo "✓ Analytics: $DATASET_NAME"
            else
                echo
                echo "✗ Falha ao criar wrangler.jsonc"
                rm -f wrangler.jsonc
                exit 1
            fi
            ;;
        *)
            echo
            echo "○ Configuração cancelada."
            echo "Nenhum arquivo foi alterado."
            ;;
    esac
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

if [ -x "./deploy.command" ]; then
    echo
    printf "Executar validação/publicação do cardápio agora? [s/N]: "
    read -r EXECUTAR_DEPLOY

    case "$EXECUTAR_DEPLOY" in
        s|S|sim|SIM|Sim)
            echo
            ./deploy.command
            DEPLOY_STATUS=$?

            if [ "$DEPLOY_STATUS" -ne 0 ]; then
                echo
                echo "✗ O fluxo de deploy terminou com erro."
                exit "$DEPLOY_STATUS"
            fi
            ;;
        *)
            echo
            echo "Deploy não iniciado."
            echo "Quando quiser publicar, execute: ./deploy.command"
            ;;
    esac
else
    echo
    echo "○ deploy.command não encontrado ou não executável."
    echo "  A configuração foi concluída, mas o deploy não foi iniciado."
fi
echo
