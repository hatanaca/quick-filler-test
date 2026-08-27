#!/bin/bash
# Initialize Let's Encrypt certificates using DNS-01 challenge
# Usage: ./scripts/init-letsencrypt.sh [domain] [email]
#
# This script uses DNS-01 validation (no port 80 required).
# You will be prompted to add a TXT record to your DNS.

set -e

DOMAIN=${1:-thiagohatanaka.site}
EMAIL=${2:-admin@$DOMAIN}
STAGING=${3:-0}

echo "=== Let's Encrypt DNS-01 Setup ==="
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Create required directories
mkdir -p "./letsencrypt/etc/letsencrypt"

STAGING_ARG=""
if [ "$STAGING" != "0" ]; then
  STAGING_ARG="--staging"
  echo "Using STAGING environment (for testing)"
fi

echo "Requesting SSL certificate via DNS-01 challenge..."
echo ""
echo "You will be prompted to add a TXT record to your DNS."
echo "The record name will be: _acme-challenge.$DOMAIN"
echo ""

docker compose run --rm certbot certonly \
  --manual \
  --preferred-challenges dns \
  $STAGING_ARG \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo ""
echo "Certificate obtained! Reloading nginx..."
docker compose exec frontend nginx -s reload

echo ""
echo "=== SSL certificate ready ==="
echo "Access: https://$DOMAIN"
echo ""
echo "Auto-renewal: The certbot service renews automatically."
echo "Note: DNS-01 renewal requires adding the TXT record again."
echo "To test renewal: docker compose run --rm certbot renew --dry-run"
