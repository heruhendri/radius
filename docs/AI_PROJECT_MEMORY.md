# AI Project Memory - AIBILL RADIUS Management System

> **Last Updated:** December 31, 2025  
> **Purpose:** Comprehensive project context for AI assistance - prevents repetitive troubleshooting and provides instant project understanding

---

## 📋 Project Overview

**Project Name:** AIBILL RADIUS Management System  
**Type:** Full-stack Billing & RADIUS Management for ISP  
**Target:** Internet Service Providers (ISP) managing MikroTik routers via RADIUS authentication

### Tech Stack

```yaml
Frontend:
  - Framework: Next.js 16.0.8 (App Router, Turbopack experimental)
  - UI: TailwindCSS with custom cyberpunk/neon theme
  - Components: Shadcn UI, custom CyberCard/CyberButton
  - Icons: Lucide React
  - Charts: Recharts
  - Notifications: SweetAlert2
  - i18n: Custom hook (Indonesian/English)

Backend:
  - Runtime: Node.js with Next.js API Routes
  - Database: PostgreSQL with Prisma ORM v6.19.0
  - Authentication: NextAuth.js with JWT + session
  - API: REST API with Next.js route handlers
  - External APIs: MikroTik RouterOS API

Infrastructure:
  - RADIUS: FreeRADIUS 3.x with PostgreSQL backend
  - VPN: xl2tpd + strongSwan (L2TP/IPSec client)
  - Server: Ubuntu VPS (Proxmox LXC containers)
  - SSH: sshpass for remote VPS management
  - Deployment: PM2, Nginx reverse proxy

Build Configuration:
  - Turbopack: experimental.cpus = 1 (low-resource VPS optimization)
  - Build command: npx prisma generate && next build
  - Static export: 255 pages generated
  - Force dynamic: Customer portal pages use SSR
```

---

## 🗄️ Database Schema (Prisma)

### Core Tables

```prisma
User (Staff/Admin)
  - id, email, name, username, password (hashed)
  - role: ADMIN | STAFF | OWNER
  - isActive, permissions[]
  - Managed by admin panel

Customer (End Users)
  - id, name, email, phone, address
  - username (RADIUS), password (hashed)
  - depositBalance, autoRenewal settings
  - Package subscription
  - status, installedDate, coordinates (GPS)

Package
  - id, name, type (HOTSPOT|PPPOE)
  - price, speed (upload/download)
  - billingCycle (DAILY|WEEKLY|MONTHLY)
  - profileName (MikroTik profile)
  - nasId (Router assignment)

Nas (Router/Network Access Server)
  - id, nasname, shortname, secret
  - server (IP address), ports
  - type (mikrotik|other)
  - Multiple NAS can have same IP (different ports)

Invoice
  - id, customerId, amount, status
  - dueDate, paidDate, invoiceNumber
  - Auto-generated, manual payment support

Payment
  - id, customerId, invoiceId, amount
  - paymentMethod, status, date
  - Tracks customer payments

Notification
  - id, title, message, type
  - targetType (ALL|CUSTOMER|STAFF)
  - Broadcast system for announcements

VpnServer
  - id, name, host, port
  - L2TP/IPSec server configuration
  - Used for VPN tunneling to remote routers

VpnClient
  - id, name, vpnServerId, vpnIp
  - L2TP client config for VPS
  - Allows access to remote private networks
```

### RADIUS Tables (FreeRADIUS Integration)

```sql
radcheck - User authentication (username, password)
radreply - User reply attributes
radgroupcheck - Group authentication settings
radgroupreply - Group reply attributes (speed limits, quotas)
radusergroup - User to group mapping
radacct - Accounting records (sessions, bandwidth)
radpostauth - Authentication log
nas - NAS devices (synced with Nas table)
```

---

## 🎨 Frontend Architecture

### Customer Portal (Hardcoded Indonesian)

