#!/bin/bash
# Test all remaining admin page API routes
B="http://127.0.0.1"
C="-b /tmp/cookies.txt"

echo "=== Testing Remaining Admin API Endpoints ==="

for url in \
  "/api/admin/isolated-users" \
  "/api/admin/laporan" \
  "/api/payment-gateway/config" \
  "/api/payment-gateway/webhook-logs" \
  "/api/admin/referrals" \
  "/api/admin/suspend-requests?status=PENDING&limit=10" \
  "/api/admin/technicians" \
  "/api/tickets/stats" \
  "/api/tickets?limit=10" \
  "/api/tickets/dispatch-data?customerSearch=test" \
  "/api/admin/topup-requests" \
  "/api/public/company" \
  "/api/push/send?action=stats"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B$url" $C)
  echo "GET $url: $code"
done

echo ""
echo "=== Testing Logs/Freeradius pages ==="
for url in \
  "/api/admin/activity-logs" \
  "/api/freeradius/config" \
  "/api/freeradius/status" \
  "/api/inventory" \
  "/api/admin/collections"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B$url" $C)
  echo "GET $url: $code"
done
