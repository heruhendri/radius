#!/bin/bash
# ==============================================================================
# VPN Routing Setup Script for VPS (FreeRADIUS Server)
# 
# This script sets up persistent routing so the VPS can communicate with all
# MikroTik NAS clients connected to MikroTik CHR VPN Server via L2TP/IPSec.
#
# Architecture:
#   [NAS MikroTik] --L2TP--> [MikroTik CHR] <--L2TP-- [VPS/FreeRADIUS]
#        VPN_IP                 .1 (gateway)              VPN_IP
#
# The VPS connects as L2TP client to CHR. NAS routers also connect as L2TP
# clients to the same CHR. CHR acts as the routing hub between all VPN peers.
#
# Usage: sudo bash vpn-routing-setup.sh [VPN_SUBNET]
# Example: sudo bash vpn-routing-setup.sh 10.20.30.0/24
# ==============================================================================

set -e

# ── Status mode ────────────────────────────────────────────────────────────────
if [ "$1" = "--status" ]; then
    echo "============================================"
    echo " VPN Routing Status"
    echo "============================================"
    echo ""
    echo "[PPP Interfaces]"
    ip -o link show 2>/dev/null | grep ppp || echo "  None active"
    echo ""
    echo "[VPN Routes]"
    ip route show | grep ppp || echo "  None"
    echo ""
    echo "[iptables INPUT — RADIUS / ICMP]"
    iptables -L INPUT -n --line-numbers 2>/dev/null | grep -E "1812|1813|icmp" || echo "  None"
    echo ""
    echo "[iptables FORWARD]"
    iptables -L FORWARD -n 2>/dev/null | head -8
    echo ""
    echo "[IP Forwarding]"
    sysctl net.ipv4.ip_forward
    echo ""
    echo "[PPP Hook]"
    if [ -f /etc/ppp/ip-up.d/99-vpn-routes.sh ]; then
        echo "  ✓ /etc/ppp/ip-up.d/99-vpn-routes.sh installed"
    else
        echo "  ✗ Not installed — run this script with a subnet to install"
    fi
    exit 0
fi

VPN_SUBNET="${1:-}"
if [ -z "$VPN_SUBNET" ]; then
    echo "Usage: $0 <VPN_SUBNET>"
    echo "Usage: $0 --status"
    echo ""
    echo "Example: $0 10.20.30.0/24"
    echo ""
    echo "VPN_SUBNET must match the subnet configured on MikroTik CHR VPN Server."
    exit 1
fi

# Parse subnet — derive gateway (.1)
NETWORK=$(echo "$VPN_SUBNET" | cut -d'/' -f1)
IFS='.' read -r A B C D <<< "$NETWORK"
VPN_GATEWAY="${A}.${B}.${C}.1"

echo "============================================"
echo " VPN Routing Setup for SALFANET RADIUS"
echo "============================================"
echo " VPN Subnet   : $VPN_SUBNET"
echo " CHR Gateway  : $VPN_GATEWAY (MikroTik CHR .1)"
echo "============================================"
echo ""

# 1. Ensure IP forwarding is enabled
echo "[1/5] Checking IP forwarding..."
if ! sysctl net.ipv4.ip_forward | grep -q "= 1"; then
    echo "  Enabling IP forwarding..."
    sysctl -w net.ipv4.ip_forward=1
    if ! grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf; then
        echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
    fi
    echo "  ✓ IP forwarding enabled"
else
    echo "  ✓ IP forwarding already enabled"
fi

# 2. Create ip-up.d script (runs automatically when PPP connects)
echo ""
echo "[2/5] Creating /etc/ppp/ip-up.d/99-vpn-routes.sh ..."
cat > /etc/ppp/ip-up.d/99-vpn-routes.sh << SCRIPT
#!/bin/bash
# Auto-add VPN subnet route when PPP interface comes up
# Created by SALFANET VPN Routing Setup
# 
# PPP passes these arguments:
#   \$1 = interface name (e.g., ppp0)
#   \$2 = tty device
#   \$3 = speed
#   \$4 = local IP
#   \$5 = remote IP (peer/gateway)

IFACE="\$1"
LOCAL_IP="\$4"
REMOTE_IP="\$5"

logger -t vpn-route "PPP interface \$IFACE up: local=\$LOCAL_IP remote=\$REMOTE_IP"

# Add route to VPN subnet via the PPP gateway
# This allows VPS to reach all VPN clients (NAS routers) through CHR
ip route replace ${VPN_SUBNET} via \$REMOTE_IP dev \$IFACE metric 100 2>/dev/null || \
ip route add ${VPN_SUBNET} via \$REMOTE_IP dev \$IFACE metric 100 2>/dev/null || true

logger -t vpn-route "Route added: ${VPN_SUBNET} via \$REMOTE_IP dev \$IFACE"

# Also ensure FreeRADIUS can receive packets from VPN clients
# Allow RADIUS ports from VPN subnet
iptables -C INPUT -s ${VPN_SUBNET} -p udp --dport 1812 -j ACCEPT 2>/dev/null || \
iptables -I INPUT 1 -s ${VPN_SUBNET} -p udp --dport 1812 -j ACCEPT

