#!/bin/bash
# ============================================================================
# SALFANET RADIUS VPS Installer - Redis Module
# ============================================================================
# Step 8 (Opsional): Install & konfigurasi Redis untuk caching dan performa
#
# Fungsi Redis dalam Salfanet Radius:
#   - Cache RADIUS auth (PPPoE login lebih cepat, 60s TTL)
#   - Dashboard stats cache (30s TTL, kurangi query DB berat)
#   - Online user tracking real-time (Redis Set, fallback MySQL)
#   - Rate limiting terdistribusi (API protection)
#   - Distributed lock untuk cron job (mencegah double-run)
#
# Usage (standalone):
#   bash install-redis.sh               # Install + konfigurasi
#   bash install-redis.sh --skip-env    # Install tanpa update .env
#   bash install-redis.sh --status      # Cek status saja
#   bash install-redis.sh --uninstall   # Hapus Redis
# ============================================================================

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# ============================================================================
# REDIS INSTALLATION
# ============================================================================

install_redis_server() {
    print_info "Installing Redis server..."

    # Cek apakah sudah terinstall
    if command -v redis-server &>/dev/null; then
        local REDIS_VER
        REDIS_VER=$(redis-server --version | awk '{print $3}' | tr -d 'v')
        print_success "Redis sudah terinstall: v${REDIS_VER}"
        return 0
    fi

    # Update & install
    apt-get update -qq
    apt-get install -y redis-server redis-tools

    print_success "Redis terinstall: $(redis-server --version | awk '{print $3}')"
}

# ============================================================================
# REDIS CONFIGURATION
# ============================================================================

configure_redis() {
    print_info "Configuring Redis for production..."

    local CONF="/etc/redis/redis.conf"
    local CONF_BAK="/etc/redis/redis.conf.bak"

    # Backup config asli (hanya sekali)
    if [ ! -f "$CONF_BAK" ]; then
        cp "$CONF" "$CONF_BAK"
        print_info "Config asli dibackup ke: $CONF_BAK"
    fi

    # Hitung maxmemory berdasarkan RAM tersedia
    local TOTAL_MEM_MB
    TOTAL_MEM_MB=$(free -m | awk 'NR==2{print $2}')
    local REDIS_MAX_MB=128
    if   [ "$TOTAL_MEM_MB" -ge 8000 ]; then REDIS_MAX_MB=1024
    elif [ "$TOTAL_MEM_MB" -ge 4000 ]; then REDIS_MAX_MB=512
    elif [ "$TOTAL_MEM_MB" -ge 2000 ]; then REDIS_MAX_MB=256
    elif [ "$TOTAL_MEM_MB" -ge 1000 ]; then REDIS_MAX_MB=128
    else                                     REDIS_MAX_MB=64
    fi
    print_info "RAM: ${TOTAL_MEM_MB}MB → maxmemory Redis: ${REDIS_MAX_MB}mb"

    # Bind hanya ke localhost (keamanan — jangan expose ke luar)
    sed -i 's/^bind .*/bind 127.0.0.1 -::1/' "$CONF"

    # Non-aktifkan protected mode (sudah aman karena bind localhost)
    sed -i 's/^protected-mode yes/protected-mode no/' "$CONF"

    # Aktifkan maxmemory
    if grep -q "^maxmemory " "$CONF"; then
        sed -i "s/^maxmemory .*/maxmemory ${REDIS_MAX_MB}mb/" "$CONF"
    else
        sed -i "s/^# maxmemory .*/maxmemory ${REDIS_MAX_MB}mb/" "$CONF"
        # Jika baris commented tidak ada, tambahkan di akhir
        if ! grep -q "^maxmemory " "$CONF"; then
            echo "" >> "$CONF"
            echo "maxmemory ${REDIS_MAX_MB}mb" >> "$CONF"
        fi
    fi

    # Aktifkan maxmemory-policy: allkeys-lru (hapus key terlama saat penuh)
    if grep -q "^maxmemory-policy " "$CONF"; then
        sed -i 's/^maxmemory-policy .*/maxmemory-policy allkeys-lru/' "$CONF"
    else
        sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' "$CONF"
        if ! grep -q "^maxmemory-policy " "$CONF"; then
            echo "maxmemory-policy allkeys-lru" >> "$CONF"
        fi
    fi

    # Aktifkan persistence (AOF) untuk durabilitas saat restart
    sed -i 's/^appendonly no/appendonly yes/' "$CONF"

    # Logfile
    if ! grep -q "^logfile " "$CONF"; then
        echo "logfile /var/log/redis/redis-server.log" >> "$CONF"
    fi

    print_success "Redis dikonfigurasi (maxmemory: ${REDIS_MAX_MB}mb, policy: allkeys-lru)"
}

