#!/bin/bash
# ============================================================================
# AIBILL RADIUS VPS Installer - Common Functions
# ============================================================================
# Shared utilities, colors, logging, and configuration
# ============================================================================

# Colors for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export CYAN='\033[0;36m'
export BLUE='\033[0;34m'
export PURPLE='\033[0;35m'
export WHITE='\033[1;37m'
export NC='\033[0m' # No Color

# Global configuration variables
export NODE_VERSION="20"
export APP_DIR="/var/www/salfanet-radius"
# APP_USER and APP_GROUP will be set in initialize_user_selection()
export APP_USER=""
export APP_GROUP=""
export DB_NAME="salfanet_radius"
export DB_USER="salfanet_user"
export DB_PASSWORD="salfanetradius123"
export DB_ROOT_PASSWORD="root123"
export INSTALL_LOG="/var/log/aibill-vps-install.log"
export INSTALL_INFO_FILE="${APP_DIR}/INSTALLATION_INFO.txt"

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

print_success() {
    echo -e "${GREEN}[OK] $1${NC}"
    echo "[OK] $1" >> "$INSTALL_LOG" 2>/dev/null || true
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
    echo "[ERROR] $1" >> "$INSTALL_LOG" 2>/dev/null || true
}

print_info() {
    echo -e "${YELLOW}[INFO] $1${NC}"
    echo "[INFO] $1" >> "$INSTALL_LOG" 2>/dev/null || true
}

print_warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
    echo "[WARNING] $1" >> "$INSTALL_LOG" 2>/dev/null || true
}

print_step() {
    echo ""
    echo -e "${CYAN}=============================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}=============================================${NC}"
    echo ""
    echo "=============================================" >> "$INSTALL_LOG" 2>/dev/null || true
    echo "$1" >> "$INSTALL_LOG" 2>/dev/null || true
    echo "=============================================" >> "$INSTALL_LOG" 2>/dev/null || true
}

export -f print_success
export -f print_error
export -f print_info
export -f print_warning
export -f print_step

# ============================================================================
# IP ADDRESS DETECTION
# ============================================================================

