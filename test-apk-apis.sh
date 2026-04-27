#!/bin/bash
B="http://127.0.0.1"
C="-b /tmp/cookies.txt"

echo "=== APK & Remaining Routes ==="
for url in \
  "/api/admin/apk/status?role=admin" \
  "/api/admin/apk/trigger" \
  "/api/hotspot/voucher/bulk?type=template"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B$url" $C)
  echo "GET $url: $code"
done
