#!/bin/bash
# Deploy script for Quick Filler to production server
# Usage: ./scripts/deploy.sh [user@host]
#
# Architecture:
#   Internet → 200.158.242.69:5170 (Gateway SSL)
#            → 192.168.15.83:5173 (nginx frontend)
#            → backend:3001 (API)

set -e

SERVER=${1:-"root@192.168.15.83"}
APP_DIR="/opt/quick-filler-test"

echo "🚀 Iniciando deploy para $SERVER"
echo "   Gateway: 200.158.242.69:5170 → $SERVER:5173"

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
echo "🌐 Acesso externo: https://200.158.242.69 (via gateway porta 5170)"
echo "🌐 Acesso local: http://192.168.15.83:5173"
echo ""
echo "Credenciais de teste:"
echo "  Admin: admin@quickfiller.com / admin123"
echo "  User:  user@quickfiller.com / user123"
