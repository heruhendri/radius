#!/bin/bash
B="http://127.0.0.1"
C="-b /tmp/cookies.txt"

echo "=== Checking response key formats ==="
echo ""
echo "--- /api/hotspot/profiles ---"
curl -s "$B/api/hotspot/profiles" $C | python3 -c "import sys,json; d=json.load(sys.stdin); print('KEYS:', list(d.keys()) if isinstance(d, dict) else 'ARRAY')"

echo ""
echo "--- /api/hotspot/voucher ---"  
curl -s "$B/api/hotspot/voucher" $C | python3 -c "import sys,json; d=json.load(sys.stdin); print('KEYS:', list(d.keys()) if isinstance(d, dict) else 'ARRAY')"

echo ""
echo "--- /api/pppoe/users ---"
curl -s "$B/api/pppoe/users" $C | python3 -c "import sys,json; d=json.load(sys.stdin); print('KEYS:', list(d.keys()) if isinstance(d, dict) else 'ARRAY')"

echo ""
echo "--- /api/pppoe/profiles ---"
curl -s "$B/api/pppoe/profiles" $C | python3 -c "import sys,json; d=json.load(sys.stdin); print('KEYS:', list(d.keys()) if isinstance(d, dict) else 'ARRAY')"

echo ""
echo "--- /api/pppoe/areas ---"
curl -s "$B/api/pppoe/areas" $C | python3 -c "import sys,json; d=json.load(sys.stdin); print('KEYS:', list(d.keys()) if isinstance(d, dict) else 'ARRAY')"

echo ""
echo "--- /api/network/routers ---"
curl -s "$B/api/network/routers" $C | python3 -c "import sys,json; d=json.load(sys.stdin); print('KEYS:', list(d.keys()) if isinstance(d, dict) else 'ARRAY')"

echo ""
echo "--- /api/network/olts ---"
curl -s "$B/api/network/olts" $C | python3 -c "import sys,json; d=json.load(sys.stdin); print('KEYS:', list(d.keys()) if isinstance(d, dict) else 'ARRAY')"

echo ""
echo "--- /api/network/odps ---"
curl -s "$B/api/network/odps" $C | python3 -c "import sys,json; d=json.load(sys.stdin); print('KEYS:', list(d.keys()) if isinstance(d, dict) else 'ARRAY')"

echo ""
echo "--- /api/invoices ---"
curl -s "$B/api/invoices" $C | python3 -c "import sys,json; d=json.load(sys.stdin); print('KEYS:', list(d.keys()) if isinstance(d, dict) else 'ARRAY')"

echo ""
echo "--- /api/sessions ---"
curl -s "$B/api/sessions" $C | python3 -c "import sys,json; d=json.load(sys.stdin); print('KEYS:', list(d.keys()) if isinstance(d, dict) else 'ARRAY')"

echo ""
echo "--- /api/manual-payments ---"
curl -s "$B/api/manual-payments" $C | python3 -c "import sys,json; d=json.load(sys.stdin); print('KEYS:', list(d.keys()) if isinstance(d, dict) else 'ARRAY')"
