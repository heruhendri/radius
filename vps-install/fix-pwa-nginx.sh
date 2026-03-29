#!/bin/bash
# ============================================================================
# SALFANET RADIUS — Post-Install Fix Script
# ============================================================================
# Fixes issues on VPS that was installed with an older installer:
#   1. Copy public/ and .next/static/ into .next/standalone/ (PWA manifest 404)
#   2. Update nginx config to add /api/ no-cache + manifest/sw.js locations
#   3. Reload nginx + restart app
#
# Usage:
#   bash vps-install/fix-pwa-nginx.sh
# or from VPS directly:
#   bash /var/www/salfanet-radius/vps-install/fix-pwa-nginx.sh
# ============================================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/salfanet-radius}"
NGINX_CONF="/etc/nginx/sites-available/salfanet-radius"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
print_success() { echo -e "${GREEN}[OK]${NC}   $*"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
print_error()   { echo -e "${RED}[ERR]${NC}  $*"; }
print_step()    { echo -e "\n${GREEN}==> $*${NC}"; }

# ---------------------------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root: sudo bash $0"
    exit 1
fi

if [ ! -d "$APP_DIR" ]; then
    print_error "App directory not found: $APP_DIR"
    exit 1
fi

# ---------------------------------------------------------------------------
# STEP 1: Copy standalone assets
# ---------------------------------------------------------------------------
print_step "Step 1: Copy public/ and .next/static/ into standalone bundle"

cd "$APP_DIR"

if [ ! -d ".next/standalone" ]; then
    print_warning ".next/standalone not found — app may not have been built yet."
    print_warning "Run: cd $APP_DIR && npm run build, then re-run this script."
    exit 1
fi

# public/ → .next/standalone/public/
if [ -d "public" ]; then
    cp -r public .next/standalone/public/
    print_success "public/ → .next/standalone/public/"
else
    print_warning "public/ directory not found, skipping"
fi

# .next/static/ → .next/standalone/.next/static/
if [ -d ".next/static" ]; then
    mkdir -p .next/standalone/.next
    cp -r .next/static .next/standalone/.next/static/
    print_success ".next/static/ → .next/standalone/.next/static/"
else
    print_warning ".next/static/ not found, skipping"
fi

# ---------------------------------------------------------------------------
# STEP 2: Add ENCRYPTION_KEY to standalone .env if missing
# ---------------------------------------------------------------------------
print_step "Step 2: Ensure ENCRYPTION_KEY in standalone .env"

if [ -f ".next/standalone/.env" ]; then
    if ! grep -q "^ENCRYPTION_KEY=" .next/standalone/.env; then
        if grep -q "^ENCRYPTION_KEY=" "$APP_DIR/.env" 2>/dev/null; then
            # Copy from root .env
            ENC_KEY=$(grep "^ENCRYPTION_KEY=" "$APP_DIR/.env" | cut -d= -f2-)
            echo "ENCRYPTION_KEY=$ENC_KEY" >> .next/standalone/.env
            print_success "ENCRYPTION_KEY copied from .env → standalone/.env"
        else
            # Generate new one and save to both
            NEW_KEY=$(openssl rand -hex 16)
            echo "ENCRYPTION_KEY=$NEW_KEY" >> .next/standalone/.env
            echo "ENCRYPTION_KEY=$NEW_KEY" >> "$APP_DIR/.env"
            print_success "ENCRYPTION_KEY generated and saved: $NEW_KEY"
        fi
    else
        print_success "ENCRYPTION_KEY already present in standalone/.env"
    fi
else
    print_warning ".next/standalone/.env not found"
fi

# ---------------------------------------------------------------------------
# STEP 3: Update nginx config
# ---------------------------------------------------------------------------
print_step "Step 3: Update nginx config (add manifest, sw.js, /api/ locations)"

if [ ! -f "$NGINX_CONF" ]; then
    print_warning "Nginx config not found at $NGINX_CONF — skipping nginx update"
else
    # Backup original config
    cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%Y%m%d%H%M%S)"
    print_info "Nginx config backed up"

    CHANGED=0

    # --- Fix 1: Add manifest+sw.js+/api/ locations if not already present ---
    # We inject these blocks before the first "location /" in the config
    # using Python3 for safe multi-line manipulation

    python3 - <<'PYEOF'
import re, sys

CONF_PATH = "/etc/nginx/sites-available/salfanet-radius"

with open(CONF_PATH, "r") as f:
    content = f.read()

original = content