iptables -C INPUT -s ${VPN_SUBNET} -p udp --dport 1813 -j ACCEPT 2>/dev/null || \
iptables -I INPUT 1 -s ${VPN_SUBNET} -p udp --dport 1813 -j ACCEPT

# ICMP (ping) — allows VPS to respond to ping from CHR/NAS devices
iptables -C INPUT -s ${VPN_SUBNET} -p icmp -j ACCEPT 2>/dev/null || \
iptables -I INPUT 1 -s ${VPN_SUBNET} -p icmp -j ACCEPT

# FORWARD chain — allows VPS to route traffic between VPN peers
iptables -C FORWARD -s ${VPN_SUBNET} -j ACCEPT 2>/dev/null || \
iptables -I FORWARD 1 -s ${VPN_SUBNET} -j ACCEPT
iptables -C FORWARD -d ${VPN_SUBNET} -j ACCEPT 2>/dev/null || \
iptables -I FORWARD 1 -d ${VPN_SUBNET} -j ACCEPT

logger -t vpn-route "Routing rules applied for ${VPN_SUBNET} on ${IFACE} via ${REMOTE_IP}"
SCRIPT

chmod +x /etc/ppp/ip-up.d/99-vpn-routes.sh
echo "  ✓ ip-up.d script created"

# 3. Apply FORWARD rules in main body too (immediate effect)
echo ""
echo "[3/5] Configuring iptables FORWARD chain (routing between VPN peers)..."
iptables -C FORWARD -s ${VPN_SUBNET} -j ACCEPT 2>/dev/null || \
    iptables -I FORWARD 1 -s ${VPN_SUBNET} -j ACCEPT
iptables -C FORWARD -d ${VPN_SUBNET} -j ACCEPT 2>/dev/null || \
    iptables -I FORWARD 1 -d ${VPN_SUBNET} -j ACCEPT
echo "  ✓ FORWARD src/dst rules for ${VPN_SUBNET}"

# Also allow ICMP immediately in INPUT (applied here, not just in hook)
iptables -C INPUT -s ${VPN_SUBNET} -p icmp -j ACCEPT 2>/dev/null || \
    iptables -I INPUT 1 -s ${VPN_SUBNET} -p icmp -j ACCEPT
echo "  ✓ ICMP/ping rule for ${VPN_SUBNET}"

# 4. Create ip-down.d script (cleanup when PPP disconnects)
echo ""
echo "[4/5] Creating /etc/ppp/ip-down.d/99-vpn-routes.sh ..."
cat > /etc/ppp/ip-down.d/99-vpn-routes.sh << SCRIPT
#!/bin/bash
# Cleanup VPN routes when PPP interface goes down
# Created by SALFANET VPN Routing Setup

IFACE="\$1"
logger -t vpn-route "PPP interface \$IFACE down, cleaning routes"

ip route del ${VPN_SUBNET} dev \$IFACE 2>/dev/null || true

logger -t vpn-route "Route removed: ${VPN_SUBNET}"
SCRIPT

chmod +x /etc/ppp/ip-down.d/99-vpn-routes.sh
echo "  ✓ ip-down.d script created"

# 5. If PPP is currently up, add route immediately
echo ""
echo "[5/5] Checking current PPP status..."
PPP_IFACE=$(ip -o link show | grep "ppp" | awk -F': ' '{print $2}' | head -1)

if [ -n "$PPP_IFACE" ]; then
    PEER_IP=$(ip route | grep "$PPP_IFACE" | grep "proto kernel" | awk '{print $1}' | head -1)
    if [ -z "$PEER_IP" ]; then
        PEER_IP="$VPN_GATEWAY"
    fi
    echo "  PPP interface found: $PPP_IFACE"
    ip route replace $VPN_SUBNET via $PEER_IP dev $PPP_IFACE metric 100 2>/dev/null || \
    ip route add $VPN_SUBNET via $PEER_IP dev $PPP_IFACE metric 100 2>/dev/null || true
    echo "  ✓ Route added immediately: $VPN_SUBNET via $PEER_IP dev $PPP_IFACE"
else
    echo "  ⚠ No PPP interface active. Route will be added when L2TP connects."
fi

echo ""
echo "============================================"
echo " Setup Complete!"
echo "============================================"
echo ""
echo " Routes will be auto-configured when L2TP/PPTP/SSTP connects."
echo " To verify after connecting:"
echo "   ip route show | grep ppp"
echo "   ping $VPN_GATEWAY"
echo "   sudo bash $0 --status"
echo ""
echo " FreeRADIUS must listen on all interfaces (0.0.0.0)."
echo " Check: grep -i 'ipaddr' /etc/freeradius/3.0/sites-enabled/default"
echo ""
echo " For persistent iptables rules (survives reboot):"
echo "   netfilter-persistent save   (Debian/Ubuntu)"
echo "   service iptables save       (CentOS/RHEL)"
echo ""
