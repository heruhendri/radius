#!/bin/bash
B="http://127.0.0.1"
C="-b /tmp/cookies.txt"  # admin session for testing

echo "=== Agent Portal Routes ==="
for url in \
  "/api/public/company" \
  "/api/agent/login" \
  "/api/company/info" \
  "/api/agent/sessions" \
  "/api/tickets/categories" \
  "/api/agent/tickets"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B$url" $C)
  echo "GET $url: $code"
done

echo ""
echo "=== Customer Portal Routes ==="
for url in \
  "/api/public/payment-gateways" \
  "/api/customer/me" \
  "/api/customer/invoices" \
  "/api/customer/wifi" \
  "/api/customer/payment-history" \
  "/api/customer/payments" \
  "/api/customer/auth/login" \
  "/api/customer/auth/send-otp"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B$url" $C)
  echo "GET $url: $code"
done

echo ""
echo "=== Technician Portal Routes ==="
for url in \
  "/api/technician/auth/login" \
  "/api/technician/offline" \
  "/api/technician/monitor" \
  "/api/technician/profile" \
  "/api/technician/tickets" \
  "/api/technician/isolated" \
  "/api/technician/form-data" \
  "/api/technician/genieacs/devices" \
  "/api/technician/genieacs"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B$url" $C)
  echo "GET $url: $code"
done