**Files:**
- `src/app/customer/page.tsx` - Dashboard
- `src/app/customer/history/page.tsx` - Payment history
- `src/app/customer/tickets/create/page.tsx` - Support tickets
- `src/app/customer/layout.tsx` - Navigation layout

**Key Features:**
- ✅ Hardcoded Indonesian translations (no i18n hook)
- ✅ `export const dynamic = 'force-dynamic'` on all pages (fix SSR prerender error)
- ✅ Cyberpunk theme with neon effects (cyan-400, purple glow)
- ✅ Balance display: Deposit balance + Auto renewal toggle
- ✅ WiFi info: SSID, Password, Status
- ✅ Invoice list: Paid/Unpaid with payment links

**Translation Fix (Dec 2024):**
```typescript
// BEFORE: Using useTranslation hook (caused build errors)
const { t } = useTranslation();

// AFTER: Hardcoded translations
const translations: Record<string, string> = {
  'auth.logout': 'Keluar',
  'customer.depositBalance': 'Saldo Deposit',
  // ... 70+ keys
};
const t = (key: string) => translations[key] || key;
```

### Admin Panel

**Navigation Structure:**
```
📊 DASHBOARD
🏢 PERUSAHAAN (Company Settings)
👥 CUSTOMER
  ├── Pelanggan Aktif
  ├── Pelanggan Isolir
  ├── Import Pelanggan
💰 BILLING
  ├── Invoice
  ├── Payment
  ├── Paket
🔧 ROUTER (Router & Jaringan)
  ├── Router / NAS
  ├── VPN Server
  ├── VPN Client
📡 WIFI (Hotspot)
  ├── Voucher
  ├── Active Sessions
📢 NOTIFIKASI
  ├── Broadcast
  ├── Template Email
  ├── Log Notifikasi
⚙️ SYSTEM
  ├── User Management
  ├── Monitoring
  ├── Activity Log
```

