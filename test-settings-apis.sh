#!/bin/bash
# Test settings/backup/cron/genieacs routes
B="http://127.0.0.1"
C="-b /tmp/cookies.txt"

echo "=== Settings/Backup/Cron/Genieacs Routes ==="
for url in \
  "/api/cron/status" \
  "/api/cron" \
  "/api/settings/isolation" \
  "/api/backup/history" \
  "/api/backup/health" \
  "/api/settings/genieacs" \
  "/api/settings/genieacs/devices" \
  "/api/genieacs/tasks" \
  "/api/admin/referrals/config" \
  "/api/settings/email/templates" \
  "/api/settings/genieacs/virtual-parameters" \
  "/api/settings/genieacs/parameter-display" \
  "/api/settings/restart-services" \
  "/api/upload/logo"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B$url" $C)
  echo "GET $url: $code"
done
