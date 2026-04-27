#!/bin/bash
# Full test using NextAuth session cookie
BASE="http://127.0.0.1"

echo "=== Step 1: Get CSRF Token ==="
CSRF_RESPONSE=$(curl -s -c /tmp/cookies.txt "$BASE/api/auth/csrf")
echo "CSRF response: $CSRF_RESPONSE"
CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('csrfToken',''))" 2>/dev/null)
echo "CSRF Token: $CSRF_TOKEN"

echo ""
echo "=== Step 2: NextAuth Login ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Auth-Return-Redirect: 1" \
  -b /tmp/cookies.txt -c /tmp/cookies.txt \
  -d "csrfToken=$CSRF_TOKEN&username=superadmin&password=admin123&redirect=false&json=true" \
  -L -w "\nHTTP_CODE:%{http_code}")
echo "Login response: $LOGIN_RESPONSE"

echo ""
echo "=== Cookies after login ==="
cat /tmp/cookies.txt | grep -E "next-auth|session"

echo ""
echo "=== Step 3: Test Authenticated Endpoints ==="
test_auth() {
  local method=$1
  local url=$2
  local code=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE$url" \
    -b /tmp/cookies.txt \
    -H "Accept: application/json")
  echo "$method $url: $code"
}

# Test all pages that use Next.js routes (needs NextAuth session)
test_auth GET /api/hotspot/voucher
test_auth GET /api/hotspot/agents
test_auth GET /api/network/routers
test_auth GET /api/network/olts
test_auth GET /api/network/odps
test_auth GET /api/network/odcs
test_auth GET /api/invoices/counts
test_auth GET /api/permissions/role-templates
test_auth GET /api/hotspot/rekap-voucher
test_auth GET /api/sessions/export
test_auth GET /api/whatsapp/providers
test_auth GET /api/whatsapp/templates
test_auth GET /api/whatsapp/history
test_auth GET /api/admin/evoucher/orders

# Pages that use Go (already tested with JWT above)
test_auth GET /api/dashboard/stats
test_auth GET /api/admin/dashboard/stats
test_auth GET /api/pppoe/users
test_auth GET /api/pppoe/profiles
test_auth GET /api/pppoe/areas
test_auth GET /api/invoices
test_auth GET /api/manual-payments
test_auth GET /api/keuangan/transactions
test_auth GET /api/keuangan/categories
test_auth GET /api/admin/users
test_auth GET /api/permissions
test_auth GET /api/registrations
test_auth GET /api/admin/registrations
test_auth GET /api/activity-logs
test_auth GET /api/admin/activity-logs
test_auth GET /api/company
test_auth GET /api/admin/system/info
test_auth GET /api/notifications
test_auth GET /api/voucher-templates

echo ""
echo "=== Done ==="
