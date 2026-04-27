#!/bin/bash
# Test additional routes
TOKEN=$(curl -s -c /tmp/cookies2.txt http://127.0.0.1/api/auth/csrf | python3 -c "import sys,json; print(json.load(sys.stdin).get('csrfToken',''))")
curl -s -X POST "http://127.0.0.1/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Auth-Return-Redirect: 1" \
  -b /tmp/cookies2.txt -c /tmp/cookies2.txt \
  -d "csrfToken=$TOKEN&username=superadmin&password=admin123&redirect=false&json=true" > /dev/null

echo "=== Testing POST/PUT endpoints ==="

test_post() {
  local url=$1
  local data=$2
  local code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1$url" \
    -b /tmp/cookies2.txt \
    -H "Content-Type: application/json" \
    -d "$data")
  echo "POST $url: $code"
}

test_put() {
  local url=$1
  local data=$2
  local code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "http://127.0.0.1$url" \
    -b /tmp/cookies2.txt \
    -H "Content-Type: application/json" \
    -d "$data")
  echo "PUT $url: $code"
}

test_get_params() {
  local url=$1
  local code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1$url" \
    -b /tmp/cookies2.txt)
  echo "GET $url: $code"
}

# PPPoE user status change (PUT)
test_put "/api/pppoe/users/status" '{"userId":"test","status":"ACTIVE"}'
test_put "/api/pppoe/users/bulk-status" '{"ids":[],"status":"ACTIVE"}'

# Sessions
test_post "/api/sessions/disconnect" '{"username":"test","router":"test"}'
test_post "/api/sessions/sync" '{"type":"pppoe"}'

# Hotspot voucher operations
test_post "/api/hotspot/voucher/delete-expired" '{}'
test_post "/api/hotspot/voucher/delete-multiple" '{"ids":[]}'

# Invoices with required params
test_get_params "/api/invoices/counts?userIds=test1,test2"

# Network router operations
test_post "/api/network/routers/test" '{"host":"192.168.1.1","port":8728,"username":"admin","password":"admin"}'
test_post "/api/network/routers/status" '{"id":"test"}'

# PPPoE profiles sync
test_post "/api/pppoe/profiles/sync-radius" '{}'
test_get_params "/api/pppoe/profiles/sync-mikrotik"

# Check pages that might have issues
echo ""
echo "=== Testing Settings pages ==="
test_get_params "/api/settings/email"
test_get_params "/api/settings/general"
test_get_params "/api/settings/database"
test_get_params "/api/cron/jobs"
test_get_params "/api/genieacs/status"
test_get_params "/api/reports/revenue"
test_get_params "/api/reports/customers"

echo ""
echo "=== Testing Upload routes ==="
test_get_params "/api/upload/pppoe-customer"

echo ""
echo "=== Testing SSE routes ==="
test_get_params "/api/sse/voucher-updates"

echo ""
echo "=== Done ==="