detect_ip_address() {
    local PUBLIC_IP=""
    local LOCAL_IP=""
    
    # Try to get public IP from various services
    echo -e "${YELLOW}[INFO] Detecting IP address...${NC}" >&2
    
    # Method 1: Try curl to external services
    if command -v curl &> /dev/null; then
        PUBLIC_IP=$(curl -s --connect-timeout 5 https://api.ipify.org 2>/dev/null) || \
        PUBLIC_IP=$(curl -s --connect-timeout 5 https://ifconfig.me 2>/dev/null) || \
        PUBLIC_IP=$(curl -s --connect-timeout 5 https://icanhazip.com 2>/dev/null) || \
        PUBLIC_IP=$(curl -s --connect-timeout 5 https://ipecho.net/plain 2>/dev/null) || \
        PUBLIC_IP=""
    fi
    
    # Method 2: Try wget if curl failed
    if [ -z "$PUBLIC_IP" ] && command -v wget &> /dev/null; then
        PUBLIC_IP=$(wget -qO- --timeout=5 https://api.ipify.org 2>/dev/null) || \
        PUBLIC_IP=$(wget -qO- --timeout=5 https://ifconfig.me 2>/dev/null) || \
        PUBLIC_IP=""
    fi
    
    # Get local/private IP
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || \
    LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}') || \
    LOCAL_IP="127.0.0.1"
    
    # Validate public IP format (basic IPv4 check)
    if [[ $PUBLIC_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        # Check if public IP is actually public (not private range)
        if [[ ! $PUBLIC_IP =~ ^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.) ]]; then
            echo "$PUBLIC_IP"
            return 0
        fi
    fi
    
    # Fallback to local IP
    echo "$LOCAL_IP"
    return 0
}

export -f detect_ip_address

# ============================================================================
# SYSTEM CHECKS
# ============================================================================

check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_error "Please run as root (use sudo)"
        exit 1
    fi
}

export -f check_root

check_directory() {
    local CURRENT_DIR=$(pwd)
    if [[ "$CURRENT_DIR" != *"salfanet-radius-main"* ]] && [[ "$CURRENT_DIR" != *"AIBILL-RADIUS-main"* ]]; then
        print_error "Please run this script from the source directory"
        echo "   Current directory: $CURRENT_DIR"
        echo ""
        echo "   Expected: /root/salfanet-radius-main or /root/AIBILL-RADIUS-main"
        exit 1
    fi
}

export -f check_directory

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME=$NAME
        OS_VERSION=$VERSION_ID
        
        if [[ "$OS_NAME" =~ "Ubuntu" ]]; then
            if [[ "$OS_VERSION" == "20.04" ]] || [[ "$OS_VERSION" == "22.04" ]] || [[ "$OS_VERSION" == "24.04" ]]; then
                print_success "Detected: Ubuntu $OS_VERSION"
                return 0
            else
                print_warning "Ubuntu version $OS_VERSION detected (recommended: 20.04, 22.04, or 24.04)"
            fi
        elif [[ "$OS_NAME" =~ "Debian" ]]; then
            print_info "Detected: Debian $OS_VERSION (Ubuntu packages will be used)"
            return 0
        else
            print_warning "OS: $OS_NAME $OS_VERSION (not tested, may have issues)"
        fi
    else
        print_warning "Cannot detect OS version"
    fi
}

export -f detect_os

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

generate_secret() {
    # Generate random secret using /dev/urandom
    head -c 32 /dev/urandom | base64 | tr -d '\n'
}

export -f generate_secret

save_install_info() {
    local KEY="$1"
    local VALUE="$2"
    
    if [ -n "$INSTALL_INFO_FILE" ]; then
        # Create directory if it doesn't exist
        local INFO_DIR=$(dirname "$INSTALL_INFO_FILE")
        if [ ! -d "$INFO_DIR" ]; then
            mkdir -p "$INFO_DIR" 2>/dev/null || true
        fi
        echo "${KEY}=${VALUE}" >> "$INSTALL_INFO_FILE" 2>/dev/null || true
    fi
}

export -f save_install_info

create_backup() {
    local SOURCE="$1"
    local BACKUP_DIR="/root/backups/$(date +%Y%m%d_%H%M%S)"
    
    if [ -e "$SOURCE" ]; then
        print_info "Creating backup of $SOURCE..."
        mkdir -p "$BACKUP_DIR"
        cp -r "$SOURCE" "$BACKUP_DIR/" 2>/dev/null || true
        print_success "Backup created: $BACKUP_DIR"
    fi
}

export -f create_backup

wait_for_service() {
    local SERVICE_NAME="$1"
    local MAX_WAIT=${2:-30}
    local COUNTER=0
    
    print_info "Waiting for $SERVICE_NAME to start..."
    
    while [ $COUNTER -lt $MAX_WAIT ]; do
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            print_success "$SERVICE_NAME is running"
            return 0
        fi
        sleep 1
        COUNTER=$((COUNTER + 1))
    done
    
    print_error "$SERVICE_NAME failed to start within ${MAX_WAIT}s"
    return 1
}

export -f wait_for_service

verify_installation() {
    local COMPONENT="$1"
    local CHECK_COMMAND="$2"
    
    if eval "$CHECK_COMMAND" &>/dev/null; then
        print_success "$COMPONENT is installed"
        return 0
    else
        print_error "$COMPONENT is NOT installed"
        return 1
    fi
}

export -f verify_installation

# ============================================================================
# BANNER FUNCTION
# ============================================================================

print_banner() {
    clear
    echo ""
    echo -e "${CYAN}=============================================${NC}"
    echo -e "${CYAN}  AIBILL RADIUS - VPS Installation Script${NC}"
    echo -e "${CYAN}=============================================${NC}"
    echo ""
}

export -f print_banner

show_installation_info() {
    local DETECTED_IP="$1"
    local IP_TYPE="$2"
    
    echo -e "  Detected IP: ${CYAN}${DETECTED_IP}${NC} (${IP_TYPE})"
    echo ""
    echo "  Directory Structure:"
    echo "    Source Code: $(pwd)"
    echo "    Application: ${APP_DIR}"
    echo "    Logs: ${APP_DIR}/logs"
    echo ""
    echo "  Estimated time: 20-25 minutes"
    echo "  Steps:"
    echo "    1. System Update & Dependencies (2 min)"
    echo "    2. Install Node.js ${NODE_VERSION} (2 min)"
    echo "    3. Install & Configure MySQL (2 min)"
    echo "    4. Setup Application & Database (10 min)"
    echo "    5. Install & Configure FreeRADIUS (2 min)"
    echo "    6. Install PM2, Nginx, Configs (2 min)"
    echo "    7. Build & Start Application (5-10 min)"
    echo ""
    echo -e "${YELLOW}[!] IMPORTANT: Do not interrupt this process!${NC}"
    echo ""
}

export -f show_installation_info

# ============================================================================
# USER SELECTION
# ============================================================================

initialize_user_selection() {
    print_step "Application User Configuration"
    
    # Detect current login user (not root)
    local CURRENT_USER=$(who am i | awk '{print $1}')
    if [ -z "$CURRENT_USER" ] || [ "$CURRENT_USER" = "root" ]; then
        CURRENT_USER=$(logname 2>/dev/null || echo "ubuntu")
    fi
    
    echo -e "${CYAN}Application User Options:${NC}"
    echo "  1) Use existing user: ${GREEN}$CURRENT_USER${NC} (recommended for single-user VPS)"
    echo "  2) Create dedicated user: ${YELLOW}salfanet${NC} (recommended for security/multi-user)"
    echo ""
    
    read -t 15 -p "Select option [1/2] (default: 1): " USER_CHOICE || USER_CHOICE="1"
    echo ""
    
    if [[ "$USER_CHOICE" == "2" ]]; then
        export APP_USER="salfanet"
        export APP_GROUP="salfanet"
        export CREATE_NEW_USER=true
        print_success "Will create dedicated user: salfanet"
    else
        export APP_USER="$CURRENT_USER"
        export APP_GROUP="$CURRENT_USER"
        export CREATE_NEW_USER=false
        print_success "Will use existing user: $APP_USER"
    fi
    
    echo ""
    print_info "Application will run as user: ${APP_USER}"
    print_info "Application directory: ${APP_DIR}"
    echo ""
}

export -f initialize_user_selection

# ============================================================================
# INITIALIZATION
# ============================================================================

initialize_logging() {
    # Create log directory
    mkdir -p /var/log
    
    # Create/truncate log file
    : > "$INSTALL_LOG"
    
    print_info "Logging to: $INSTALL_LOG"
}

export -f initialize_logging

# ============================================================================
# AUTO-EXECUTE ON SOURCE
# ============================================================================

# Initialize logging when this script is sourced
if [ "${BASH_SOURCE[0]}" != "${0}" ]; then
    # Being sourced
    initialize_logging
fi
