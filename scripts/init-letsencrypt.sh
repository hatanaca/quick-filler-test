#!/bin/bash
# Initialize Let's Encrypt certificates for the Quick Filler application
# Usage: ./scripts/init-letsencrypt.sh your-domain.com your-email@example.com

set -e

DOMAIN=${1:-localhost}
EMAIL=${2:-admin@$DOMAIN}
STAGING=${3:-0}  # Set to 1 for testing with staging environment

echo "🔐 Initializing Let's Encrypt for domain: $DOMAIN"

# Create required directories
mkdir -p "./letsencrypt/etc/live/$DOMAIN"

# Create dummy certificates for initial nginx startup
echo "📝 Creating dummy certificates..."
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:4096 \
    -days 1 \
    -keyout '/etc/letsencrypt/live/$DOMAIN/privkey.pem' \
    -out '/etc/letsencrypt/live/$DOMAIN/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "🔄 Starting nginx..."
docker compose up -d nginx

echo "⏳ Waiting for nginx to start..."
sleep 5

# Delete dummy certificates
echo "🗑️  Deleting dummy certificates..."
docker compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

# Request real certificates
echo "📜 Requesting real certificates..."
STAGING_ARG=""
if [ "$STAGING" != "0" ]; then
  STAGING_ARG="--staging"
fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN" certbot

echo "🔄 Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "✅ Let's Encrypt certificates initialized successfully!"
echo ""
echo "Certificates will auto-renew. To test renewal:"
echo "  docker compose run --rm certbot renew --dry-run"