# ============================================================================
# ENABLE & START
# ============================================================================

enable_redis_service() {
    print_info "Enabling and starting Redis service..."

    systemctl enable redis-server
    systemctl restart redis-server

    # Tunggu Redis siap
    local RETRY=0
    local MAX_RETRY=10
    while [ $RETRY -lt $MAX_RETRY ]; do
        if redis-cli ping 2>/dev/null | grep -q "PONG"; then
            print_success "Redis berjalan! (redis-cli ping → PONG)"
            return 0
        fi
        RETRY=$((RETRY + 1))
        sleep 1
    done

    print_error "Redis tidak merespons setelah ${MAX_RETRY} detik"
    systemctl status redis-server --no-pager || true
    return 1
}

# ============================================================================
# UPDATE .env
# ============================================================================

update_env_redis() {
    local ENV_FILE="${APP_DIR}/.env"

    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env tidak ditemukan di ${APP_DIR}, lewati update .env"
        return 0
    fi

    # Cek apakah REDIS_URL sudah ada
    if grep -q "^REDIS_URL=" "$ENV_FILE"; then
        print_info "REDIS_URL sudah ada di .env, memperbarui..."
        sed -i 's|^REDIS_URL=.*|REDIS_URL=redis://127.0.0.1:6379|' "$ENV_FILE"
    elif grep -q "^# REDIS_URL=" "$ENV_FILE"; then
        # Uncomment baris yang ada
        sed -i 's|^# REDIS_URL=.*|REDIS_URL=redis://127.0.0.1:6379|' "$ENV_FILE"
    else
        # Tambahkan baris baru
        {
            echo ""
            echo "# Redis - Cache & Performance (diinstall otomatis)"
            echo "REDIS_URL=redis://127.0.0.1:6379"
        } >> "$ENV_FILE"
    fi

    print_success "REDIS_URL ditambahkan ke .env"
    export REDIS_INSTALLED="true"
}

# ============================================================================
# RESTART APP
# ============================================================================

restart_app_after_redis() {
    print_info "Merestart aplikasi agar Redis aktif..."

    if command -v pm2 &>/dev/null; then
        # Coba restart sebagai app user
        if [ -n "${APP_USER:-}" ] && id "$APP_USER" &>/dev/null; then
            sudo su - "$APP_USER" -c 'pm2 restart all 2>/dev/null || true' || true
        else
            pm2 restart all 2>/dev/null || true
        fi
        print_success "Aplikasi direstart"
    else
        print_warning "PM2 tidak ditemukan, restart manual diperlukan:"
        print_info "  pm2 restart all"
    fi
}

# ============================================================================
# STATUS CHECK
# ============================================================================

check_redis_status() {
    echo ""
    echo -e "${CYAN}=== Redis Status ===${NC}"

    # Service status
    local SVC_STATUS
    SVC_STATUS=$(systemctl is-active redis-server 2>/dev/null || echo "inactive")
    echo -e "  Service   : $([ "$SVC_STATUS" = "active" ] && echo "${GREEN}active${NC}" || echo "${RED}${SVC_STATUS}${NC}")"

    # Ping test
    local PING
    PING=$(redis-cli ping 2>/dev/null || echo "FAIL")
    echo -e "  Ping      : $([ "$PING" = "PONG" ] && echo "${GREEN}PONG${NC}" || echo "${RED}${PING}${NC}")"

    # Version
    local VER
    VER=$(redis-server --version 2>/dev/null | awk '{print $3}' || echo "N/A")
    echo -e "  Version   : ${WHITE}${VER}${NC}"

    # Memory info
    if redis-cli ping 2>/dev/null | grep -q "PONG"; then
        local USED_MEM
        USED_MEM=$(redis-cli info memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '[:space:]')
        local MAX_MEM
        MAX_MEM=$(redis-cli config get maxmemory 2>/dev/null | tail -1)
        local MAX_MEM_MB=$(( ${MAX_MEM:-0} / 1024 / 1024 ))
        echo -e "  Used Mem  : ${WHITE}${USED_MEM:-N/A}${NC}"
        echo -e "  Max Mem   : ${WHITE}${MAX_MEM_MB}mb${NC}"

        # Key count
        local KEYS
        KEYS=$(redis-cli dbsize 2>/dev/null || echo "0")
        echo -e "  Keys      : ${WHITE}${KEYS}${NC}"
    fi

    # .env check
    if [ -f "${APP_DIR}/.env" ]; then
        local ENV_REDIS
        ENV_REDIS=$(grep "^REDIS_URL=" "${APP_DIR}/.env" 2>/dev/null | cut -d= -f2- || echo "")
        echo -e "  .env      : $([ -n "$ENV_REDIS" ] && echo "${GREEN}${ENV_REDIS}${NC}" || echo "${YELLOW}REDIS_URL tidak diset${NC}")"
    fi

    echo ""
}

