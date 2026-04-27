#!/bin/bash
# Get auth token
TOKEN=$(curl -s -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"admin123"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))")

echo "TOKEN: $TOKEN"

if [ -z "$TOKEN" ]; then
  echo "Login failed! Raw response:"
  curl -s -X POST http://127.0.0.1:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"superadmin","password":"admin123"}'
  exit 1
fi

AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "=== Testing All Admin API Endpoints ==="
echo ""

test_route() {
  local method=$1
  local url=$2
  local code=$(curl -s -o /dev/null -w "%{http_code}" -X $method "http://127.0.0.1$url" -H "$AUTH")
  echo "$method $url: $code"
}

# Dashboard
test_route GET /api/dashboard/stats
test_route GET /api/admin/dashboard/stats

# PPPoE
test_route GET /api/pppoe/users
test_route GET /api/pppoe/profiles
test_route GET /api/pppoe/areas

# Hotspot
test_route GET /api/hotspot/voucher
test_route GET /api/hotspot/profiles
test_route GET /api/hotspot/agents

# Network
test_route GET /api/network/routers
test_route GET /api/network/olts
test_route GET /api/network/odps
test_route GET /api/network/odcs

# Sessions
test_route GET /api/sessions

# Invoices
test_route GET /api/invoices
test_route GET /api/invoices/counts

# Manual Payments
test_route GET /api/manual-payments

# Keuangan
test_route GET /api/keuangan/transactions
test_route GET /api/keuangan/categories

# Registrations
test_route GET /api/registrations
test_route GET /api/admin/registrations

# Users/Management
test_route GET /api/admin/users
test_route GET /api/permissions
test_route GET /api/permissions/role-templates

# Company & Settings
test_route GET /api/company
test_route GET /api/admin/system/info

# Voucher templates
test_route GET /api/voucher-templates

# Notifications
test_route GET /api/notifications

# WhatsApp
test_route GET /api/whatsapp/status

# Activity logs
test_route GET /api/activity-logs
test_route GET /api/admin/activity-logs

# PPPoE extras
test_route GET /api/pppoe/users/status
test_route GET /api/pppoe/profiles/sync-mikrotik

# Hotspot extras
test_route GET /api/hotspot/voucher/bulk
test_route GET /api/hotspot/rekap-voucher
test_route GET /api/hotspot/evoucher

# Public
test_route GET /api/public/company

# Reports / exports
test_route GET /api/sessions/export

echo ""
echo "=== Done ==="
