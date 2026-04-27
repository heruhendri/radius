#!/bin/bash
# backend/deploy.sh
# Script untuk deploy Go backend ke VPS
# Jalankan dari root project: bash backend/deploy.sh

set -e

APP_DIR="${APP_DIR:-/var/www/salfanet-radius}"
BACKEND_DIR="$APP_DIR/backend"

echo "[1/3] Building Go backend (Linux amd64)..."
cd "$BACKEND_DIR"
mkdir -p bin
GOOS=linux GOARCH=amd64 go build -o bin/server ./cmd/server/...
echo "      Build OK: bin/server ($(du -sh bin/server | cut -f1))"

echo "[2/3] Restarting PM2 process..."
cd "$APP_DIR"
if pm2 describe salfanet-go > /dev/null 2>&1; then
    pm2 restart salfanet-go
else
    pm2 start production/ecosystem.config.js --only salfanet-go
fi

echo "[3/3] Checking Go backend health..."
sleep 2
curl -sf http://localhost:${GO_PORT:-8080}/api/health && echo " OK" || echo " WARN: health check failed (may need a moment to start)"

echo ""
echo "Done! Go backend running on port ${GO_PORT:-8080}"
echo "Logs: pm2 logs salfanet-go"
