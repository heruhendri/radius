#!/bin/bash
# ============================================================================
# AIBILL RADIUS VPS Installer - Main Orchestrator
# ============================================================================
# Complete modular installer for AIBILL RADIUS on Ubuntu/Debian VPS
# ============================================================================

set -e  # Exit on error
set -o pipefail  # Catch errors in pipes

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common functions
source "$SCRIPT_DIR/common.sh"

# ============================================================================
# INITIALIZATION
# ============================================================================

initialize_installer() {
    print_banner
    
    # Initialize user selection first
    initialize_user_selection
    
    # Detect IP address
    local DETECTED_IP=$(detect_ip_address)
    
    # Check if it's a public or private IP
    local IP_TYPE="Local/Private"
    if [[ ! $DETECTED_IP =~ ^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.) ]]; then
        IP_TYPE="Public"
    fi
    
    show_installation_info "$DETECTED_IP" "$IP_TYPE"
    
    # Allow user to override detected IP
    read -t 10 -p "Use detected IP ($DETECTED_IP)? [Y/n/custom]: " IP_CONFIRM || IP_CONFIRM="y"
    echo ""
    
    if [[ "$IP_CONFIRM" =~ ^[Nn]$ ]]; then
        read -p "Enter IP address manually: " MANUAL_IP
        if [[ $MANUAL_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            export VPS_IP="$MANUAL_IP"
            print_success "Using manual IP: $VPS_IP"
        else
            print_error "Invalid IP format, using detected IP: $DETECTED_IP"
            export VPS_IP="$DETECTED_IP"
        fi
    elif [[ ! "$IP_CONFIRM" =~ ^[Yy]?$ ]] && [[ "$IP_CONFIRM" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        # User entered an IP directly
        export VPS_IP="$IP_CONFIRM"
        print_success "Using custom IP: $VPS_IP"
    else
        export VPS_IP="$DETECTED_IP"
        print_success "Using detected IP: $VPS_IP"
    fi
    
    echo ""
    
    # Set up installation info file
    export INSTALL_INFO_FILE="${APP_DIR}/INSTALLATION_INFO.txt"
    
    # Generate NextAuth secret
    export NEXTAUTH_SECRET=$(generate_secret)
    
    print_info "Initialization completed"
}

# ============================================================================
# MAIN INSTALLATION PROCESS
# ============================================================================

run_installation() {
    print_step "Starting AIBILL RADIUS Installation"
    
    # Step 1: System Setup
    print_info "Running Step 1: System Setup..."
    source "$SCRIPT_DIR/install-system.sh"
    install_system || {
        print_error "System setup failed!"
        exit 1
    }
    
    # Step 2: Node.js Installation
    print_info "Running Step 2: Node.js Installation..."
    source "$SCRIPT_DIR/install-nodejs.sh"
    install_nodejs || {
        print_error "Node.js installation failed!"
        exit 1
    }
    
    # Step 3: MySQL Installation
    print_info "Running Step 3: MySQL Installation..."
    source "$SCRIPT_DIR/install-mysql.sh"
    install_mysql || {
        print_error "MySQL installation failed!"
        exit 1
    }
    
    # Step 4: Application Setup
    print_info "Running Step 4: Application Setup..."
    source "$SCRIPT_DIR/install-app.sh"
    install_app || {
        print_error "Application setup failed!"
        exit 1
    }
    
    # Step 5: FreeRADIUS Installation
    print_info "Running Step 5: FreeRADIUS Installation..."
    source "$SCRIPT_DIR/install-freeradius.sh"
    install_freeradius || {
        print_error "FreeRADIUS installation failed!"
        exit 1
    }
    
    # Step 6: Nginx Configuration
    print_info "Running Step 6: Nginx Configuration..."
    source "$SCRIPT_DIR/install-nginx.sh"
    install_nginx || {
        print_error "Nginx configuration failed!"
        exit 1
    }
    
    # Step 7: PM2 & Build
    print_info "Running Step 7: PM2 Installation & Application Build..."
    source "$SCRIPT_DIR/install-pm2.sh"
    install_pm2_and_build || {
        print_error "PM2 installation or build failed!"
        exit 1
    }
    
    print_success "All installation steps completed successfully!"
}

# ============================================================================
# FINALIZATION
# ============================================================================

create_installation_info() {
    print_step "Creating Installation Information"
    
    cat > "${INSTALL_INFO_FILE}" <<EOF
============================================
AIBILL RADIUS - Installation Information
============================================

>> Installation Date: $(date)
[>] VPS IP: ${VPS_IP}
[>] Timezone: $(timedatectl show --property=Timezone --value)
[>] Current Time: $(date '+%Y-%m-%d %H:%M:%S %Z')

>> SYSTEM INFORMATION
--------------------
Operating System: $(lsb_release -d | cut -f2)
Node.js Version: $(node --version)
npm Version: $(npm --version)
MySQL Version: $(mysql --version | awk '{print $3}')
FreeRADIUS Version: $(freeradius -v 2>&1 | head -n1)
PM2 Version: $(pm2 --version)

[>] DATABASE CREDENTIALS
-----------------------
Database Name: ${DB_NAME}
Database User: ${DB_USER}
Database Password: ${DB_PASSWORD}
Root Password: ${DB_ROOT_PASSWORD}

[>] APPLICATION CONFIGURATION
----------------------------
App Directory: ${APP_DIR}
Environment File: ${APP_DIR}/.env
PM2 Config: ${APP_DIR}/ecosystem.config.js
Deployment Script: ${APP_DIR}/deploy.sh

[>] ACCESS INFORMATION
---------------------
Application URL: http://${VPS_IP}
Admin Login: http://${VPS_IP}/admin
Default Credentials: Check database seeders

[>] SERVICE STATUS
-----------------
MySQL: $(systemctl is-active mysql)
FreeRADIUS: $(systemctl is-active freeradius)
Nginx: $(systemctl is-active nginx)
PM2 App: $(pm2 list | grep -q "salfanet-radius.*online" && echo "online" || echo "offline")

[>] FIREWALL RULES
-----------------
Port 22   - SSH
Port 80   - HTTP
Port 443  - HTTPS
Port 1812 - RADIUS Authentication
Port 1813 - RADIUS Accounting
Port 3799 - RADIUS CoA

[>] USEFUL COMMANDS
------------------
# Application Management
pm2 status                        # Check app status
pm2 logs salfanet-radius          # View application logs
pm2 restart salfanet-radius       # Restart application
${APP_DIR}/deploy.sh              # Deploy updates

# Database Management
mysql -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME}  # Connect to database
mysqldump -u root -p${DB_ROOT_PASSWORD} ${DB_NAME} > backup.sql  # Backup

# FreeRADIUS Management
freeradius -X                     # Debug mode
systemctl restart freeradius      # Restart service
tail -f /var/log/freeradius/radius.log  # View RADIUS logs

# System Management
timedatectl                       # Check timezone
chronyc tracking                  # Check NTP sync
free -h                           # Check memory
df -h                             # Check disk space

[>] NEXT STEPS
-------------
1. Access application: http://${VPS_IP}
2. Login with default admin credentials
3. Change admin password immediately
4. Configure NAS/routers in RADIUS settings
5. Set up SSL certificate (optional):
   certbot --nginx -d yourdomain.com

[>] SECURITY RECOMMENDATIONS
--------------------------
- Change default admin password
- Change MySQL root password
- Configure fail2ban for SSH protection
- Regular system updates: apt update && apt upgrade
- Regular database backups
- Monitor application logs
- Keep NTP synchronized

============================================
Installation completed successfully! [>]
============================================
EOF

    print_success "Installation info created: ${INSTALL_INFO_FILE}"
}

show_final_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          INSTALLATION COMPLETED SUCCESSFULLY!                     ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Access your application:${NC}"
    echo -e "  ${WHITE}http://${VPS_IP}${NC}"
    echo ""
    echo -e "${CYAN}Application Status:${NC}"
    sudo su - ${APP_USER} -c 'pm2 list'
    echo ""
    echo -e "${CYAN}Important Credentials:${NC}"
    echo "  Database: ${DB_NAME}"
    echo "  DB User: ${DB_USER}"
    echo "  DB Password: ${DB_PASSWORD}"
    echo "  MySQL Root: ${DB_ROOT_PASSWORD}"
    echo ""
    echo -e "${CYAN}Installation Info:${NC}"
    echo "  ${INSTALL_INFO_FILE}"
    echo ""
    echo -e "${YELLOW}[!] SECURITY NOTICE:${NC}"
    echo "  - Change default admin password after first login"
    echo "  - Configure SSL certificate for production"
    echo "  - Review firewall rules"
    echo ""
    echo -e "${CYAN}Quick Commands (run as ${APP_USER}):${NC}"
    echo "  View logs:    sudo su - ${APP_USER} -c 'pm2 logs salfanet-radius'"
    echo "  Restart app:  sudo su - ${APP_USER} -c 'pm2 restart all'"
    echo "  PM2 status:   sudo su - ${APP_USER} -c 'pm2 list'"
    echo "  Deploy updates: ${APP_DIR}/deploy.sh"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    # Pre-checks
    check_root
    check_directory
    detect_os
    
    # Initialize
    initialize_installer
    
    # Run installation
    run_installation
    
    # Finalize
    create_installation_info
    show_final_summary
    
    # Log completion
    print_info "Installation log saved to: $INSTALL_LOG"
}

# Run main function
main "$@"
