#!/bin/bash
# ============================================================================
# AIBILL RADIUS VPS Installer - FreeRADIUS Module
# ============================================================================
# Step 5: Install & configure FreeRADIUS 3.x with MySQL
# ============================================================================

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Detect FreeRADIUS config directory
detect_freeradius_path() {
    if [ -d "/etc/freeradius/3.0" ]; then
        echo "/etc/freeradius/3.0"
    elif [ -d "/etc/freeradius" ]; then
        echo "/etc/freeradius"
    else
        echo "/etc/freeradius/3.0"
    fi
}

# Function to remove BOM (Byte Order Mark) from files
remove_bom() {
    local file="$1"
    if [ -f "$file" ]; then
        # Remove UTF-8 BOM, UTF-16 LE/BE BOMs
        sed -i '1s/^\xEF\xBB\xBF//' "$file" 2>/dev/null || true
        sed -i '1s/^\xFF\xFE//' "$file" 2>/dev/null || true
        sed -i '1s/^\xFE\xFF//' "$file" 2>/dev/null || true
        tr -d '\0' < "$file" > "$file.tmp" && mv "$file.tmp" "$file" 2>/dev/null || true
    fi
}

# ============================================================================
# FREERADIUS INSTALLATION
# ============================================================================

remove_old_freeradius() {
    print_info "Removing old FreeRADIUS installation (if exists)..."
    
    systemctl stop freeradius 2>/dev/null || true
    killall -9 freeradius 2>/dev/null || true
    
    apt-get remove --purge -y freeradius freeradius-mysql freeradius-utils freeradius-common 2>/dev/null || true
    apt-get autoremove -y 2>/dev/null || true
    apt-get autoclean 2>/dev/null || true
    rm -rf /etc/freeradius /var/log/freeradius /var/run/freeradius 2>/dev/null || true
}

install_freeradius_packages() {
    print_info "Installing fresh FreeRADIUS..."
    
    apt-get install -y freeradius freeradius-mysql freeradius-utils freeradius-rest || {
        print_error "Failed to install FreeRADIUS packages"
        return 1
    }
    
    # Detect FreeRADIUS config directory after installation
    export FR_CONFIG_DIR=$(detect_freeradius_path)
    print_info "FreeRADIUS config directory: $FR_CONFIG_DIR"
    
    print_success "FreeRADIUS packages installed"
}

restore_from_backup() {
    local FR_BACKUP_DIR="${APP_DIR}/freeradius-config"
    
    if [ ! -d "$FR_BACKUP_DIR" ]; then
        return 1
    fi
    
    if [ ! -f "$FR_BACKUP_DIR/mods-available/sql" ] && [ ! -f "$FR_BACKUP_DIR/mods-enabled/sql" ]; then
        return 1
    fi
    
    print_info "Found FreeRADIUS backup configs in project..."
    print_info "Restoring configuration from backup..."
    
    # Restore SQL module
    if [ -f "$FR_BACKUP_DIR/mods-available/sql" ]; then
        cp "$FR_BACKUP_DIR/mods-available/sql" ${FR_CONFIG_DIR}/mods-available/sql
        remove_bom ${FR_CONFIG_DIR}/mods-available/sql
        sed -i "s/login = .*/login = \"${DB_USER}\"/" ${FR_CONFIG_DIR}/mods-available/sql
        sed -i "s/password = .*/password = \"${DB_PASSWORD}\"/" ${FR_CONFIG_DIR}/mods-available/sql
        sed -i "s/radius_db = .*/radius_db = \"${DB_NAME}\"/" ${FR_CONFIG_DIR}/mods-available/sql
        rm -f ${FR_CONFIG_DIR}/mods-enabled/sql
        ln -sf ${FR_CONFIG_DIR}/mods-available/sql ${FR_CONFIG_DIR}/mods-enabled/sql
        print_success "SQL module restored"
    fi
    
    # Restore REST module
    if [ -f "$FR_BACKUP_DIR/mods-available/rest" ]; then
        cp "$FR_BACKUP_DIR/mods-available/rest" ${FR_CONFIG_DIR}/mods-available/rest
        remove_bom ${FR_CONFIG_DIR}/mods-available/rest
        rm -f ${FR_CONFIG_DIR}/mods-enabled/rest
        ln -sf ${FR_CONFIG_DIR}/mods-available/rest ${FR_CONFIG_DIR}/mods-enabled/rest
        print_success "REST module restored"
    fi
    
    # Restore sites-enabled/default
    if [ -f "$FR_BACKUP_DIR/sites-available/default" ]; then
        cp "$FR_BACKUP_DIR/sites-available/default" ${FR_CONFIG_DIR}/sites-available/default
        remove_bom ${FR_CONFIG_DIR}/sites-available/default
        rm -f ${FR_CONFIG_DIR}/sites-enabled/default
        ln -sf ${FR_CONFIG_DIR}/sites-available/default ${FR_CONFIG_DIR}/sites-enabled/default
        print_success "Default site restored"
    fi
    
    # Restore clients.conf
    if [ -f "$FR_BACKUP_DIR/clients.conf" ]; then
        cp "$FR_BACKUP_DIR/clients.conf" ${FR_CONFIG_DIR}/clients.conf
        remove_bom ${FR_CONFIG_DIR}/clients.conf
        print_success "Clients config restored"
    fi
    
    # Restore policy.d/filter for PPPoE support
    if [ -f "$FR_BACKUP_DIR/policy.d/filter" ]; then
        cp "$FR_BACKUP_DIR/policy.d/filter" ${FR_CONFIG_DIR}/policy.d/filter
        remove_bom ${FR_CONFIG_DIR}/policy.d/filter
        print_success "Policy filter restored (PPPoE realm support enabled)"
    fi
    
    return 0
}

