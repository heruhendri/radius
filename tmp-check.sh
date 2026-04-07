#!/bin/bash
DB="salfanet_radius"
U="salfanet_user"
P="salfanetradius123"

echo "=== DB TIME ==="
mysql -u$U -p$P $DB -e "SELECT CURDATE() as curdate, NOW() as now_time"

echo "=== EXPIRED BUT STILL ACTIVE USERS ==="
mysql -u$U -p$P $DB -e "SELECT username,status,subscriptionType,expiredAt,autoIsolationEnabled FROM pppoe_users WHERE status='active' AND expiredAt < NOW() ORDER BY expiredAt ASC LIMIT 20"

echo "=== ISOLATION SETTINGS ==="
mysql -u$U -p$P $DB -e "SELECT * FROM isolation_settings LIMIT 5" 2>/dev/null || echo "No isolation_settings table"
mysql -u$U -p$P $DB -e "SELECT * FROM app_settings WHERE \`key\` LIKE '%isol%' OR key_name LIKE '%isol%'" 2>/dev/null || echo "No app_settings match"

echo "=== CRON HISTORY (pppoe_auto_isolir last 10) ==="
mysql -u$U -p$P $DB -e "SELECT id,jobType,status,result,error,startedAt FROM cron_histories WHERE jobType LIKE '%isolir%' OR jobType LIKE '%isolat%' ORDER BY startedAt DESC LIMIT 10"

echo "=== PM2 CRON LOGS (last 30 relevant lines) ==="
pm2 logs salfanet-cron --lines 200 --nostream 2>&1 | grep -i 'isolir\|isolat\|expired\|grace' | tail -30
