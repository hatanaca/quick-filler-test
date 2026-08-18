#!/bin/bash
# Deploy script for Quick Filler to production server
# Usage: ./scripts/deploy.sh user@host
#
# Required environment variables:
#   DEPLOY_SERVER - SSH target (e.g., user@host)
#
# Architecture:
#   Internet → <gateway-ip>:5170 (Gateway SSL)
#            → <server-ip>:5173 (nginx frontend)
#            → backend:3001 (API)

set -e

SERVER=${1:-$DEPLOY_SERVER}
if [ -z "$SERVER" ]; then
  echo "❌ Error: Deploy server not specified."
  echo "Usage: ./scripts/deploy.sh user@host"
  echo "Or set DEPLOY_SERVER environment variable."
  exit 1
fi

APP_DIR="/opt/quick-filler-test"

echo "🚀 Iniciando deploy para $SERVER"

# Build locally first to verify
echo "📦 Building locally..."
docker compose build

echo "📤 Copiando arquivos para o servidor..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'uploads' \
  --exclude 'coverage' \
  --exclude 'output' \
  . "$SERVER:$APP_DIR"

echo "🔧 Configurando no servidor..."
ssh "$SERVER" << 'EOF'
cd /opt/quick-filler-test

# Generate JWT_SECRET if not exists
if [ ! -f .env ] || ! grep -q "JWT_SECRET=" .env; then
  echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
  echo "✅ JWT_SECRET gerado"
fi

# Build and deploy
docker compose build
docker compose up -d

# Wait for health check
echo "⏳ Aguardando backend ficar saudável..."
for i in {1..30}; do
  if docker compose exec backend wget -qO- http://127.0.0.1:3001/healthz > /dev/null 2>&1; then
    echo "✅ Backend está saudável!"
    break
  fi
  sleep 2
done

# Show status
docker compose ps

# Check port 5173
echo ""
echo "🔍 Verificando porta 5173..."
if ss -tlnp | grep -q ":5173"; then
  echo "✅ Porta 5173 está ativa"
else
  echo "⚠️  Porta 5173 não está escutando"
fi
EOF

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Verificar .env no servidor com as credenciais corretas"
echo "   2. Acessar via gateway na porta 5170"
echo "   3. Credenciais estão no .env do servidor (ADMIN_EMAIL, ADMIN_PASSWORD)"
