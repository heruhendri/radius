#!/bin/bash
B="http://127.0.0.1"
C="-b /tmp/cookies.txt"
check() {
  local expected_key="$2"
  local result=$(curl -s "$B$1" $C | python3 -c "
import sys,json
d=json.load(sys.stdin)
if isinstance(d, dict):
  keys=list(d.keys())
  print('KEYS:', keys)
else:
  print('ARRAY len:', len(d))
")
  local status="FAIL"
  echo "$result" | grep -q "$expected_key" && status="OK"
  echo "[$status] $1 → $result"
}

check "/api/hotspot/profiles" "profiles"
check "/api/pppoe/users" "users"
check "/api/pppoe/profiles" "profiles"
check "/api/pppoe/areas" "areas"
check "/api/invoices" "invoices"
check "/api/sessions" "sessions"
check "/api/keuangan/transactions" "transactions"
check "/api/keuangan/categories" "categories"