# Blocks to inject (before first "location /")
MANIFEST_BLOCK = '''
    # PWA manifest files — serve directly (standalone build)
    location ~* ^/manifest(-admin|-agent|-customer|-technician)?\\.json$ {
        root /var/www/salfanet-radius/.next/standalone/public;
        try_files $uri @nextjs_fallback;
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
        add_header Content-Type "application/manifest+json";
    }

    # Service worker — no cache
    location = /sw.js {
        root /var/www/salfanet-radius/.next/standalone/public;
        try_files $uri @nextjs_fallback;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        add_header Content-Type "application/javascript";
    }

    location @nextjs_fallback {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # API routes — no cache, no HTML error pages
    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   CF-Connecting-IP $http_cf_connecting_ip;

        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;

        proxy_hide_header X-Frame-Options;
        proxy_hide_header X-XSS-Protection;
        proxy_hide_header X-Content-Type-Options;
    }
'''

# Only inject if manifest block not already present
if 'manifest(-admin' not in content:
    # Find the first "location /" (a standalone location block, not location /something/)
    # Pattern: "    location / {" possibly with whitespace
    pattern = r'(\n[ \t]+location\s+\/\s*\{)'
    match = re.search(pattern, content)
    if match:
        insert_pos = match.start()
        content = content[:insert_pos] + MANIFEST_BLOCK + content[insert_pos:]
        print("  Manifest/sw.js/api blocks injected")
    else:
        print("  WARNING: Could not find 'location /' to inject before — manual edit needed")
else:
    print("  Manifest block already present — skipping injection")

# Fix: remove duplicate CF-Connecting-IP headers (two consecutive identical lines)
content = re.sub(
    r'(proxy_set_header\s+CF-Connecting-IP\s+\$http_cf_connecting_ip;\n)'
    r'\s*proxy_set_header\s+CF-Connecting-IP\s+\$http_cf_connecting_ip;\n',
    r'\1',
    content
)

if content != original:
    with open(CONF_PATH, "w") as f:
        f.write(content)
    print("  Nginx config updated")
else:
    print("  No changes needed")
PYEOF

    # Test nginx config
    if nginx -t 2>/dev/null; then
        print_success "Nginx config valid"
        CHANGED=1
    else
        print_error "Nginx config test failed! Restoring backup..."
        LATEST_BAK=$(ls -t "${NGINX_CONF}.bak."* | head -1)
        cp "$LATEST_BAK" "$NGINX_CONF"
        print_warning "Backup restored: $LATEST_BAK"
        print_warning "Run 'nginx -t' and 'nginx -T' to debug manually"
    fi
fi

# ---------------------------------------------------------------------------
# STEP 4: Reload nginx
# ---------------------------------------------------------------------------
print_step "Step 4: Reload nginx"

if nginx -t 2>/dev/null; then
    systemctl reload nginx && print_success "Nginx reloaded" || print_warning "Nginx reload failed, trying restart..."
    # Try restart if reload fails
    nginx -t && systemctl rotate nginx 2>/dev/null || systemctl restart nginx 2>/dev/null && print_success "Nginx restarted" || print_error "Nginx restart failed!"
else
    print_warning "Nginx config invalid — skipping reload (fix manually)"
fi

# ---------------------------------------------------------------------------
# STEP 5: Restart app to pick up any env changes
# ---------------------------------------------------------------------------
print_step "Step 5: Restart application"

APP_USER=$(stat -c '%U' "$APP_DIR" 2>/dev/null || echo root)

if command -v pm2 >/dev/null 2>&1; then
    if pm2 list 2>/dev/null | grep -q "salfanet-radius"; then
        pm2 restart salfanet-radius --update-env 2>/dev/null && print_success "App restarted (root pm2)" || true
    fi
fi

# Also try as app user if different from root
if [ "$APP_USER" != "root" ] && id "$APP_USER" &>/dev/null; then
    sudo su - "$APP_USER" -c 'pm2 restart salfanet-radius --update-env 2>/dev/null || true' && \
        print_success "App restarted as $APP_USER" || true
fi

# ---------------------------------------------------------------------------
print_step "Done!"
echo ""
print_info "What was fixed:"
echo "  1. public/ and .next/static/ copied into .next/standalone/ (PWA manifests)"
echo "  2. ENCRYPTION_KEY ensured in standalone .env (GenieACS save fix)"
echo "  3. Nginx config updated: manifest/*.json, sw.js, /api/ no-cache blocks"
echo "  4. Nginx reloaded, app restarted"
echo ""
print_info "Test:"
echo "  curl -I http://\$(hostname -I | awk '{print \$1}')/manifest-admin.json"
echo "  curl -s http://\$(hostname -I | awk '{print \$1}')/api/health | head -c 100"