configure_sql_module() {
    print_info "Configuring FreeRADIUS SQL module..."
    
    cat > ${FR_CONFIG_DIR}/mods-available/sql <<'EOF'
sql {
    driver = "rlm_sql_mysql"
    dialect = "mysql"
    
    server = "localhost"
    port = 3306
    login = "DB_USER_PLACEHOLDER"
    password = "DB_PASSWORD_PLACEHOLDER"
    
    radius_db = "DB_NAME_PLACEHOLDER"
    
    acct_table1 = "radacct"
    acct_table2 = "radacct"
    postauth_table = "radpostauth"
    authcheck_table = "radcheck"
    groupcheck_table = "radgroupcheck"
    authreply_table = "radreply"
    groupreply_table = "radgroupreply"
    usergroup_table = "radusergroup"
    
    group_attribute = "SQL-Group"
    sql_user_name = "%{User-Name}"
    
    read_clients = yes
    client_table = "nas"
    
    read_groups = yes
    read_profiles = yes
    delete_stale_sessions = yes
    
    pool {
        start = 5
        min = 4
        max = 32
        spare = 3
        uses = 0
        lifetime = 0
        idle_timeout = 60
    }
}
EOF

    # Replace placeholders
    sed -i "s/DB_USER_PLACEHOLDER/${DB_USER}/" ${FR_CONFIG_DIR}/mods-available/sql
    sed -i "s/DB_PASSWORD_PLACEHOLDER/${DB_PASSWORD}/" ${FR_CONFIG_DIR}/mods-available/sql
    sed -i "s/DB_NAME_PLACEHOLDER/${DB_NAME}/" ${FR_CONFIG_DIR}/mods-available/sql
    
    print_success "SQL module configured"
}

configure_rest_module() {
    print_info "Configuring FreeRADIUS REST module for API integration..."
    
    cat > ${FR_CONFIG_DIR}/mods-available/rest <<'EOF'
rest {
    tls {
        check_cert = no
        check_cert_cn = no
    }

    connect_uri = "http://localhost:3000"

    authorize {
        uri = "${..connect_uri}/api/radius/authorize"
        method = "post"
        body = "json"
        data = "{ \"username\": \"%{User-Name}\", \"nasIp\": \"%{NAS-IP-Address}\" }"
        timeout = 2
        tls = ${..tls}
    }

    post-auth {
        uri = "${..connect_uri}/api/radius/post-auth"
        method = "post"
        body = "json"
        data = "{ \"username\": \"%{User-Name}\", \"reply\": \"%{reply:Packet-Type}\", \"nasIp\": \"%{NAS-IP-Address}\", \"framedIp\": \"%{Framed-IP-Address}\" }"
        tls = ${..tls}
    }

    accounting {
        uri = "${..connect_uri}/api/radius/accounting"
        method = "post"
        body = "json"
        data = "{ \"username\": \"%{User-Name}\", \"statusType\": \"%{Acct-Status-Type}\", \"sessionId\": \"%{Acct-Session-Id}\", \"nasIp\": \"%{NAS-IP-Address}\", \"framedIp\": \"%{Framed-IP-Address}\", \"sessionTime\": \"%{Acct-Session-Time}\", \"inputOctets\": \"%{Acct-Input-Octets}\", \"outputOctets\": \"%{Acct-Output-Octets}\" }"
        tls = ${..tls}
    }

    pool {
        start = 0
        min = 0
        max = 32
        spare = 1
        uses = 0
        lifetime = 0
        idle_timeout = 60
        connect_timeout = 3
    }
}
EOF

    print_success "REST module configured"
}

enable_modules() {
    print_info "Enabling FreeRADIUS modules..."
    
    # Remove old symlinks
    rm -f ${FR_CONFIG_DIR}/mods-enabled/sql*
    rm -f ${FR_CONFIG_DIR}/mods-enabled/rest
    
    # Enable SQL module
    ln -sf ${FR_CONFIG_DIR}/mods-available/sql ${FR_CONFIG_DIR}/mods-enabled/sql
    
    # DO NOT enable REST module during install - app is not running yet
    # REST module will be enabled after PM2 starts the application
    # ln -sf ${FR_CONFIG_DIR}/mods-available/rest ${FR_CONFIG_DIR}/mods-enabled/rest
    
    print_success "Modules enabled (SQL only, REST will be enabled after app starts)"
}

