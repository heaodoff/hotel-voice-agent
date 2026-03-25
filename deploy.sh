#!/bin/bash
set -euo pipefail

# === VPS Deploy Script for Hotel Voice Agent ===
# Run on the VPS after cloning the repo

echo "=== Hotel Voice Agent — Production Deploy ==="

# 1. Check Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "Docker installed."
fi

if ! docker compose version &> /dev/null; then
    echo "ERROR: docker compose not found. Install Docker Compose v2."
    exit 1
fi

echo "Docker: $(docker --version)"

# 2. Check .env.production
if [ ! -f .env.production ]; then
    echo "ERROR: .env.production not found!"
    echo "Copy .env.production.example to .env.production and fill in your values:"
    echo "  cp .env.production.example .env.production"
    echo "  nano .env.production"
    exit 1
fi

# 3. Source env for docker-compose variable substitution
set -a
source .env.production
set +a

# Validate required vars
for var in DOMAIN POSTGRES_PASSWORD TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN OPENAI_API_KEY; do
    if [ -z "${!var:-}" ]; then
        echo "ERROR: $var is not set in .env.production"
        exit 1
    fi
done

echo "Domain: $DOMAIN"
echo "Twilio: $TWILIO_PHONE_NUMBER"

# 4. Build and start
echo "Building containers..."
docker compose -f docker-compose.prod.yml build

echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d

# 5. Wait for DB
echo "Waiting for database..."
sleep 5

# 6. Run Prisma migrations
echo "Running database migrations..."
docker compose -f docker-compose.prod.yml exec app npx prisma db push --accept-data-loss

# 7. Health check
echo "Checking health..."
sleep 3
HEALTH=$(curl -sf http://localhost:3000/health 2>&1 || echo "FAIL")

if echo "$HEALTH" | grep -q '"ok"'; then
    echo ""
    echo "=== DEPLOY SUCCESSFUL ==="
    echo "App:    https://$DOMAIN/health"
    echo "Webhook: https://$DOMAIN/twilio/voice"
    echo ""
    echo "Next: Set Twilio webhook to https://$DOMAIN/twilio/voice"
else
    echo "ERROR: Health check failed. Check logs:"
    echo "  docker compose -f docker-compose.prod.yml logs app"
fi
