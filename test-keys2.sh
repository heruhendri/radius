#!/bin/bash
B="http://127.0.0.1"
C="-b /tmp/cookies.txt"
check() {
  echo "--- $1 ---"
  curl -s "$B$1" $C | python3 -c "
import sys,json
d=json.load(sys.stdin)
if isinstance(d, dict):
  print('KEYS:', list(d.keys()))
else:
  print('ARRAY length:', len(d))
"
}
check "/api/keuangan/transactions"
check "/api/keuangan/categories"
check "/api/invoices"
check "/api/sessions"
check "/api/manual-payments"