**Cyberpunk Theme Components:**
- CyberCard: `components/cyberpunk/CyberCard.tsx`
- CyberButton: `components/cyberpunk/CyberButton.tsx`
- Colors: cyan (#00f7ff), purple (#bc13fe), dark backgrounds
- Effects: glow, backdrop blur, border animations

---

## 🔐 Authentication & Authorization

### Customer Login
- **Endpoint:** `/api/auth/customer/login`
- **Method:** Username/Password → JWT token
- **Bypass:** Admin can login as customer (audit trail logged)
- **Session:** Stored in HTTP-only cookie

### Staff/Admin Login
- **NextAuth.js** with credentials provider
- **Permissions:** Granular (customers.view, customers.edit, etc.)
- **Roles:** ADMIN (full access), STAFF (limited), OWNER (read-only)

---

## 🌐 VPN & Network Architecture

### L2TP/IPSec Client Setup (VPS Side)

**Purpose:** Connect VPS to remote MikroTik routers via VPN for private network access

**Configuration Files:**
```bash
/etc/xl2tpd/xl2tpd.conf         # L2TP client config
/etc/ppp/options.l2tpd.client   # PPP options
/etc/ppp/chap-secrets            # CHAP authentication
/etc/ipsec.conf                  # IPSec configuration
/etc/ipsec.secrets               # IPSec PSK
```

**Common Issues & Fixes:**

1. **pppd exit code 2** (Authentication failed)
   - ❌ **Cause:** Empty `/etc/ppp/chap-secrets`
   - ✅ **Fix:** Add credentials: `username * password *`

2. **Duplicate settings conflict**
   - ❌ **Cause:** `name`, `password`, `plugin pppol2tp.so` in options.l2tpd.client
   - ✅ **Fix:** Remove duplicates (already in xl2tpd.conf)

3. **Interface name varies** (ppp0, ppp1, ppp2)
   - ❌ **Old code:** Only checks `ppp0`
   - ✅ **Fix:** Check all PPP interfaces with `grep ppp.*UP`

**Verified Working Config:**

`/etc/xl2tpd/xl2tpd.conf`:
```ini
[global]
port = 1701
access control = no

[lac vpn-server]
lns = 103.146.202.131  # VPN server IP
require chap = yes
refuse pap = yes
require authentication = yes
name = vpn-server-radius-8jzk
ppp debug = yes
pppoptfile = /etc/ppp/options.l2tpd.client
length bit = yes
autodial = yes
redial = yes
redial timeout = 15
```

`/etc/ppp/chap-secrets`:
```
# MUST NOT BE EMPTY!
vpn-server-radius-8jzk * CBLyyd06qzUL *
```

`/etc/ppp/options.l2tpd.client`:
```
# NO duplicate name/password/plugin here!
ipcp-accept-local
ipcp-accept-remote
refuse-eap
require-mschap-v2
noccp
noauth
nodefaultroute
usepeerdns
debug
connect-delay 5000
```

**Test Commands:**
```bash
# Start VPN
sudo systemctl start strongswan-starter
sudo systemctl start xl2tpd
echo "c vpn-server" | sudo tee /var/run/xl2tpd/l2tp-control

# Check status
ip addr show | grep -A3 ppp
ping -c 3 172.20.30.1  # VPN gateway

# View logs
sudo journalctl -u xl2tpd -n 30
```

### API: `/api/network/vpn-server/l2tp-control`

**Actions:**
- `configure` - Setup L2TP client config and connect
- `start` - Start services and connect
- `stop` - Disconnect and stop services
- `restart` - Reconnect VPN
- `status` - Check service and interface status
- `enable` - Enable auto-start on boot
- `disable` - Disable auto-start
- `logs` - Fetch recent logs
- `connections` - List active sessions

**Recent Fixes (Dec 29, 2024):**
1. ✅ Added CHAP secrets file creation
2. ✅ Removed duplicate settings from options file
3. ✅ Fixed PPP interface detection (check all, not just ppp0)
4. ✅ Increased sleep time 5s → 8s for connection establishment
5. ✅ Better logging and error messages

---

## 📦 Key Features

### Billing System

**Prepaid/Postpaid:**
- Customers can have deposit balance (prepaid)
- Auto-renewal: Deduct from balance when package expires
- Manual payment: Admin records payment → auto-activate

**Invoice Generation:**
- Auto-generated monthly/daily based on package cycle
- Invoice number format: `INV-YYYYMMDD-XXX`
- Overdue notifications via email/WhatsApp

**Payment Methods:**
- Manual recording by admin
- Integration with payment gateways (configurable)

### RADIUS Integration

**Sync to FreeRADIUS:**
- Customer → radcheck (username, Cleartext-Password)
- Package → radgroupreply (speed limits via Mikrotik-Rate-Limit)
- NAS → nas table (router credentials)

**Change of Authorization (CoA):**
- Speed limit changes → Send CoA to MikroTik
- Disconnect user → Send Disconnect-Request
- Real-time enforcement via RADIUS

**Accounting:**
- Session tracking via radacct
- Bandwidth monitoring
- Online user detection

### GPS Location Tracking

**Customer Installation:**
- GPS coordinates stored on customer record
- Map view of all customers
- Route planning for technicians

### Voucher System (Hotspot)

**Generate Vouchers:**
- Batch creation with configurable prefix
- Time-based or quota-based
- Print-ready format

**Expiration Handling:**
- Timezone-aware expiration (WIB/UTC)
- Auto-disable expired vouchers

### Notification System

**Broadcast:**
- Send to ALL, CUSTOMER, or STAFF
- Email + WhatsApp integration
- Template system for automation

**Auto Notifications:**
- Invoice overdue reminders
- Payment confirmation
- Package expiration warnings
- Maintenance announcements

**Templates:**
- Email templates with variables
- WhatsApp message templates
- Multilingual support

### Import/Export

**Import Customers:**
- CSV upload with validation
- Auto-create RADIUS accounts
- Assign packages automatically

**Import PPPoE Users:**
- Migrate from existing MikroTik
- Parse PPPoE secrets
- Bulk import with package mapping

---

## 🐛 Known Issues & Fixes

### FreeRADIUS MS-CHAP Authentication (December 31, 2025)

**Issue:** PPPoE authentication fails with "No NT-Password. Cannot perform authentication"
- **Cause 1:** OpenSSL 3.0+ disables MD4 algorithm by default (needed for NT-Password hash)
- **Cause 2:** FreeRADIUS Auth-Type uses wrong case `MS-CHAP` instead of `mschap`

**Fix 1: Enable OpenSSL Legacy Provider**
```bash
# Edit /etc/ssl/openssl.cnf
# In [provider_sect], add:
legacy = legacy_sect

# Add new section:
[legacy_sect]
activate = 1

# Verify MD4 works:
echo -n "test" | openssl dgst -md4
```

**Fix 2: Use lowercase Auth-Type mschap**
```
# In /etc/freeradius/3.0/sites-enabled/default
authenticate {
    Auth-Type PAP { pap }
    Auth-Type CHAP { chap }
    # MUST be lowercase 'mschap', NOT 'MS-CHAP'
    Auth-Type mschap { mschap }
}
```

**Test MS-CHAP:**
```bash
radtest -t mschap 'username@realm' 'password' 127.0.0.1 0 'testing123'
# Should return Access-Accept with MS-CHAP-MPPE-Keys
```

### Timezone Display in Auth Logs

**Issue:** Auth log timestamps showing +7 hours offset (double timezone conversion)
- **Cause:** FreeRADIUS stores time in local timezone (WIB), but `formatWIB()` adds +7 again
- **Fix:** Use `formatLocalDate()` for FreeRADIUS timestamps (radpostauth, radacct)

```typescript
// In src/lib/timezone.ts - use formatLocalDate for RADIUS data
import { formatLocalDate } from '@/lib/timezone';
formatLocalDate(log.authdate, 'dd MMM yyyy HH:mm:ss');  // No timezone conversion
```

### Build Errors

**Issue:** `ReferenceError: t is not defined` on production build
- **Cause:** Next.js 16 Turbopack prerendering client components
- **Fix:** Hardcode translations + `export const dynamic = 'force-dynamic'`

**Issue:** Prisma client not generated
- **Cause:** Clean install without generate step
- **Fix:** `npx prisma generate` before build

### Translation Issues

**Issue:** Duplicate "nav" key in locale files
- **Cause:** Customer nav and admin nav both using "nav"
- **Fix:** Renamed to "customerNav" for customer portal

### VPN Connection Issues

**Issue:** VPN connects but shows "Not connected" in UI
- **Cause:** Status check only looks for ppp0 interface
- **Fix:** Check all PPP interfaces (ppp0, ppp1, ppp2, etc.)

**Issue:** pppd exits with code 2 immediately after start
- **Cause:** CHAP credentials missing in /etc/ppp/chap-secrets
- **Fix:** Automatically create chap-secrets in configure action

---

## ⚙️ Configuration Files

### Important Paths

```yaml
Application:
  - Config: next.config.ts, tsconfig.json, ecosystem.config.js
  - Database: prisma/schema.prisma
  - Migrations: prisma/migrations/
  - Seeds: prisma/seeds/

Deployment:
  - Scripts: deploy.sh, vps-install.sh, vps-update.sh
  - PM2: ecosystem.config.js (app name: salfanet-radius)
  - Nginx: /etc/nginx/sites-available/salfanet-radius

RADIUS:
  - Config: freeradius-config/ (clients, modules, sites)
  - Sync: FreeRADIUS reads from PostgreSQL (radcheck, radreply, etc.)

VPN:
  - xl2tpd: /etc/xl2tpd/xl2tpd.conf
  - PPP: /etc/ppp/options.l2tpd.client, /etc/ppp/chap-secrets
  - IPSec: /etc/ipsec.conf, /etc/ipsec.secrets
```

### Environment Variables (.env)

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/radius"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="random-secret-key"

# App Config
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# External APIs (optional)
WHATSAPP_API_URL=""
WHATSAPP_API_KEY=""
```

---

## 🚀 Deployment

### VPS Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd AIBILL-RADIUS-main

# 2. Install dependencies
npm install

# 3. Setup database
npx prisma migrate deploy
npx prisma generate
npm run seed

# 4. Build application
npm run build

# 5. Start with PM2
pm2 start ecosystem.config.js
pm2 save
```

### Update Deployment

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Run migrations
npx prisma migrate deploy
npx prisma generate

# Rebuild
npm run build

# Restart PM2
pm2 restart salfanet-radius
```

### Low-Resource VPS Optimization

**next.config.ts:**
```typescript
experimental: {
  turbo: {
    cpus: 1  // Limit CPU usage
  }
}
```

**Build with limited resources:**
```bash
NODE_OPTIONS="--max-old-space-size=512" npm run build
```

---

## 📝 Recent Changes Log

### December 29, 2024

**L2TP Control API Fixes:**
1. ✅ Added automatic CHAP secrets file creation
2. ✅ Removed duplicate settings from PPP options
3. ✅ Fixed PPP interface detection (all interfaces, not just ppp0)
4. ✅ Increased connection wait time (5s → 8s)
5. ✅ Improved logging and error messages

**Documentation Updates:**
1. ✅ VPN_CLIENT_SETUP_GUIDE.md - Added troubleshooting section
2. ✅ PROXMOX_L2TP_SETUP.md - Added pppd exit code 2 fix
3. ✅ Created AI_PROJECT_MEMORY.md - This file!

**Customer Portal:**
1. ✅ Hardcoded Indonesian translations (no i18n hook)
2. ✅ Fixed build errors with `export const dynamic = 'force-dynamic'`
3. ✅ Applied cyberpunk theme to ticket creation page
4. ✅ Fixed balance card button layout (2-row design)

### December 28, 2024

**Translation System:**
1. ✅ Renamed duplicate "nav" to "customerNav"
2. ✅ Added 70+ translation keys for customer portal
3. ✅ Fixed missing invoice and navigation translations

---

## 🎯 Development Guidelines

### Adding New Features

1. **Database changes:**
   ```bash
   # Edit schema
   vim prisma/schema.prisma
   
   # Create migration
   npx prisma migrate dev --name feature_name
   
   # Update types
   npx prisma generate
   ```

2. **API routes:**
   - Location: `src/app/api/[category]/[endpoint]/route.ts`
   - Use NextResponse for responses
   - Validate inputs with Prisma schemas
   - Handle errors gracefully

3. **Frontend components:**
   - Use CyberCard/CyberButton for consistency
   - Follow cyberpunk color scheme
   - Add loading states
   - Use SweetAlert2 for notifications

### Code Style

```typescript
// ✅ Good: Use TypeScript interfaces
interface Customer {
  id: string;
  name: string;
  email: string;
}

// ✅ Good: Async/await with try-catch
try {
  const customers = await prisma.customer.findMany();
  return NextResponse.json({ success: true, customers });
} catch (error) {
  return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}

// ✅ Good: Separate concerns
const fetchData = async () => { /* ... */ }
const handleSubmit = async (e: FormEvent) => { /* ... */ }
```

### Testing VPN Connection

```bash
# 1. Disconnect existing
echo "d vpn-server" | sudo tee /var/run/xl2tpd/l2tp-control
sudo systemctl stop xl2tpd strongswan-starter

# 2. Clean config
sudo rm -f /etc/xl2tpd/xl2tpd.conf
sudo rm -f /etc/ppp/options.l2tpd.client
sudo rm -f /etc/ppp/chap-secrets

# 3. Use L2TP Control API from web interface
# - Input all credentials
# - Click "Configure & Connect"
# - Wait 8-10 seconds
# - Check logs if failed

# 4. Manual verification
ip addr show | grep -A3 ppp
ping -c 3 <VPN_GATEWAY_IP>
```

---

## 📚 Documentation Index

### Setup & Deployment
- [PROXMOX_VPS_SETUP_GUIDE.md](./PROXMOX_VPS_SETUP_GUIDE.md) - VPS initial setup
- [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) - Application deployment
- [VPS_OPTIMIZATION_GUIDE.md](./VPS_OPTIMIZATION_GUIDE.md) - Performance tuning

### VPN & Network
- [VPN_CLIENT_SETUP_GUIDE.md](./VPN_CLIENT_SETUP_GUIDE.md) - L2TP client setup
- [PROXMOX_L2TP_SETUP.md](./PROXMOX_L2TP_SETUP.md) - Proxmox LXC L2TP fixes
- [MIKROTIK_RADIUS_COA_COMPLETE_SETUP.md](./MIKROTIK_RADIUS_COA_COMPLETE_SETUP.md) - RADIUS CoA
- [MIKROTIK_COA_SETUP.md](./MIKROTIK_COA_SETUP.md) - Change of Authorization

### Features
- [COMPREHENSIVE_FEATURE_GUIDE.md](./COMPREHENSIVE_FEATURE_GUIDE.md) - All features
- [CUSTOMER_WIFI_SELFSERVICE.md](./CUSTOMER_WIFI_SELFSERVICE.md) - Customer portal
- [VOUCHER_EXPIRATION_TIMEZONE_FIX.md](./VOUCHER_EXPIRATION_TIMEZONE_FIX.md) - Voucher system
- [IMPORT_PPPOE_USERS.md](./IMPORT_PPPOE_USERS.md) - Bulk import

### Billing & Notifications
- [PREPAID_POSTPAID_IMPLEMENTATION.md](./PREPAID_POSTPAID_IMPLEMENTATION.md) - Billing system
- [BALANCE_AUTO_RENEWAL.md](./BALANCE_AUTO_RENEWAL.md) - Auto-renewal
- [MANUAL_PAYMENT_AND_NOTIFICATION_SYSTEM.md](./MANUAL_PAYMENT_AND_NOTIFICATION_SYSTEM.md)
- [BROADCAST_NOTIFICATION_SYSTEM.md](./BROADCAST_NOTIFICATION_SYSTEM.md)

### Troubleshooting
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [COA_TROUBLESHOOTING_WORKFLOW.md](./COA_TROUBLESHOOTING_WORKFLOW.md) - RADIUS CoA issues
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing procedures

---

## 💡 AI Assistant Tips

### When Helping with This Project:

1. **Always check this file first** before asking repetitive questions
2. **VPN issues?** → Check L2TP section above for known fixes
3. **Build errors?** → Check Known Issues section
4. **Database changes?** → Remember to run `npx prisma generate`
5. **Translation issues?** → Customer portal uses hardcoded Indonesian
6. **Adding features?** → Follow Development Guidelines section

### Common Commands Reference

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Production build
npm run start                  # Production server

# Database
npx prisma studio              # Database GUI
npx prisma migrate dev         # Create migration
npx prisma generate            # Generate types
npm run seed                   # Seed database

# VPN Management
sudo systemctl status xl2tpd   # Check VPN status
sudo journalctl -u xl2tpd -n 30  # View logs
ip addr show | grep ppp        # Check PPP interfaces

# Deployment
pm2 status                     # Check PM2 status
pm2 logs salfanet-radius       # View app logs
pm2 restart salfanet-radius    # Restart app
```

### File Locations Quick Reference

```
Customer Portal:  src/app/customer/
Admin Panel:      src/app/admin/
API Routes:       src/app/api/
Components:       src/components/
Database:         prisma/schema.prisma
VPN Config:       freeradius-config/
Documentation:    docs/
```

---

**🤖 This file is automatically updated when significant changes are made to the project.**

**For questions or additions, check the documentation index or recent changes log above.**