# ============================================================================
# UNINSTALL
# ============================================================================

uninstall_redis() {
    print_step "Menghapus Redis..."

    read -p "Yakin hapus Redis? Data di Redis akan hilang. [y/N]: " CONFIRM </dev/tty
    [[ ! "$CONFIRM" =~ ^[Yy]$ ]] && { print_info "Dibatalkan."; return 0; }

    systemctl stop redis-server 2>/dev/null || true
    systemctl disable redis-server 2>/dev/null || true
    apt-get remove -y redis-server redis-tools 2>/dev/null || true
    apt-get autoremove -y 2>/dev/null || true

    # Hapus REDIS_URL dari .env
    if [ -f "${APP_DIR}/.env" ]; then
        sed -i '/^REDIS_URL=/d' "${APP_DIR}/.env"
        sed -i '/^# Redis/d' "${APP_DIR}/.env"
        print_info "REDIS_URL dihapus dari .env"
    fi

    # Restart app
    pm2 restart all 2>/dev/null || true

    print_success "Redis berhasil dihapus"
}

# ============================================================================
# MAIN INSTALL FUNCTION (dipanggil dari vps-installer.sh)
# ============================================================================

install_redis() {
    print_step "Step 8: Redis Cache Installation"

    print_info "Redis meningkatkan performa:"
    print_info "  ✓ Cache RADIUS auth     → PPPoE login 5-10x lebih cepat"
    print_info "  ✓ Dashboard cache       → Kurangi query DB berat (30s TTL)"
    print_info "  ✓ Online user tracking  → Real-time tanpa full-scan radacct"
    print_info "  ✓ Rate limiting         → API protection terdistribusi"
    print_info "  ✓ Distributed cron lock → Cegah double-run multi-instance"
    echo ""

    install_redis_server
    configure_redis
    enable_redis_service
    update_env_redis
    restart_app_after_redis
    check_redis_status

    print_success "Redis berhasil diinstall dan dikonfigurasi!"
    return 0
}

# ============================================================================
# STANDALONE EXECUTION
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Parse args
    SKIP_ENV=false
    MODE="install"

    while [[ "$#" -gt 0 ]]; do
        case "$1" in
            --skip-env)   SKIP_ENV=true ;;
            --status)     MODE="status" ;;
            --uninstall)  MODE="uninstall" ;;
            *)            ;;
        esac
        shift
    done

    check_root

    case "$MODE" in
        status)
            check_redis_status
            ;;
        uninstall)
            uninstall_redis
            ;;
        install)
            echo ""
            echo -e "${CYAN}=====================================================${NC}"
            echo -e "${CYAN}  Salfanet Radius — Redis Standalone Installer${NC}"
            echo -e "${CYAN}=====================================================${NC}"
            echo ""

            install_redis_server
            configure_redis
            enable_redis_service

            if [ "$SKIP_ENV" = "false" ]; then
                update_env_redis
            fi

            restart_app_after_redis
            check_redis_status

            echo ""
            echo -e "${GREEN}=====================================================${NC}"
            echo -e "${GREEN}  Redis berhasil diinstall!${NC}"
            echo -e "${GREEN}=====================================================${NC}"
            echo ""
            echo -e "  Koneksi : ${WHITE}redis://127.0.0.1:6379${NC}"
            echo -e "  Config  : ${WHITE}/etc/redis/redis.conf${NC}"
            echo -e "  Log     : ${WHITE}/var/log/redis/redis-server.log${NC}"
            echo ""
            echo -e "${CYAN}Perintah berguna:${NC}"
            echo "  redis-cli ping                # Cek koneksi"
            echo "  redis-cli info                # Info lengkap"
            echo "  redis-cli keys '*'            # Lihat semua keys"
            echo "  redis-cli monitor             # Monitor real-time"
            echo "  systemctl status redis-server # Status service"
            echo "  bash $(basename "$0") --status  # Cek status ringkas"
            echo ""
            ;;
    esac
fi