configure_pppoe_support() {
    print_info "Configuring PPPoE realm support..."
    
    # Disable filter_username to allow username@realm format
    if [ -f "${FR_CONFIG_DIR}/sites-enabled/default" ]; then
        if grep -q "^\s*filter_username" ${FR_CONFIG_DIR}/sites-enabled/default; then
            sed -i 's/^\(\s*\)filter_username/\1#filter_username # DISABLED for PPPoE realm support/' ${FR_CONFIG_DIR}/sites-enabled/default
            print_success "PPPoE realm support enabled"
        fi
    fi
    
    # Modify policy.d/filter
    if [ -f "${FR_CONFIG_DIR}/policy.d/filter" ]; then
        sed -i '/must have at least 1 string-dot-string/,/reject$/{s/^/#/}' ${FR_CONFIG_DIR}/policy.d/filter 2>/dev/null || true
        print_success "Policy filter modified for PPPoE"
    fi
}

configure_firewall() {
    print_info "Configuring firewall for FreeRADIUS..."
    
    # Open RADIUS ports
    ufw allow 1812/udp comment 'RADIUS Authentication' 2>/dev/null || true
    ufw allow 1813/udp comment 'RADIUS Accounting' 2>/dev/null || true
    ufw allow 3799/udp comment 'RADIUS CoA' 2>/dev/null || true
    
    print_success "Firewall configured"
}

start_freeradius() {
    print_info "Starting FreeRADIUS service..."
    
    # Stop existing service first
    systemctl stop freeradius 2>/dev/null || true
    killall -9 freeradius 2>/dev/null || true
    sleep 2
    
    # Test configuration first
    print_info "Testing FreeRADIUS configuration..."
    if freeradius -CX 2>&1 | tee /tmp/freeradius-test.log | grep -q "Configuration appears to be OK"; then
        print_success "FreeRADIUS configuration is valid"
    else
        print_error "FreeRADIUS configuration has errors!"
        echo "========================================"
        tail -30 /tmp/freeradius-test.log
        echo "========================================"
        print_info "Common fixes:"
        echo "  1. Check SQL module: ${FR_CONFIG_DIR}/mods-enabled/sql"
        echo "  2. Check clients.conf: ${FR_CONFIG_DIR}/clients.conf"
        echo "  3. Verify MySQL connection"
        echo "  4. Run debug: freeradius -X"
        return 1
    fi
    
    # Enable and start service
    systemctl enable freeradius
    systemctl start freeradius
    
    wait_for_service "freeradius" 10
}

test_freeradius() {
    print_info "Testing FreeRADIUS installation..."
    
    # Test radtest (will fail without user, but confirms RADIUS is running)
    if radtest test test localhost 0 testing123 2>&1 | grep -q "Received Access-Reject"; then
        print_success "FreeRADIUS is responding to requests"
    elif systemctl is-active --quiet freeradius; then
        print_success "FreeRADIUS is running"
    else
        print_error "FreeRADIUS may not be running correctly"
        return 1
    fi
}

configure_sudoers() {
    print_info "Configuring sudoers for FreeRADIUS control..."
    
    # Allow app user to restart freeradius without password
    # This is needed for the health check cron job to restart freeradius if down
    cat > /etc/sudoers.d/${APP_USER}-freeradius <<EOF
# Allow ${APP_USER} user to control FreeRADIUS service
${APP_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart freeradius
${APP_USER} ALL=(ALL) NOPASSWD: /bin/systemctl start freeradius
${APP_USER} ALL=(ALL) NOPASSWD: /bin/systemctl stop freeradius
${APP_USER} ALL=(ALL) NOPASSWD: /bin/systemctl status freeradius
EOF
    
    chmod 440 /etc/sudoers.d/${APP_USER}-freeradius
    
    # Validate sudoers file
    if visudo -c -f /etc/sudoers.d/${APP_USER}-freeradius 2>/dev/null; then
        print_success "Sudoers configured for FreeRADIUS control"
    else
        print_warning "Sudoers validation failed, removing..."
        rm -f /etc/sudoers.d/${APP_USER}-freeradius
    fi
}

install_freeradius() {
    print_step "Step 5: Installing FreeRADIUS"
    
    remove_old_freeradius
    install_freeradius_packages
    
    # Try to restore from backup, if fails create fresh config
    if ! restore_from_backup; then
        print_info "No backup found, creating fresh configuration..."
        configure_sql_module
        configure_rest_module
    fi
    
    enable_modules
    configure_pppoe_support
    configure_firewall
    configure_sudoers
    start_freeradius
    test_freeradius
    
    print_success "FreeRADIUS installation completed"
    
    echo ""
    print_info "FreeRADIUS Configuration:"
    echo "  Authentication Port: 1812/UDP"
    echo "  Accounting Port: 1813/UDP"
    echo "  CoA Port: 3799/UDP"
    echo "  SQL Module: Enabled (${DB_NAME})"
    echo "  REST API: Enabled (http://localhost:3000)"
    echo ""
    print_info "Debug mode: freeradius -X"
    print_info "Test auth: radtest username password localhost 0 testing123"
    
    return 0
}

# Main execution if run directly
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
    check_root
    check_directory
    
    install_freeradius
fi
