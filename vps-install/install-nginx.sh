#!/bin/bash
# ============================================================================
# AIBILL RADIUS VPS Installer - Nginx Module
# ============================================================================
# Step 6: Install & configure Nginx reverse proxy
# ============================================================================

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# ============================================================================
# NGINX CONFIGURATION
# ============================================================================

create_nginx_config() {
    print_info "Creating Nginx site configuration..."
    
    # Get VPS IP if not set
    if [ -z "$VPS_IP" ]; then
        export VPS_IP=$(detect_ip_address)
    fi
    
    cat > /etc/nginx/sites-available/salfanet-radius <<EOF
server {
    listen 80;
    listen [::]:80;
    
    server_name ${VPS_IP} _;
    
    # Increase client body size for file uploads
    client_max_body_size 100M;
    
    # Timeouts
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # Headers
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Access log
    access_log /var/log/nginx/salfanet-radius-access.log;
    error_log /var/log/nginx/salfanet-radius-error.log;
}
EOF

    print_success "Nginx configuration created"
}

enable_nginx_site() {
    print_info "Enabling Nginx site..."
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Enable our site
    ln -sf /etc/nginx/sites-available/salfanet-radius /etc/nginx/sites-enabled/
    
    print_success "Nginx site enabled"
}

test_nginx_config() {
    print_info "Testing Nginx configuration..."
    
    if nginx -t 2>&1 | grep -q "successful"; then
        print_success "Nginx configuration is valid"
        return 0
    else
        print_error "Nginx configuration test failed!"
        nginx -t
        return 1
    fi
}

restart_nginx() {
    print_info "Restarting Nginx..."
    
    systemctl restart nginx
    systemctl enable nginx
    
    wait_for_service "nginx" 10
}

configure_firewall_nginx() {
    print_info "Configuring firewall for Nginx..."
    
    ufw allow 80/tcp comment 'HTTP' 2>/dev/null || true
    ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
    
    print_success "Firewall configured"
}

install_nginx() {
    print_step "Step 6: Configuring Nginx Reverse Proxy"
    
    # Nginx should already be installed by install-system.sh
    if ! command -v nginx &>/dev/null; then
        print_info "Installing Nginx..."
        apt-get install -y nginx
    fi
    
    create_nginx_config
    enable_nginx_site
    test_nginx_config
    restart_nginx
    configure_firewall_nginx
    
    print_success "Nginx installation and configuration completed"
    
    echo ""
    print_info "Nginx Configuration:"
    echo "  HTTP Port: 80"
    echo "  Proxy to: http://localhost:3000"
    echo "  Access URL: http://${VPS_IP}"
    echo ""
    print_info "SSL Setup (optional):"
    echo "  certbot --nginx -d yourdomain.com"
    
    return 0
}

# Main execution if run directly
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
    check_root
    
    install_nginx
fi
