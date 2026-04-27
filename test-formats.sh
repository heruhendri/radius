#!/bin/bash
TOKEN=$(curl -s http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d @/tmp/login.json | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "TOKEN: ${TOKEN:0:20}..."

echo "--- /api/voucher-templates (Go direct port 8080) ---"
curl -s "http://127.0.0.1:8080/api/voucher-templates" -H "Authorization: Bearer $TOKEN" | head -c 500

echo ""
echo "--- /api/payment-gateway/config (Go direct port 8080) ---"
curl -s "http://127.0.0.1:8080/api/payment-gateway/config" -H "Authorization: Bearer $TOKEN" | head -c 500

echo ""
echo "--- /api/payment-gateway/webhook-logs (Go direct port 8080) ---"
curl -s "http://127.0.0.1:8080/api/payment-gateway/webhook-logs" -H "Authorization: Bearer $TOKEN" | head -c 500

echo ""
echo "--- /api/voucher-templates via nginx (with session cookie) ---"
curl -s "http://127.0.0.1/api/voucher-templates" -b /tmp/cookies.txt | head -c 500

echo ""
echo "--- /api/payment-gateway/config via nginx ---"
curl -s "http://127.0.0.1/api/payment-gateway/config" -b /tmp/cookies.txt | head -c 500

echo ""
echo "--- /api/payment-gateway/webhook-logs via nginx ---"
curl -s "http://127.0.0.1/api/payment-gateway/webhook-logs?limit=5" -b /tmp/cookies.txt | head -c 500
