#!/bin/bash
B="http://127.0.0.1"
C="-b /tmp/cookies.txt"

echo "=== Freeradius & Inventory Routes ==="
for url in \
  "/api/freeradius/config/list" \
  "/api/freeradius/config/read" \
  "/api/freeradius/status" \
  "/api/freeradius/logs" \
  "/api/freeradius/radcheck" \
  "/api/freeradius/radtest" \
  "/api/inventory/items" \
  "/api/inventory/categories" \
  "/api/inventory/suppliers" \
  "/api/inventory/movements" \
  "/api/admin/system/freeradius-backup"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B$url" $C)
  echo "GET $url: $code"
done
