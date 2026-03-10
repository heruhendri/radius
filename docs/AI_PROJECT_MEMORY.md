03+52#.6981------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ AI Project Memory - Salfanet RADIUS Management System
**For questions or additions, check the documentation index or recent changes log above.**

| 2.10.24 | 7 Mar 2026 | **Customer Referral System Complete** � DB migration 20260307_add_referral_system (referral_rewards table, referralCode/referred_by_id fields, referral config in companies). APIs: /api/customer/referral GET+POST, /api/customer/referral/rewards. Admin: /admin/referrals, /admin/settings/referral. Customer portal: /customer/referral (code gen, share URL, stats, rewards tab). Reward triggers: REGISTRATION (on admin approve) + FIRST_PAYMENT (webhook). Admin sidebar: Gift icon + nav.referral group. nav keys id.json. |
| 2.10.25 | 8 Mar 2026 | **Session 31 Bug Fixes** -- PPPoE cron stuck-true fix (isPPPoeSyncRunning->finally). Payment URL localhost skip (3 customer portal files). Webhook POSTPAID: expiry dari max(expiredAt,now)+validity. CoA: direct disconnectPPPoEUser(). Admin PUT: same max logic, billingDay removed. CyberToast dedup: sessionStorage ID-dedup + stable addToastRef. Duitku: BV=BSI VA, BC=BCA VA + MIN_AMOUNTS. Invoice catch-up cron. FreeRADIUS audit: IN SYNC. Installer & export-production validated. |
| 2.10.26 | 10 Mar 2026 | **Session 32 API Response Wrapper Fix** -- CRITICAL: `ok()` and `created()` in `src/lib/api-response.ts` wrapped ALL responses in `{ data: ... }` but ALL frontends read flat top-level keys (e.g. `data.vouchers`). Caused 0 vouchers/users showing despite 35k+ in DB. Fixed: removed wrapper, return flat JSON. Added `success: true` to notifications GET and invoices DELETE responses. Added delete overlay (batch/checkbox/expired) to voucher page. VPS deploy: pscp direct file upload + rebuild required (rsync issue). Files: api-response.ts, notifications/route.ts, invoices/route.ts, voucher/page.tsx. PM2 #478-479. |
**For questions or additions, check the documentation index or recent changes log above.**
03+52#.6981------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ AI Project Memory - Salfanet RADIUS Management System

> **Last Updated:** March 10, 2026 (Session 33 -- Customer Payment Channel Selection)  
> **Purpose:** Comprehensive project context for AI assistance - prevents repetitive troubleshooting and provides instant project understanding

---

## ?? Project Overview

**Project Name:** Salfanet RADIUS Management System  
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
  - Notifications: CyberToast (custom). Admin panel + Customer portal FULLY CLEAN (0 Swal). All 19 Swal calls migrated to CyberToast (Mar 1, 2026).
  - Theme: Dark/Light toggle via `useTheme` hook + `localStorage` (dark default). Instant switch � `theme-no-transition` CSS class kills all transition/animation during toggle.
  - i18n: Custom hook (Indonesian/English)

Backend:
  - Runtime: Node.js with Next.js API Routes
  - Database: MySQL 8.0 with Prisma ORM v6.19.0  ? MYSQL, bukan PostgreSQL!
  - Authentication: NextAuth.js with JWT + session
  - API: REST API with Next.js route handlers
  - External APIs: MikroTik RouterOS API

Infrastructure:
  - RADIUS: FreeRADIUS 3.x with PostgreSQL backend
  - VPN: xl2tpd + strongSwan (L2TP/IPSec client), PPTP, SSTP
  - Server: Ubuntu VPS (Proxmox LXC containers)
  - VPS IP: 103.151.140.110 (user: root / pass: Seven789@)
  - Domain: radius.hotspotapp.net via Cloudflare proxy (100s hard timeout!)
  - SSH: plink/pscp (PuTTY tools) � sshpass NOT used on Windows
  - Deployment: PM2 (cluster mode, app: salfanet-radius), Nginx reverse proxy
  - MikroTik CHR: Diakses via VPN tunnel (ppp0: 10.20.30.10/VPS ? 10.20.30.1/CHR)
    - CHR API: **10.20.30.11**, port **8728**, user `api-test1`, pass `eS3R4AHljRGGTZVd`
    - Public IP CHR: 103.146.202.131 (hanya untuk referensi, API diakses via tunnel)
    - NAS secret: `1O2EK65yEBwAB5ap`
    - ?? Gunakan IP LAN 10.20.30.11:8728, bukan 103.146.202.131:9595 yang lama!
  - DB Credentials: mysql://salfanet_user:salfanetradius123@localhost:3306/salfanet_radius
  - Redis: localhost:6379 (used for RADIUS auth cache, online sessions)

Build Configuration:
  - Turbopack: experimental.cpus = 1 (low-resource VPS optimization)
  - Build command: npx prisma generate && next build
  - Static export: 255 pages generated
  - Force dynamic: Customer portal pages use SSR
```

---

## ??? Database Schema (Prisma)

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
  - L2TP/PPTP/SSTP client config for VPS
  - vpnType stored UPPERCASE in DB: 'L2TP' | 'PPTP' | 'SSTP'
  - ?? CRITICAL: loadVpnClients() must call .toLowerCase() on vpnType!
    Without this, all Quick Fill dropdowns show empty.
  - Fix is in: src/app/admin/network/vpn-server/page.tsx line ~111
    `vpnType: (c.vpnType || 'l2tp').toLowerCase()`
  - Allows access to remote private networks

pppoeUser (PPPoE Customers)
  - id, username, password (RADIUS credentials)
  - name, phone, email, address
  - profileId, routerId, areaId
  - status: active | stopped | isolated | expired
  - ipAddress, macAddress (optional static IP/MAC)
  - comment (admin notes)
  - subscriptionType: PREPAID | POSTPAID
  - billingDay, balance, autoRenewal, autoIsolationEnabled
  - expiredAt (PREPAID: expiry date, POSTPAID: null)
  - latitude, longitude (GPS coords for installation)
  - connectionType: PPPOE | other
  - fcmTokens (push notification tokens)
  --- Customer Documents & Installation (added Feb 27, 2026) ---
  - idCardNumber String? @db.VarChar(50)  // NIK KTP
  - idCardPhoto  String? @db.VarChar(500) // URL foto KTP
  - installationPhotos Json?              // Array of installation photo URLs
  - followRoad   Boolean @default(false)  // Garis ke ODP ikuti jalanan
  --- Suspend Request Relation (added Feb 28, 2026) ---
  - suspendRequests suspendRequest[]         // Self-service suspend requests
  @@map("pppoe_users")
```

### suspendRequest Model (added Feb 28, 2026)

```prisma
suspendRequest
  - id          String          @id @default(cuid())
  - userId      String          // FK to pppoeUser
  - status      String          @default("PENDING")  // PENDING|APPROVED|REJECTED|CANCELLED|COMPLETED
  - reason      String?
  - startDate   DateTime
  - endDate     DateTime
  - adminNotes  String?
  - requestedAt DateTime        @default(now())
  - approvedAt  DateTime?
  - approvedBy  String?         // Admin username
  - updatedAt   DateTime        @updatedAt
  @@map("suspend_requests")
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

## ?? Frontend Architecture

### Customer Portal (Hardcoded Indonesian)

**Files:**
- `src/app/customer/page.tsx` - Dashboard
- `src/app/customer/history/page.tsx` - Payment history
- `src/app/customer/tickets/create/page.tsx` - Support tickets
- `src/app/customer/layout.tsx` - Navigation layout

**Key Features:**
- ? Hardcoded Indonesian translations (no i18n hook)
- ? `export const dynamic = 'force-dynamic'` on all pages (fix SSR prerender error)
- ? Cyberpunk theme with neon effects (cyan-400, purple glow)
- ? Balance display: Deposit balance + Auto renewal toggle
- ? WiFi info: SSID, Password, Status
- ? Invoice list: Paid/Unpaid with payment links

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

**Navigation Structure (Flat `menuItems` Array � Updated Mar 5, 2026):**

Sidebar renders a flat `menuItems: MenuItem[]` array. Each item either has `href` (standalone link) or `children[]` (collapsible sub-group). There are NO explicit category headers rendered in code � categories only exist visually if added in JSX. `NavItem` component handles both types.

```
?? Dashboard               ? href: /admin
?? Komunikasi              ? children group (Mar 5, 2026 � moved above PPPoE)
  +-- Notifikasi            ? href: /admin/notifications (badge: unread count)
  +-- Push Notifikasi       ? href: /admin/push-notifications
?? PPPoE                   ? children group
  +-- Pengguna
  +-- Profil
  +-- Area
  +-- Stop Langganan
  +-- Registrasi (badge: pending)
?? Hotspot                 ? children group
  +-- Voucher, Rekap, Profil, Template, Agen, E-Voucher
?? Invoice                 ? href: /admin/invoices
?? Pembayaran              ? children group
  +-- Payment Gateway
  +-- Pembayaran Manual (badge: pending count)
?? Transaksi               ? href: /admin/keuangan
?? Sesi                    ? children group (PPPoE + Hotspot sessions)
?? Router                  ? children group (NAS, VPN Server, VPN Client)
?? Jaringan                ? children group (Map, OLT, ODC, ODP, ODP Customer)
?? GenieACS                ? children group (Devices, Tasks, VirtualParams, Config)
?? FreeRADIUS              ? children group (Status, Config, RadTest, RadCheck, Logs)
?? Inventory               ? children group (Items, Movements, Categories, Suppliers)
?? Tiket                   ? children group (All Tickets, Categories)
??? Manajemen               ? href: /admin/management
?? Isolasi                 ? children group (Isolated Users, Settings, Templates, MikroTik)
?? Pengaturan              ? children group (Company, Email, WA, DB, Cron, GenieACS)
```

**Key Sidebar Files:**
- Layout: `src/app/admin/layout.tsx` � contains `menuItems` array + `NavItem` component
- Translation keys: all `nav.*` keys in `src/locales/id.json`

**Key Sidebar Files:**
- Layout: `src/app/admin/layout.tsx` � contains full menu hierarchy
- CategoryItem component: collapsible section with icon + label header

**Cyberpunk Theme Components:**
- CyberCard: `components/cyberpunk/CyberCard.tsx`
- CyberButton: `components/cyberpunk/CyberButton.tsx`
- Colors: cyan (#00f7ff), purple (#bc13fe), dark backgrounds
- Effects: glow, backdrop blur, border animations

---

## ?? Authentication & Authorization

### Customer Login
- **Endpoint:** `/api/auth/customer/login`
- **Method:** Username/Password ? JWT token
- **Bypass:** Admin can login as customer (audit trail logged)
- **Session:** Stored in HTTP-only cookie

### Staff/Admin Login
- **NextAuth.js** with credentials provider
- **Permissions:** Granular (customers.view, customers.edit, etc.)
- **Roles:** ADMIN (full access), STAFF (limited), OWNER (read-only)

---

## ?? VPN & Network Architecture

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
   - ? **Cause:** Empty `/etc/ppp/chap-secrets`
   - ? **Fix:** Add credentials: `username * password *`

2. **Duplicate settings conflict**
   - ? **Cause:** `name`, `password`, `plugin pppol2tp.so` in options.l2tpd.client
   - ? **Fix:** Remove duplicates (already in xl2tpd.conf)

3. **Interface name varies** (ppp0, ppp1, ppp2)
   - ? **Old code:** Only checks `ppp0`
   - ? **Fix:** Check all PPP interfaces with `grep ppp.*UP`

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
1. ? Added CHAP secrets file creation
2. ? Removed duplicate settings from options file
3. ? Fixed PPP interface detection (check all, not just ppp0)
4. ? Increased sleep time 5s ? 8s for connection establishment
5. ? Better logging and error messages

### API: `/api/network/vpn-server/setup` (route.ts)

**Purpose:** Auto-configure MikroTik CHR via RouterOS API (node-routeros)

**?? CRITICAL CONSTRAINTS (Cloudflare proxy):**
- Cloudflare has 100s hard timeout � HTTP 524 if exceeded
- `export const maxDuration = 90` must stay at 90
- `timeout: 30` in RouterOSAPI � do NOT lower below 30 (WAN handshake can be slow)
- **MUST be single connection** � 2 connections � 30s handshake = >100s = HTTP 524

```typescript
// src/app/api/network/vpn-server/setup/route.ts
export const maxDuration = 90;  // KEEP at 90

const api = new RouterOSAPI({
  host: config.host,
  user: config.username,
  password: config.password,
  port: config.port || 8728,
  timeout: 30,  // DO NOT change. 10 = too low, 30 = correct
});
// Single connection handles ALL: pool ? profile ? L2TP ? SSTP ? PPTP ? NAT ? firewall ? close
```

### VPN Server Page (`src/app/admin/network/vpn-server/page.tsx`)

**vpnType filter (line ~127):**
```typescript
// vpnType MUST already be lowercased by loadVpnClients()!
const l2tpClientList = vpnClients.filter(c => !c.vpnType || c.vpnType === 'l2tp');
const pptpClientList = vpnClients.filter(c => c.vpnType === 'pptp' || (!c.vpnType && c.vpnServerId));
const sstpClientList = vpnClients.filter(c => c.vpnType === 'sstp' || (!c.vpnType && c.vpnServerId));
```

**PPTP/SSTP dialogs:** VPN config section + Quick Fill dropdown always visible.
Previously wrapped in `${action === 'configure' ? ... : ''}` which hid it for 'status' action.

### Nginx Config (production/nginx-salfanet-radius.conf)

Deployed to VPS at `/etc/nginx/sites-enabled/salfanet-radius`.

**Anti-cache headers for Cloudflare bypass:**
```nginx
location /api/ {
    proxy_pass http://localhost:3000;
    add_header Cache-Control "no-store, no-cache, must-revalidate";
    add_header CDN-Cache-Control "no-store";
    add_header Cloudflare-CDN-Cache-Control "no-store";
    # Result: cf-cache-status: DYNAMIC
}
```

---

## ?? Key Features

### Billing System

**Prepaid/Postpaid:**
- Customers can have deposit balance (prepaid)
- Auto-renewal: Deduct from balance when package expires
- Manual payment: Admin records payment ? auto-activate

**Invoice Generation:**
- Auto-generated monthly/daily based on package cycle
- Invoice number format: `INV-YYYYMMDD-XXX`
- Overdue notifications via email/WhatsApp

**Payment Methods:**
- Manual recording by admin
- Integration with payment gateways (configurable)

### RADIUS Integration

**Sync to FreeRADIUS:**
- Customer ? radcheck (username, Cleartext-Password)
- Package ? radgroupreply (speed limits via Mikrotik-Rate-Limit)
- NAS ? nas table (router credentials)

**Change of Authorization (CoA):**
- Speed limit changes ? Send CoA to MikroTik
- Disconnect user ? Send Disconnect-Request
- Real-time enforcement via RADIUS

**Accounting:**
- Session tracking via radacct
- Bandwidth monitoring
- Online user detection

**REST Authorize Hook (`/api/radius/authorize`):**
- Called by FreeRADIUS BEFORE authentication (via `-rest` in authorize section)
- Checks PPPoE user: blocked, stop, expiredAt ? reject with specific message
- Checks Hotspot voucher: status=EXPIRED, expiresAt past ? reject with message
- Rejection messages: `"Kode Voucher Kadaluarsa"`, `"Akun Diblokir - Hubungi Admin"`, `"Masa Aktif Habis - Segera Bayar Tagihan"` etc.
- ?? **Reply-Message muncul di browser hotspot login page, BUKAN di MikroTik system log!**
- MikroTik RouterOS log SELALU menampilkan `"login failed: invalid username or password"` untuk semua RADIUS Access-Reject � hardcoded di firmware, tidak bisa diubah
- Redis cache 60 detik untuk PPPoE auth check (reduce DB load)

**FreeRADIUS Config Layout (PENTING!):**
```
/etc/freeradius/3.0/
  sites-enabled/default      ? STANDALONE FILE (bukan symlink ke sites-available!)
  sites-available/default    ? Template lokal, TIDAK otomatis aktif
  mods-enabled/rest          ? STANDALONE FILE dengan authorize + accounting sections
  mods-available/rest        ? Template lokal
  clients.conf               ? Berisi $INCLUDE clients.d/ di akhir file
  clients.d/
    nas-from-db.conf         ? AUTO-GENERATED oleh syncNasClients() di freeradius.ts
```
?? **CRITICAL:** Pada VPS ini, `sites-enabled/default` adalah file standalone, BUKAN symlink.
Jika mengedit `sites-available/default` saja, TIDAK akan berpengaruh. Harus edit langsung
`sites-enabled/default` di VPS atau upload ke path yang benar.

?? **CRITICAL: NAS clients � JANGAN gunakan `read_clients = yes` di SQL module!**
`nas` table menggunakan UUID sebagai primary key, FreeRADIUS butuh integer ? duplicate/error.
Solusi: `read_clients = no` di SQL module, NAS dimuat dari `clients.d/nas-from-db.conf`.
`syncNasClients()` di `src/lib/freeradius.ts` otomatis regenerate file ini setiap restart.

**authorize section di sites-enabled/default (wajib ada):**
```
authorize {
    preprocess
    chap
    mschap
    files
    -rest        ? REST authorize hook ke /api/radius/authorize
    sql
    expiration   ? WAJIB ADA! Reject expired voucher/user via radcheck Expiration attribute
    pap
}
```

**BlastRADIUS Fix (Feb 2026):**
- Semua clients HARUS punya `require_message_authenticator = no` atau `= yes`
- clients.conf: `localhost` dan `localhost_ipv6` sudah di-fix
- clients.d/nas-from-db.conf: selalu include `require_message_authenticator = no`

**NAS Config Auto-Sync (Build #164):**
- `syncNasClients()` di `src/lib/freeradius.ts` kini returns `boolean` (true = file berubah)
- Idempotent: baca file saat ini, compare, tulis hanya jika berbeda
- Dipanggil di `freeradiusHealthCheck()` di `src/lib/cron/freeradius-health.ts` setiap 5 menit
- Jika config berubah ? `systemctl reload freeradius` (SIGHUP, TIDAK putus sesi aktif)
- Solusi: secret berubah di DB ? cron otomatis sync tanpa manual restart

**PPPoE Session Sync (`src/lib/cron/pppoe-session-sync.ts`) � Build #165:**
- Cron job setiap 5 menit (cron-service.js entry #16, lockTtl=120)
- Alur: query semua active router ? MikroTik API `/ppp/active/print` ? compare dengan radacct ? INSERT sesi hilang ? CLOSE sesi stale
- Solusi: FreeRADIUS restart menyebabkan Accounting-Start packet loss, MikroTik tidak resend
- INSERT query pakai `DATE_SUB(NOW(), INTERVAL ? SECOND)` untuk `acctstarttime` (MySQL native, bukan JS Date)
- Trigger manual: `POST /api/cron {"type":"pppoe_session_sync"}` dengan header `x-cron-secret`

Lokal source of truth:
- `freeradius-config/sites-available/default` � template (sudah include expiration)
- `freeradius-config/mods-available/sql` � read_clients = no
- `freeradius-config/clients.conf` � localhost blocks + $INCLUDE clients.d/
- `freeradius-config/clients.d/nas-from-db.conf` � template NAS
- `freeradius-config/mods-enabled/rest` � authorize + accounting section

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

## ?? Known Issues & Fixes

### MikroTik Script `expected end of command` � `use-vj-compression` (February 28, 2026) ? FIXED

**Symptom:** Saat script setup RADIUS di-paste ke MikroTik terminal, muncul error:
```
expected end of command (line 2 column 121)
```
**Root Cause:** Parameter `use-vj-compression` **tidak ada di RouterOS 7.x** (dihapus dari firmware). Column 121 = tepat setelah `use-compression=no `, di mana `use-vj-compression` mulai.

**Fix:** Hapus `use-vj-compression=no` dari `/ppp profile add name=salfanetradius ...` di `src/app/api/network/routers/[id]/setup-radius/route.ts`. Tambahkan `comment=` untuk konsistensi.

**Valid `/ppp profile` params (ROS 6 & 7):** `name`, `local-address`, `remote-address`, `use-compression`, `use-encryption`, `comment` � tapi BUKAN `use-vj-compression`.

---

### VPN Client Dropdown Empty (February 2026)

**Issue:** Quick Fill dropdowns in L2TP/PPTP/SSTP control show empty / "No saved clients"
- **Cause:** DB stores `vpnType` as `'L2TP'` (uppercase), filter checks `=== 'l2tp'` (lowercase) ? no match
- **Fix:** `loadVpnClients()` in `page.tsx` line ~111 uses `.toLowerCase()`:
  ```typescript
  vpnType: (c.vpnType || 'l2tp').toLowerCase()
  ```

### VPN Setup HTTP 524 (February 2026)

**Issue:** Auto-setup returns HTTP 524 (Cloudflare timeout)
- **Cause:** 2 RouterOS API connections � 30s handshake > 100s Cloudflare limit
- **Fix:** Merged to single connection. `maxDuration=90`, `timeout=30`. Never split again.

### VPN Setup "Timed out after 10 seconds" (February 2026)

**Issue:** Setup reports "Timed out after 10 seconds"
- **Cause:** `timeout: 10` was too aggressive for WAN RouterOS API handshake
- **Fix:** Restored to `timeout: 30` � WAN handshake on 103.146.202.131:9595 tested at ~20ms but RouterOS processing takes longer

### PPTP/SSTP Config Section Hidden (February 2026)

**Issue:** PPTP/SSTP control dialogs show no VPN config or Quick Fill dropdown
- **Cause:** Section wrapped in `${action === 'configure' ? ... : ''}` � buttons trigger `'status'` action
- **Fix:** Removed conditional � VPN config always rendered

### FreeRADIUS Reply-Message di MikroTik Log (February 2026)

**Problem:** MikroTik system log selalu menampilkan `"login failed: invalid username or password"` untuk voucher kadaluarsa meskipun FreeRADIUS sudah kirim `Reply-Message: "Kode Voucher Kadaluarsa"`.

**Penjelasan:** Ini adalah **perilaku normal MikroTik RouterOS firmware** � hardcoded, tidak bisa diubah:
- MikroTik system log (RouterOS `/log`) ? SELALU `"login failed: invalid username or password"` untuk SETIAP `Access-Reject`
- `Reply-Message` dari FreeRADIUS ? muncul di **browser hotspot login page** (halaman login di HP/laptop user)
- FreeRADIUS `radpostauth` table ? menyimpan reason rejection

**Debug Command:**
```bash
# Lihat detail auth attempts di FreeRADIUS:
mysql -u salfanet_user -psalfanetradius123 salfanet_radius -e "SELECT username, pass, reply, authdate FROM radpostauth ORDER BY authdate DESC LIMIT 10;"

# Debug FreeRADIUS real-time (stop systemctl dulu!):
systemctl stop freeradius
freeradius -X 2>&1 | grep -A 50 'USERNAME'
```

**CRITICAL: sites-enabled/default adalah STANDALONE FILE di VPS ini (bukan symlink!)**
```bash
# Salah (tidak berpengaruh):
scp local/sites-available/default root@vps:/etc/freeradius/3.0/sites-available/default

# Benar:
scp local/sites-enabled/default root@vps:/etc/freeradius/3.0/sites-enabled/default
# ATAU edit langsung:
python3 -c "content=open('/etc/.../sites-enabled/default').read(); ..."
```

---

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

### Prisma DateTime + MySQL Timezone Mismatch (CRITICAL � March 4, 2026)

**Issue:** Duration/uptime di web jauh berbeda dengan MikroTik (contoh: web 0 detik, MikroTik 72 menit)

**Root cause:** Prisma ORM menambahkan suffix `Z` (UTC) ke semua MySQL DATETIME fields saat dikembalikan ke Node.js. Padahal MySQL menyimpan datetime dalam local timezone (WIB / UTC+7). 
- `acctstarttime = 01:20:54` (WIB) ? Prisma return `2026-03-04T01:20:54.000Z` (interpreted as UTC)
- `new Date('2026-03-04T01:20:54.000Z').getTime()` = 7 jam lebih besar dari `Date.now()` (WIB)
- Result: `now - startMs` = **negatif** ? `Math.max(0, ...)` ? duration = 0!

**Fix di `src/app/api/sessions/route.ts`:**
```typescript
// Tambahkan di awal section mapping sessions:
const TZ_OFFSET_MS = -(new Date().getTimezoneOffset()) * 60000; // UTC+7 = 25200000ms
// Saat hitung startMs:
const startMs = acct.acctstarttime
  ? new Date(acct.acctstarttime).getTime() - TZ_OFFSET_MS
  : now;
const duration = Math.max(0, Math.floor((now - startMs) / 1000));
```

**Fix di `pppoe-session-sync.ts` (INSERT):**
```sql
-- JANGAN: INSERT ... VALUES (?, ...) -- dengan JS Date object (UTC)
-- BENAR:
INSERT INTO radacct (..., acctstarttime, ...) VALUES (..., DATE_SUB(NOW(), INTERVAL ? SECOND), ...)
-- ? = uptimeSec dari MikroTik
```

**Verifikasi:**
- DB: `TIMESTAMPDIFF(SECOND, acctstarttime, NOW())` ? harus ~sama dengan MikroTik uptime
- Node: `TZ_OFFSET_MS` harus `25200000` (7h) jika server TZ=Asia/Jakarta
- Test: `node -e "console.log(-(new Date().getTimezoneOffset()) * 60000)"` ? `25200000`

---

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

### Hotspot Session Duration Shows 0s (March 2026) ? FIXED

**Symptom:** Kolom durasi di admin sessions/hotspot page selalu menampilkan "0s" atau nilai negatif.

**Root Cause:** `firstLoginAt` dan `expiresAt` di tabel `hotspot_vouchers` disimpan sebagai DATETIME naive WIB (+07:00) di MySQL. Prisma membaca DATETIME tanpa timezone ? menambahkan suffix `Z` ? browser/Node.js memperlakukan sebagai UTC ? nilainya lebih besar 7 jam dari `Date.now()` ? countdown = negatif ? ditampilkan sebagai 0s.

**Fix (PM2 #286):** Kurangi `TZ_OFFSET_MS = -(new Date().getTimezoneOffset()) * 60000` (= 25200000ms di VPS WIB) dari semua hotspot timestamps sebelum dikirim ke browser:
```typescript
const TZ_OFFSET_MS = -(new Date().getTimezoneOffset()) * 60000; // +25200000 on WIB VPS
// For firstLoginAt:
startTime: new Date(firstLoginAt.getTime() - TZ_OFFSET_MS).toISOString()
// For expiresAt:
expiresAt: new Date(expiresAt.getTime() - TZ_OFFSET_MS).toISOString()
```
Applied in 3 places in `src/app/api/sessions/route.ts` and `src/app/api/agent/sessions/route.ts`.

### Hotspot Sessions Disappear From Admin Page When Device Is Still Online (March 2026) ? FIXED

**Symptom:** Device masih terkoneksi ke hotspot MikroTik, tapi tidak muncul di halaman admin sessions/hotspot.

**Root Cause:** MikroTik mengirim `Accounting-Stop` (reason: Lost-Carrier atau Session-Timeout) saat koneksi putus sebentar/reconnect. FreeRADIUS menyimpan `acctstoptime` di radacct. Query `WHERE acctstoptime IS NULL` tidak menemukan baris tersebut ? sesi tidak ditampilkan.

**Fix (PM2 #285):** Step 4.5 di `src/app/api/sessions/route.ts` � synthesize missing sessions dari MikroTik `/ip/hotspot/active/print`:
1. Build `liveHotspotSessions` map dari MikroTik API (semua hotspot aktif)
2. Setelah query radacct, cek username yang ada di MikroTik tapi tidak ada di hasil radacct
3. Buat synthetic session dengan `dataSource: 'live'` untuk username tersebut
4. Gunakan `parseMikrotikUptime(uptime)` helper untuk konversi format `"1h2m3s"` ? detik

### Hotspot/Agent Sessions Duration Column Shows Uptime Instead of Countdown (March 2026) ? FIXED

**Issue:** Kolom durasi menampilkan waktu yang sudah berlalu (uptime), bukan sisa waktu voucher.

**Fix (PM2 #285�287):**
- Tambah `expiresAt` ke session response API (dengan TZ correction)
- Tambah `liveCountdown()` function di frontend: `Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))`
- Tampilkan sebagai `"Xm Ys left"` dengan fallback ke uptime jika `expiresAt` null
- Applied di `src/app/admin/sessions/hotspot/page.tsx` dan `src/app/agent/sessions/page.tsx`

---

## ?? Configuration Files

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
  - Sync: FreeRADIUS reads from MySQL (radcheck, radreply, etc.)
  - ACTIVE configs (source of truth): freeradius-config/sites-enabled/default & mods-enabled/rest
  - Deploy ke VPS: upload ke /etc/freeradius/3.0/sites-enabled/ dan mods-enabled/ (standalone files)
  - Note: On VPS, sites-enabled/default & mods-enabled/sql are standalone files; rest & coa are symlinks

Scripts (only 5 utility scripts remain):
  - scripts/remove-console-logs.js � `npm run cleanup` / `npm run cleanup:dry`
  - scripts/start-ngrok.js � `npm run tunnel`
  - scripts/sync-translations.js � i18n key sync utility
  - scripts/vpn-routing-setup.sh � VPS L2TP routing infrastructure
  - scripts/patch-routeros.js � patches node-routeros for `!empty` reply in RouterOS 7.x

VPN:
  - xl2tpd: /etc/xl2tpd/xl2tpd.conf
  - PPP: /etc/ppp/options.l2tpd.client, /etc/ppp/chap-secrets
  - IPSec: /etc/ipsec.conf, /etc/ipsec.secrets
```

### Environment Variables (.env)

```bash
# Database � MySQL (BUKAN PostgreSQL!)
DATABASE_URL="mysql://salfanet_user:salfanetradius123@localhost:3306/salfanet_radius?connection_limit=10&pool_timeout=20"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="random-secret-key"

# App Config
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Redis
REDIS_URL="redis://localhost:6379"

# External APIs (optional)
WHATSAPP_API_URL=""
WHATSAPP_API_KEY=""
```

---

## ?? Deployment

### VPS Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd SALFANET-RADIUS-main

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

## ?? Recent Changes Log

### March 10, 2026 (Session 33 — Customer Payment Channel Selection + Mobile App Sync)

**Problems Fixed:**

1. **Customer topup-direct: payment method section tidak muncul** — Section dibungkus `{amount && parseInt(amount) >= 10000 && (...)}` sehingga tidak terlihat sebelum user isi nominal. Fix: hapus kondisional, section selalu tampil.
   - Tambah translation key `customer.enterAmountAbove` ke `id.json` dan `en.json`.

2. **Customer topup-direct: tidak ada pilihan channel Duitku (VA BCA, GoPay, OVO, dll)** — Hanya ada pilihan gateway ("Duitku"), bukan channel spesifik (VA BCA, VA Mandiri, OVO, ShopeePay). Fix:
   - **New API** `src/app/api/customer/payment-methods/route.ts` — GET `/api/customer/payment-methods?gateway=duitku&amount=100000`. Panggil `DuitkuPayment.getPaymentMethods(amount)`, fallback ke hardcoded list jika sandbox tidak merespons (BC=BCA VA, M2=Mandiri VA, I1=BNI VA, B1=CIMB VA, BT=Permata VA, OV=OVO, SP=ShopeePay).
   - **Frontend** `src/app/customer/topup-direct/page.tsx`:
     - Interface `PaymentChannel { code, name, totalFee?, iconUrl? }` ditambah
     - State `paymentChannels`, `selectedChannel`, `loadingChannels`
     - `loadChannels(gateway, amount)` — fetch ke API baru
     - `useEffect([selectedGateway, amount])` — auto-reload channel saat nominal/gateway berubah
     - `handleTopUp` validasi wajib pilih channel; kirim `paymentChannel` ke backend
     - UI: Step 1 (gateway selector jika > 1 gateway) + Step 2 (loading spinner / channel list dengan ikon, nama, biaya)
   - **Backend** `src/app/api/customer/topup-direct/route.ts`:
     - Terima `paymentChannel` dari body
     - Duitku: `paymentMethod: paymentChannel || 'VC'` (bukan hardcode `'SP'`)

3. **Mobile app tidak sinkron dengan web** — APK masih hanya kirim `{ amount, gateway }`, tidak ada channel selection. Fix:
   - `mobile-app/constants/index.ts` — tambah `PAYMENT_METHODS: '/api/customer/payment-methods'`
   - `mobile-app/services/topup.ts` — tambah interface `PaymentChannel`, update `TopUpRequest` + `paymentChannel?`, tambah `getPaymentChannels(gateway, amount)` method
   - `mobile-app/app/topup.tsx` — state `paymentChannels`/`selectedChannel`/`loadingChannels`, fungsi `loadChannels()`, `useEffect`, UI channel list dengan nama+biaya+checkbox, tombol disabled saat loading/tidak ada pilihan

**Files Modified:**
- `src/app/customer/topup-direct/page.tsx` — channel selection UI (frontend changes)
- `src/app/api/customer/topup-direct/route.ts` — accept + forward `paymentChannel`
- `src/app/api/customer/payment-methods/route.ts` — NEW file, fetch Duitku channels + fallback
- `mobile-app/constants/index.ts` — endpoint `PAYMENT_METHODS`
- `mobile-app/services/topup.ts` — `PaymentChannel` interface + `getPaymentChannels()` method
- `mobile-app/app/topup.tsx` — channel selection UI (mobile)

**Build:** PM2 restart after pscp upload of 3 VPS files — `salfanet-radius` online.

---

### March 10, 2026 (Session 32 — CRITICAL: API Response Wrapper Fix + Voucher Delete Overlay)

**Root Cause:**
Voucher page showed 0 vouchers despite 35,000+ in database. PPPoE users page same issue. API worked (200 OK) but frontend received empty arrays.

**Problem:**
`ok()` and `created()` helpers in `src/lib/api-response.ts` wrapped ALL responses in `{ data: ... }` (e.g., `{ data: { vouchers: [...], stats: {...} } }`), but EVERY frontend page read flat top-level keys (e.g., `data.vouchers`, `data.stats`). This caused:
- `data.vouchers` = `undefined` → treated as `[]`
- `data.stats` = `undefined` → all counts showed 0
- All admin/agent/customer pages affected (16 routes using `ok()`, 3 using `created()`)

**Fixes Applied:**

1. **src/lib/api-response.ts** (CRITICAL ROOT FIX):
   ```typescript
   // BEFORE (broken — wrapped everything):
   export const ok = <T>(data: T, meta?: Record<string, unknown>) =>
     NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status: 200 });
   export const created = <T>(data: T) =>
     NextResponse.json({ data }, { status: 201 });

   // AFTER (fixed — flat response):
   export const ok = <T>(data: T) =>
     NextResponse.json(data as never, { status: 200 });
   export const created = <T>(data: T) =>
     NextResponse.json(data as never, { status: 201 });
   ```

2. **src/app/api/notifications/route.ts**:
   - GET response: added `success: true` (required by `src/app/admin/notifications/page.tsx` line 70)
   - Response: `ok({ success: true, notifications, unreadCount, categoryCounts })`

3. **src/app/api/invoices/route.ts**:
   - DELETE responses (lines 37, 48): added `success: true` (required by invoices page line 311)
   - Bulk delete: `ok({ success: true, message: ..., deletedCount })`
   - Single delete: `ok({ success: true, message: 'Invoice deleted successfully' })`

4. **src/app/admin/hotspot/voucher/page.tsx**:
   - Removed overlay workaround: `const payload = data.data ?? data` → now reads `data.count` directly
   - Added `deleteOverlay` state with 3 phases: deleting, done, error
   - Delete overlay now shows for:
     - Batch delete ("Delete Batch" button)
     - Checkbox multi-delete ("Hapus (n)" button)
     - Expired delete ("Expired (n)" button)
   - Overlay design: red spinner during delete, green checkmark on success, auto-close after 2.5s

**VPS Deployment Issue:**
Initial `export-production.ps1` + `rsync` failed to update `api-response.ts` on VPS (file still had old wrapper code). Fix: used `pscp` to upload files directly:
```powershell
pscp src\lib\api-response.ts root@103.151.140.110:/var/www/salfanet-radius/src/lib/api-response.ts
pscp src\app\api\notifications\route.ts root@103.151.140.110:/var/www/.../
pscp src\app\api\invoices\route.ts root@103.151.140.110:/var/www/.../
pscp src\app\admin\hotspot\voucher\page.tsx root@103.151.140.110:/var/www/.../
# Then rebuild:
npm run build && pm2 restart salfanet-radius
```

**Files Modified:**
- `src/lib/api-response.ts` — removed wrapper from `ok()` and `created()`
- `src/app/api/notifications/route.ts` — added `success: true` to GET
- `src/app/api/invoices/route.ts` — added `success: true` to DELETE × 2
- `src/app/admin/hotspot/voucher/page.tsx` — delete overlay + simplified overlay logic

**Build History:**
- PM2 #478: Initial deploy with old `.next/` (rsync issue)
- PM2 #479: Direct pscp + rebuild with fixed `api-response.ts`

**Verification:**
- All vouchers (35k+) now visible in admin panel
- PPPoE users showing correctly
- Delete operations show overlay with count feedback
- HTTP 200 confirmed on `/admin/login`

---

### March 8, 2026 (Session 31 — FreeRADIUS Installer Fix, Cloudflare maxDuration, Prisma TZ Bugs, Referral System Completion)

**Problems Fixed:**
1. **FreeRADIUS installer created symlinks instead of standalone files** — `install-freeradius.sh` `restore_from_backup()` used `ln -sf` for `mods-enabled/sql` and `sites-enabled/default`. VPS requires standalone files (not symlinks). Fixed both to `cp`. `freeradius-config/mods-enabled/README.txt` corrected accordingly.
2. **Cloudflare 100s timeout: maxDuration missing/too high** — `vpn-server/setup/route.ts` had no `maxDuration` (defaulted to 60s). `vpn-server/l2tp-control/route.ts` had `maxDuration=120` (useless; Cloudflare kills at 100s). Fixed both to `export const maxDuration = 90`.
3. **Prisma TZ bugs in session-monitor.ts** — 3 `Date.now()` comparisons against FreeRADIUS-written WIB dates (`authdate`, `acctstoptime`, `acctstarttime`). Fixed to `nowWIB()` from `src/lib/timezone.ts`.
4. **Prisma TZ bug in send-otp/route.ts** — OTP rate limit `fifteenMinutesAgo` used `Date.now()` against `CustomerSession.createdAt` (MySQL `CURRENT_TIMESTAMP` = WIB). Was causing 7h15m window instead of 15min. Fixed to `nowWIB()`.
5. **Referral system: referral codes never auto-generated** — All pages/APIs were built but pppoeUser creation never set `referralCode`. Created `src/lib/referral.ts` utility (`generateUniqueReferralCode`, `ensureReferralCode`). Added auto-gen to 4 user creation paths (POST /api/pppoe/users, approve registration, sync-mikrotik, bulk import).
6. **Referral nav keys missing from id.json** — `nav.referral`, `nav.referralList`, `nav.referralSettings` existed only in `en.json`. Added Indonesian translations to `src/locales/id.json`.

**Files Modified:**
- `vps-install/install-freeradius.sh` — `ln -sf` → `cp` for mods-enabled/sql and sites-enabled/default
- `freeradius-config/mods-enabled/README.txt` — corrected to describe standalone file (not symlink)
- `src/app/api/network/vpn-server/setup/route.ts` — added `export const maxDuration = 90`
- `src/app/api/network/vpn-server/l2tp-control/route.ts` — maxDuration 120 → 90
- `src/lib/session-monitor.ts` — import `nowWIB`, fix 3 `Date.now()` → `nowWIB()` comparisons
- `src/app/api/customer/auth/send-otp/route.ts` — import `nowWIB`, fix `fifteenMinutesAgo`
- `src/lib/utils/dateUtils.ts` — corrected misleading comment about UTC storage
- `src/lib/referral.ts` — NEW: referral code generation utility
- `src/app/api/pppoe/users/route.ts` — `referralCode: await generateUniqueReferralCode()` in create
- `src/app/api/admin/registrations/[id]/approve/route.ts` — same
- `src/app/api/pppoe/users/sync-mikrotik/route.ts` — same
- `src/app/api/pppoe/users/bulk/route.ts` — same
- `src/locales/id.json` — added `nav.referral`, `nav.referralList`, `nav.referralSettings`

**TZ Architecture Clarification:**
- **Category A (WIB-as-UTC)**: FreeRADIUS-written (`acctstarttime`, `acctstoptime`, `authdate`) + MySQL `CURRENT_TIMESTAMP` fields (`createdAt` via `@default(now())`) → stored as WIB wall clock, Prisma reads as WIB-as-UTC → compare with `nowWIB()`
- **Category B (self-consistent UTC)**: App-written via `new Date()` + Prisma explicitly (`dueDate`, `expiresAt`, `paidAt`, `approvedAt`) → stored as UTC, read back as UTC → compare with `new Date()` (no TZ bug)

---

### March 7, 2026 (Session 29 � Hotspot Sessions TZ Fix, Duration Countdown, Live Session Synthesis, Agent Sessions Countdown, Notification Light Mode Fix)

**Problems Fixed:**
1. **Hotspot session duration = 0s** � `firstLoginAt`/`expiresAt` stored as WIB naive DATETIME in MySQL; Prisma appends `Z` ? treated as UTC ? 7h ahead of `Date.now()` ? countdown negative. Fix: apply `TZ_OFFSET_MS` correction on all hotspot timestamps before returning to browser.
2. **Hotspot sessions disappearing from admin page** � MikroTik sends `Accounting-Stop` (Lost-Carrier/Session-Timeout) ? FreeRADIUS sets `acctstoptime` ? `WHERE acctstoptime IS NULL` misses connected devices. Fix: step 4.5 in Sessions API synthesizes sessions from MikroTik `/ip/hotspot/active/print`.
3. **Duration showing uptime instead of countdown** � Changed to show remaining time `expiresAt - now` as "Xm Ys left".
4. **Agent sessions same issues** � Same TZ fix + countdown applied to agent sessions API and page.
5. **Notification dropdown text invisible in light mode** � `NotificationDropdown.tsx` text color fixes.
6. **Agent sessions IP/duration cells hardcoded `text-white`** � Fixed to `text-slate-900 dark:text-white`.

**Build History (PM2 #279�287):**
- PM2 #279: Voucher DELETE 400 fix for ACTIVE status
- PM2 #281: Agent dashboard `firstLoginAt` alignment
- PM2 #282: Agent sessions 1s live ticker + notification dropdown light mode colors
- PM2 #283: `startTime` returned as UTC ISO with Z suffix
- PM2 #284: Hotspot sessions always use `firstLoginAt` directly
- PM2 #285: `expiresAt` added to sessions API response; step 4.5 live session synthesis from `/ip/hotspot/active/print`; `parseMikrotikUptime()` helper; `liveHotspotSessions` map; countdown display in `hotspot/page.tsx`
- PM2 #286: `TZ_OFFSET_MS` correction for `firstLoginAt` AND `expiresAt` (3 places in `sessions/route.ts`)
- PM2 #287: Agent sessions API � same TZ fix + `expiresAt`; agent sessions page � countdown + `text-white` ? `text-slate-900 dark:text-white`; `NotificationDropdown` � text color fix

**Files Modified:**
- `src/app/api/sessions/route.ts` � PM2 #285+#286: `parseMikrotikUptime`, `liveHotspotSessions`, `expiresAt` in select, step 4.5 synthesis, TZ correction on `firstLoginAt`+`expiresAt` (3 places)
- `src/app/admin/sessions/hotspot/page.tsx` � PM2 #285: `expiresAt` in Session interface, `liveCountdown()`, countdown display
- `src/app/api/agent/sessions/route.ts` � PM2 #287: `expiresAt` in select, `firstLoginAt` TZ fix, `expiresAt` TZ-corrected in response
- `src/app/agent/sessions/page.tsx` � PM2 #287: `expiresAt` in interface, `liveCountdown()`, `text-white` ? `text-slate-900 dark:text-white`
- `src/components/agent/NotificationDropdown.tsx` � PM2 #287: message `text-slate-800`, date `text-slate-600`

**Deployed:** All files via pscp ? `npx next build` OK ? `pm2 restart salfanet-radius` ? (PM2 #285�287)

---

### March 7, 2026 (Session 28 � Isolated Portal Compact Redesign, Export Keuangan Fix, Nav Keys Fix, Config Audit)

**Changes Deployed (PM2 #264�267):**

1. **`/isolated` portal compact redesign** � Full redesign for mobile: reduced padding, single-line banner, info toggle "Selengkapnya" (collapsed by default), step list collapsible (default hidden). Added full info: area service, address, customerId, profilePrice.

2. **Sidebar nav keys fix** � Fixed missing translation keys causing raw key display in EN locale:
   - Added `nav.communication` to `src/locales/en.json`
   - Added `nav.pushNotifications` to `src/locales/id.json`
   - Moved `nav.isolation` menu entry to `catCustomer` group

3. **Export Keuangan PDF/Excel fix** � `/admin/keuangan`:
   - Removed gate `if (!startDate || !endDate)` that blocked export
   - Excel via `fetch`+`Blob`+`a.click()` instead of `window.open`
   - API export: `where` clause made optional, `categoryId`+`search` filters passed through

4. **FreeRADIUS + Nginx config audit** � Confirmed all local config files match VPS production state. No config drift found.

**Files Modified:**
- `src/app/isolated/page.tsx` � compact redesign
- `src/locales/en.json` � `nav.communication` added
- `src/locales/id.json` � `nav.pushNotifications` added
- `src/app/admin/layout.tsx` � `nav.isolation` moved to `catCustomer`
- `src/app/admin/keuangan/page.tsx` � export fix (fetch+Blob)
- `src/app/api/keuangan/export/route.ts` � date filter optional

**Deployed:** PM2 #264�267 ?

---

### March 4, 2026 (Session 24 � PPPoE Live Traffic Fix + CoA Priority Fix)

**Root Causes Fixed:**
1. **Traffic tidak bertambah**: Parameter `live=true` yang dikirim halaman PPPoE Session diabaikan di `sessions/route.ts`. Traffic dari `radacct.acctinputoctets` hanya update saat MikroTik kirim Interim-Update (default: tidak dikirim sama sekali).
2. **CoA tidak berjalan**: CoA via `radclient` dicoba PERTAMA (membutuhkan MikroTik `/radius incoming accept=yes` + port 3799 terbuka), MikroTik API hanya dipakai sebagai fallback. VPN tunnel sudah UP tapi CoA diprioritaskan di atas MikroTik API.

**1. Live Traffic Merge di Sessions API (src/app/api/sessions/route.ts)**
- Import `RouterOSAPI` dari `node-routeros`
- Tambah parameter `live` (`searchParams.get('live') === 'true'`)
- Saat `live=true` dan type PPPoE: fetch `/ppp/active/print` dari setiap active router via RouterOS API
- Build `liveTrafficMap: Map<username, {uploadBytes, downloadBytes}>`
  - `bytes-in` (MikroTik) = upload dari client ? `uploadBytes`
  - `bytes-out` (MikroTik) = download ke client ? `downloadBytes`
- Merge: `uploadBytes = liveBytes?.uploadBytes ?? radacct.acctinputoctets`
- Response `liveTraffic: liveTrafficMap.size > 0` (was always `false`)
- Jika router tidak bisa dihubungi: fallback ke data radacct (graceful degradation)
- Halaman PPPoE refresh setiap 10 detik ? traffic selalu real-time dari MikroTik API

**2. CoA Disconnect � MikroTik API First (src/app/api/sessions/disconnect/route.ts)**
- **SEBELUM**: PPPoE ? CoA dulu (radclient port 3799) ? fallback MikroTik API
- **SESUDAH**: PPPoE ? MikroTik API dulu (`/ppp/active/remove`) ? CoA fallback
- Berlaku untuk KEDUA code path: `sessionIds` dan `usernames`
- MikroTik API lebih cepat + reliable via VPN tunnel (10.20.30.11:8728)
- CoA fallback tetap ada untuk kasus VPN tunnel down

**3. NAS-IP-Address di CoA Packet (src/lib/radius-coa.ts)**
- Import `writeFile, unlink` dari `fs/promises`
- `executeRadclient`: ganti `echo '...' | radclient` ? tulis ke temp file + `< tmpFile`
  - Menghindari masalah shell quoting jika attribute value mengandung single quote
  - Cleanup temp file di `finally` block
- `sendDisconnectRequest`: tambah `NAS-IP-Address=${host}` sebagai attribute pertama
  - RFC 5176 mensyaratkan NAS-IP-Address dalam Disconnect-Request packet
  - MikroTik CHR lebih mudah match session dengan NAS-IP-Address yang benar

**4. PPP Accounting interim-update (src/app/api/network/routers/[id]/setup-radius/route.ts)**
- Step 3 script MikroTik: `/ppp aaa set use-radius=yes accounting=yes interim-update=5m`
- `interim-update=5m` causes MikroTik to send Interim-Update every 5 min ? updates radacct traffic
- Walaupun live traffic sudah fix via MikroTik API, interim-update diperlukan agar historical radacct accurate

**Files dimodifikasi:**
- `src/app/api/sessions/route.ts` � live traffic merge
- `src/app/api/sessions/disconnect/route.ts` � MikroTik API first
- `src/lib/radius-coa.ts` � NAS-IP-Address + temp file approach
- `src/app/api/network/routers/[id]/setup-radius/route.ts` � interim-update=5m

**TypeScript Check:** `npx tsc --noEmit` ? **0 errors ?**

---

### March 5, 2026 (Session 27 � UI Fixes: Modal, Logo, Sidebar, CyberToastProvider)

**Changes deployed to VPS (Build #170+):**

1. **Dialog/Modal inner padding** � `src/components/ui/dialog.tsx`: Added consistent horizontal padding to modal content so form fields don't touch the card borders. Uses Tailwind arbitrary variants.

2. **Modal title text color fix** � Added `.modal-title-override` global CSS class in `globals.css` to force visible text color for modal/dialog titles in both dark and light themes.

3. **Logo dark mode visibility fix** � Black logos uploaded by users were invisible on dark backgrounds. Fix: Added `bg-white` + `p-2` to the logo container `<div>` in all relevant pages:
   - `src/app/admin/login/page.tsx` � admin login
   - `src/app/login/page.tsx` � customer login
   - `src/app/technician/login/page.tsx` � technician login
   - `src/app/isolated/page.tsx` � isolated page
   - `src/app/customer/layout.tsx` � customer portal sidebar

4. **Sidebar reordering � Komunikasi group** � `src/app/admin/layout.tsx`:
   - Removed standalone `nav.notifications` menu item
   - Added new `nav.communication` group (icon: Bell) with two children:
     - `nav.notifications` ? `/admin/notifications` (badge: unread count)
     - `nav.pushNotifications` ? `/admin/push-notifications`
   - Placed **immediately after Dashboard**, above PPPoE/Hotspot
   - Added `"communication": "Komunikasi"` to `src/locales/id.json` nav section

5. **CyberToastProvider missing in admin root** � `src/app/admin/layout.tsx`:
   - Bug: All admin pages threw `Uncaught Error: useToast must be used within a CyberToastProvider`
   - Root cause: `CyberToastProvider` was only present in sub-layouts (sessions, customer, pay-manual) but not in the admin root layout � so pages outside those sub-layouts had no provider
   - Fix: Imported `CyberToastProvider` from `@/components/cyberpunk/CyberToast` and wrapped the entire `<SessionProvider>...</SessionProvider>` tree inside `<CyberToastProvider>` in `AdminLayout`

**Files Modified:**
- `src/components/ui/dialog.tsx` � modal padding
- `src/app/globals.css` � `.modal-title-override` class
- `src/app/admin/login/page.tsx` � logo bg-white
- `src/app/login/page.tsx` � logo bg-white
- `src/app/technician/login/page.tsx` � logo bg-white
- `src/app/isolated/page.tsx` � logo bg-white
- `src/app/customer/layout.tsx` � logo bg-white
- `src/app/admin/layout.tsx` � Komunikasi group + CyberToastProvider
- `src/locales/id.json` � `nav.communication` key added

**Deployed:** All files via pscp ? `npm run build` OK ? `pm2 restart salfanet-radius` ?

---

### March 4, 2026 (Session 26 � CoA FULLY Working + Traffic Live Fix)

**User Report:** Session 25 fixes didn't work � CoA rejected ("unknown address, dropping"), traffic still 0 B, queue rate limit unchanged.

**Root Causes Found & Fixed:**

1. **CoA source IP masqueraded**: VPS (10.20.30.10) sends CoA to MikroTik (10.20.30.11) via gateway (10.20.30.1). Gateway masquerade NAT changes source from 10.20.30.10 ? 10.20.30.1. MikroTik RADIUS config only had `address=10.20.30.10` ? rejected CoA from 10.20.30.1.
   - **Fix**: Added second RADIUS entry on MikroTik via API: `address=10.20.30.1, secret=1O2EK65yEBwAB5ap, service=ppp, require-message-auth=no, comment="CoA from VPS via gateway masquerade"`
   - Also set `require-message-auth=no` on original entry (*25) for better radclient compatibility
   - **Result**: CoA-ACK received! Queue changes confirmed (5M/5M test ? restored 10M/10M) ?

2. **Traffic live showing 0 B**: Code used `/ppp/active/print` which has NO traffic bytes (only `limit-bytes-in/out: 0`).
   - **Fix**: Changed `sessions/route.ts` to use `/interface/print ?type=pppoe-in` which has real `rx-byte`/`tx-byte`
   - Interface name `<pppoe-{username}>` ? regex `^<pppoe-(.+)>$` extracts username
   - `rx-byte` ? uploadBytes (router receives from client), `tx-byte` ? downloadBytes (router sends to client)
   - **Result**: Traffic shows correctly (rx: 371503, tx: 253220 for user "server") ?

3. **Queue matching wrong**: `changeQueueViaAPI` searched for queue name === username, but actual queue name is `<pppoe-{username}>`.
   - **Fix**: Rewrote `mikrotik-rate-limit.ts` with correct strategy:
     - Method 1: **CoA** (radclient) � primary, standard RADIUS approach
     - Method 2: **API /ppp/active/set rate-limit** (RouterOS 7.x) � modifies dynamic queue directly
     - Method 3: **API /queue/simple/set max-limit** on `<pppoe-{username}>` queue � explicit queue match
     - Method 4: **Disconnect** as last resort (if allowDisconnect=true)
   - CoA is now FIRST (user requested: "implementasi CoA jangan mengganti implementasi lain nya")

**MikroTik RADIUS Config (Final State):**
```
*25: address=10.20.30.10, src-address=10.20.30.11, require-message-auth=no, service=ppp,login,hotspot,wireless (original - for auth/acct)
*26: address=10.20.30.1, src-address=10.20.30.11, require-message-auth=no, service=ppp (new - for CoA via masqueraded gateway)
```

**Files Modified:**
- `src/lib/mikrotik-rate-limit.ts` � Rewritten: CoA first ? API /ppp/active/set ? API /queue/simple/set ? Disconnect
- `src/app/api/sessions/route.ts` � Traffic from `/interface/print ?type=pppoe-in` instead of `/ppp/active/print`

**Deployed:** 2 files via pscp ? `npm run build` OK ? `pm2 restart` (restart #169) ?

---

### March 4, 2026 (Session 25 � CoA Rate Limit Change Without Disconnect + Deployed to VPS)

**User Request:** CoA rate limit change: saat profil PPPoE berubah speed, jangan diskonek dulu � langsung ubah rate limit aktif via CoA (tanpa disconnect).

**Root Causes Fixed:**
1. **CoA sendCoARequest** tidak punya `NAS-IP-Address` attribute (RFC 5176 requirement) � hanya `sendDisconnectRequest` yang punya.
2. **profiles/route.ts**: Rate limit change hanya via radclient CoA, dan target IP diambil dari `nasipaddress` radacct. Seharusnya pakai `router.ipAddress` (VPN IP 10.20.30.11) yang pasti reachable.
3. **users/route.ts**: Saat user ganti paket (profile), selalu disconnect dulu baru reconnect dengan profil baru. Harusnya coba ubah rate limit via CoA dulu, disconnect hanya sebagai last resort.

**1. NAS-IP-Address di sendCoARequest (src/lib/radius-coa.ts)**
- Tambah `NAS-IP-Address=${host}` sebagai attribute pertama di CoA-Request
- Same fix sebagai `sendDisconnectRequest` (sudah diperbaiki di Session 24)
- RFC 5176 mensyaratkan NAS-IP-Address di SEMUA CoA/Disconnect-Request

**2. New Utility: mikrotik-rate-limit.ts (src/lib/mikrotik-rate-limit.ts) � FILE BARU**
- `changePPPoERateLimit(router, username, newRateLimit, sessionInfo, options)` � function utama
- Strategy (berurutan):
  1. **MikroTik RouterOS API queue**: `/ppp/active/print` ? cari session ? `/queue/simple/set max-limit=<rateLimit>`
     - Coba nama queue = username, fallback ke target IP match
     - Coba `/ppp/active/set rate-limit=<rateLimit>` (RouterOS 7.x+)
  2. **RADIUS CoA** (radclient): kirim `Mikrotik-Rate-Limit` dalam CoA-Request ke `router.ipAddress:3799`
  3. **Disconnect** (hanya jika `allowDisconnect: true`): disconnect paksa, user reconnect dengan rate baru dari RADIUS DB
- Return `{ success, method: 'api-queue' | 'coa' | 'disconnect' | 'none' }`

**3. profiles/route.ts Rewrite (src/app/api/pppoe/profiles/route.ts)**
- Import `changePPPoERateLimit` dari `@/lib/mikrotik-rate-limit` (ganti `applyProfileChangeToActiveSessions`)
- Hapus `isRadclientAvailable` check � tidak perlu lagi, API queue tidak butuh radclient
- Router lookup: ambil `ipAddress, nasname, port, username, password, secret` (sebelumnya hanya `secret`)
- Fallback: jika tidak ada router match by nasname/ipAddress, try `router.findFirst({ isActive: true })`
- `allowDisconnect: true` � jika API dan CoA keduanya gagal, disconnect sebagai last resort
- Response includes `method` (bagaimana rate limit diubah: api-queue/coa/disconnect)

**4. users/route.ts Rewrite (src/app/api/pppoe/users/route.ts)**
- Import: hapus `applyProfileChangeToActiveSessions, isRadclientAvailable`, tambah `changePPPoERateLimit`
- Saat profile berubah: pakai `changePPPoERateLimit` dengan `newProfile.rateLimit || 'DLM/ULM'`
- **TIDAK LAGI** selalu disconnect ? ubah rate limit DULU via API/CoA
- Message: `"Rate limit updated to X without disconnect"` vs `"User disconnected and will reconnect with new rate limit"` (hanya jika fallback ke disconnect)

**5. Deployed ke VPS:**
- Upload 7 file via pscp ke `root@103.151.140.110:/var/www/salfanet-radius/`
- Build: `npm run build` ? OK (427 lines, semua routes compiled)
- Restart: `pm2 restart salfanet-radius` ? **online, uptime 3s, mode cluster** ?

**Files dimodifikasi/dibuat:**
- `src/lib/mikrotik-rate-limit.ts` � **NEW FILE** � CoA rate limit change utility
- `src/lib/radius-coa.ts` � tambah NAS-IP-Address ke sendCoARequest
- `src/app/api/pppoe/profiles/route.ts` � pakai changePPPoERateLimit
- `src/app/api/pppoe/users/route.ts` � CoA rate limit dulu, tidak langsung disconnect

**TypeScript Check:** `npx tsc --noEmit` ? **0 errors ?**
**VPS Build:** `npm run build` ? **OK ?**
**PM2 Status:** `salfanet-radius` online (restart #168), `salfanet-cron` online (restart #12) ?

---

### March 4, 2026 (Sessions 21�23 � L2TP Fix, FreeRADIUS NAS Auto-Sync, PPPoE Session Sync, Uptime Fix, VPS Cleanup)

**VPS State setelah sesi ini:**
- PM2: `salfanet-radius` online (restart #167), `salfanet-cron` online (restart #12)
- FreeRADIUS: active, NAS auto-sync enabled, secret `1O2EK65yEBwAB5ap` di `nas-from-db.conf`
- VPN: ppp0 UP, 10.20.30.10 (VPS) ? 10.20.30.1 (CHR), L2TP no IPSec
- MySQL: database `salfanet_radius`, timezone +07:00 (WIB)
- MikroTik CHR API: 10.20.30.11:8728 (via VPN tunnel)
- /tmp VPS: **BERSIH** � semua file test/debug/temp dihapus (100+ files)

**1. isRadiusServer Filter di VPN Client Dropdown (Build #162)**
- Tambah field `isRadiusServer` ke `VpnClientData` interface
- `loadVpnClients()` mapping include `isRadiusServer`
- Dropdown hanya tampilkan VPN Clients dengan `isRadiusServer=true`
- `handleConnectL2tp` validasi: blok koneksi ke non-RADIUS-server clients

**2. L2TP Control Modal Restored (Build #163)**
- Kembalikan L2TP Control button + modal yang sempat ter-replace SSTP
- Hapus SSTP Control button + modal (tidak digunakan)
- SSTP service dihentikan dan dibersihkan dari VPS

**3. RADIUS Secret Mismatch Fix**
- `nas-from-db.conf` memiliki secret lama `FH2UjbtOzMMqOS4B`
- DB memiliki secret baru `1O2EK65yEBwAB5ap`
- Fix: tulis ulang `nas-from-db.conf` dengan secret yang benar

**4. FreeRADIUS NAS Auto-Sync (Build #164)**
- `syncNasClients()` di `src/lib/freeradius.ts`:
  - Returns `boolean` (true = config berubah)
  - Idempotent: baca file ? compare ? tulis hanya jika berbeda
- `freeradiusHealthCheck()` di `src/lib/cron/freeradius-health.ts`:
  - Panggil `syncNasClients()` setelah health check
  - Jika berubah ? `systemctl reload freeradius` (SIGHUP, tidak putus sesi)
- Tidak perlu restart manual lagi saat secret/NAS berubah di DB

**5. PPPoE Session Sync Cron (Build #165)**

**File dibuat:** `src/lib/cron/pppoe-session-sync.ts`
- `syncPPPoESessions()` function:
  1. Query semua active router dari DB
  2. Connect ke MikroTik API (`/ppp/active/print`) per router via VPN tunnel
  3. Bandingkan username aktif MikroTik vs radacct (acctstoptime IS NULL)
  4. INSERT sesi yang ada di MikroTik tapi tidak ada di radacct
  5. UPDATE (CLOSE) sesi di radacct yang sudah tidak ada di MikroTik
- INSERT query: `acctstarttime = DATE_SUB(NOW(), INTERVAL ? SECOND)` � MySQL native datetime

**Files dimodifikasi:**
- `cron-service.js` � tambah entry #16: `pppoe_session_sync`, setiap 5 menit, lockTtl=120
- `src/app/api/cron/route.ts` � tambah case `pppoe_session_sync`

**Root cause yang diselesaikan:**
- FreeRADIUS restart (akibat config reload) menyebabkan Accounting-Start packet loss
- MikroTik tidak resend Accounting-Start, hanya kirim Interim-Update tiap 10 menit
- radacct tidak punya entry ? sesi tidak muncul di web

**Test result:** `{"success":true,"inserted":1,"closed":0,"routers":1,"routerErrors":0}`

**6. PPPoE Uptime Mismatch Fix (Build #167)**

**Root causes:**
1. **`acctsessiontime` stale**: API pakai nilai dari DB (frozen saat sync) bukan kalkulasi real-time
2. **Prisma UTC?WIB bug**: Prisma append `Z` suffix ke DATETIME MySQL. MySQL simpan WIB (+07:00), Prisma baca sebagai UTC ? `Date.now() - startMs` negatif ? duration = 0
3. **1-hour guard**: Logic lama `(updateMs - rawStartMs > 3600_000) ? updateMs : rawStartMs` sebabkan sesi lama tampil durasi sangat pendek

**Fix di `src/app/api/sessions/route.ts`:**
```typescript
const TZ_OFFSET_MS = -(new Date().getTimezoneOffset()) * 60000; // 25200000ms (+7h)
const startMs = acct.acctstarttime
  ? new Date(acct.acctstarttime).getTime() - TZ_OFFSET_MS
  : now;
const duration = Math.max(0, Math.floor((now - startMs) / 1000));
```

**Fix di `src/lib/cron/pppoe-session-sync.ts`:**
- INSERT: `DATE_SUB(NOW(), INTERVAL ? SECOND)` � MySQL native, tidak ada UTC?WIB offset

**Verification result:**
```
DB duration    : 4709 sec
API duration   : 4709 sec  (TZ fix applied)
MikroTik uptime: 4717 sec  (8 sec diff = query latency)
```

**7. VPS /tmp Cleanup**
- Dihapus: 100+ file debug/test (*.py, *.js, *.sh, *.json, *.sql, *.log, *.txt)
- Sisanya: systemd private tmp (normal), `core-js-banners`, beberapa file build sementara

---

### March 2, 2026 (Session 20 � Light Theme Comprehensive Fix + Project Cleanup + Config Verification)

**1. Light Theme Text Visibility Fix � 240+ Fixes Across 60+ Admin Files ?**

Multiple Python scripts created and executed to fix invisible text on light theme:

**Round 1 � `fix_light_theme_v2.py` (33 files):**
- `text-[#e0d0ff]/60/70/50` ? `text-muted-foreground`
- `font-mono text-white` ? `text-foreground` 
- `text-gray-400 hover:text-white` ? `text-muted-foreground hover:text-foreground`
- `bg-gray-600 text-white` ? `bg-muted text-foreground`
- Added globals.css rules: `bg-[#1e1b2e]` ? `var(--card)`, `bg-[#0f0a1e]` ? `var(--muted)`

**Round 2 � `fix_light_theme_v3.py` (58 files, 192 fixes):**
- Remaining `text-[#e0d0ff]` (all opacity variants) ? `text-muted-foreground` / `text-foreground`
- `text-gray-300`/`text-gray-400` standalone ? `text-muted-foreground`
- `border-gray-600` ? `border-border`
- Broken unicode/emoji: 38 instances in 6 files (vpn-server, vpn-client, payment-gateway, parameter-config, rekap-voucher)
  - `??` ? proper emoji (????????????????)
  - Mojibake `�` ? `?`, `�'` ? `?`, `ℹ�` ? `??`
  - U+FFFD replacement chars ? em-dash `�`

**Round 3 � `fix_form_inputs.py` (3 files, 46 inputs):**
- `bg-slate-900/80 border border-[#bc13fe]/40 ... text-white` ? `bg-input border border-border ... text-foreground`
- `bg-[#1a0f35] border ... text-white` ? `bg-input border border-border ... text-foreground`
- Files: routers/page.tsx (+9), vpn-client/page.tsx (+7), vpn-server/page.tsx (+30)

**Round 4 � Manual fixes (3 files, 4 instances):**
- `manual-payments/page.tsx` � notes div `text-white` ? `text-foreground` (on bg-card)
- `vpn-server/page.tsx` � toggle label `'text-white' : 'text-gray-400'` ? `'text-foreground' : 'text-muted-foreground'`
- `isolation/templates/page.tsx` � removed redundant `text-white` on 2 buttons (had `text-accent-foreground` / `text-primary-foreground`)

**Intentionally kept `text-white`:** Buttons on colored backgrounds (gradient purple/pink headers), WhatsApp chat preview mockup, push notification phone preview.

**2. Project Cleanup � 16 Files Removed ?**

**Deleted from `scripts/` (12 one-time fix scripts):**
- `audit_text_white.py`, `fix_admin_text_white.py`, `fix_form_inputs.py`
- `fix_genieacs_modals.py`, `fix_light_theme_v2.py`, `fix_light_theme_v3.py`
- `fix_mojibake_all.py`, `fix_remaining_text.py`, `fix-toast-message.py`
- `patch-vpn-server.ps1`, `patch-vpn-server.py`
- `check-company.js`, `timezone-test.js`, `timezone-verify.js`

**Deleted from root (2 temp files):**
- `check_mt.js` � **Had hardcoded MikroTik API credentials** (`api-cabang1` / `vgZ8kSRuXN9bRFHu`). Security risk removed.
- `src-update.zip` � Temporary archive, not referenced anywhere

**Remaining scripts (4 utilities kept):**
- `remove-console-logs.js` � Used by `npm run cleanup` / `npm run cleanup:dry`
- `start-ngrok.js` � Used by `npm run tunnel`
- `sync-translations.js` � i18n key sync utility
- `vpn-routing-setup.sh` � VPS infrastructure script

**3. FreeRADIUS + Nginx Config Verification ?**

All local config files compared with live VPS (`103.151.140.110`):

| Config | Local Path | VPS Path | Status |
|--------|-----------|----------|--------|
| Nginx | `production/nginx-salfanet-radius.conf` | `/etc/nginx/sites-available/salfanet-radius` | ? In sync |
| PM2 | `production/ecosystem.config.js` | `/var/www/salfanet-radius/production/ecosystem.config.js` | ? In sync |
| FreeRADIUS clients | `freeradius-config/clients.conf` | `/etc/freeradius/3.0/clients.conf` | ? In sync |
| FreeRADIUS SQL | `freeradius-config/mods-available/sql` | `/etc/freeradius/3.0/mods-enabled/sql` (standalone) | ? In sync |
| FreeRADIUS REST | `freeradius-config/mods-available/rest` | `/etc/freeradius/3.0/mods-enabled/rest` (symlink) | ? In sync |
| FreeRADIUS sites | `freeradius-config/sites-available/default` | `/etc/freeradius/3.0/sites-enabled/default` (standalone) | ? In sync |
| FreeRADIUS CoA | `freeradius-config/sites-available/coa` | `/etc/freeradius/3.0/sites-enabled/coa` (symlink) | ? In sync |

**Fix applied:** `freeradius-config/mods-enabled/rest` was outdated (missing `post-auth` section, wrong pool settings `start=5, min=4` instead of `start=0, min=0`). Synced to match `mods-available/rest`.

**VPS mods-enabled layout (important for future deploys):**
- `rest` ? symlink to `/etc/freeradius/3.0/mods-available/rest`
- `sql` ? standalone file (NOT symlink), 984 bytes
- Most others ? symlinks to `../mods-available/`

---

### March 1, 2026 (Session 17 � Installer Scripts Hardening + ROADMAP Audit)

**1. install-mysql.sh � mysql_native_password + Performance Tuning � SELESAI ?**

`vps-install/install-mysql.sh` diupdate:
- **Semua 3 lokasi `CREATE USER`** kini menggunakan `IDENTIFIED WITH mysql_native_password BY '...'`:
  - Keep-existing path: `CREATE USER IF NOT EXISTS ... IDENTIFIED WITH mysql_native_password` + `ALTER USER IF EXISTS ... IDENTIFIED WITH mysql_native_password` (handle jika user sudah ada dengan plugin lain)
  - Drop & recreate path
  - Fresh install path
- **`timezone.cnf`** diperluas dari 3 baris ke 13 baris, menambahkan:
  ```ini
  character-set-server = utf8mb4
  collation-server = utf8mb4_unicode_ci
  mysql_native_password = ON          # required for FreeRADIUS rlm_sql_mysql
  max_allowed_packet = 64M
  skip-name-resolve = ON              # skip DNS lookup, koneksi lebih cepat
  wait_timeout = 28800
  interactive_timeout = 28800
  innodb_buffer_pool_size = 256M
  innodb_log_file_size = 64M
  max_connections = 200
  ```
- **Alasan `mysql_native_password` kritis:** FreeRADIUS 3.x (`rlm_sql_mysql`) menggunakan `libmysqlclient`. Jika user dibuat dengan default MySQL 8.0+ plugin `caching_sha2_password`, FreeRADIUS gagal koneksi DB dengan error "Authentication plugin 'caching_sha2_password' cannot be loaded".

**2. ROADMAP Audit � Koreksi Status Item � SELESAI ?**

Ditemukan 3 item ROADMAP yang statusnya tidak akurat:
- **`requireAdmin`/`requireAuth` fix** ? Checkbox `[ ]` padahal sudah ? DONE. `HttpError` + `handleRouteError` sudah ada di `auth.ts`. API routes semua pakai `getServerSession` langsung. Dikoreksi ke `[x]`.
- **`Laporan tagihan export PDF/Excel`** ? Dicatat sebagai "belum diimplementasi / stub", padahal sudah **fully implemented** sejak PM2 #48. `/admin/laporan` (456 baris), `/api/admin/laporan` (183 baris), Excel+PDF+preview tabel+filter. Dikoreksi ke `[x] ? DONE (Feb 27, 2026)`.
- **SweetAlert2 migration** ? Deskripsi TERBALIK: "admin panel belum migrasi" padahal admin panel CLEAN (0 Swal). Customer portal yang masih ada Swal di 3 file. Dikoreksi.

**3. Installer Scripts Review Summary:**
- `install-nginx.sh` � Updated di Session 16: `_proxy_locations()` tambah gzip_comp_level 6, baru `_proxy_locations_https_domain()` dengan CSP/Referrer-Policy/no-cache /api/, Block 3 pakai helper baru.
- `install-freeradius.sh` � Sudah benar: `retry_delay=1, lifetime=300, idle_timeout=20, connect_timeout=3` di `configure_sql_module()`.
- `install-mysql.sh` � Updated Session 17 (poin 1 di atas).

---

### March 1, 2026 (Session 16 � FreeRADIUS Fix + VPS Performance + Theme Transition)

**Issues Fixed:**

**1. FreeRADIUS MySQL Error 4031 (�The client was disconnected by the server because of inactivity�)**
- Root cause: Previous config rewrite via plink heredoc had CORRUPTED `freeradius-config/mods-available/sql` � `$INCLUDE` line became `\ \/\/main/\/queries.conf` (completely broken)
- Fix: Re-edited local file and re-uploaded via `pscp` (preserves integrity, no shell escaping)
- Pool tuning applied: `retry_delay=1` (was 30), `lifetime=300` (was 0), `idle_timeout=20` (was 60), `max=32` (was 10), `connect_timeout=3` (new)
- Verified: `freeradius -C` ? OK, `systemctl restart freeradius` ? active (running)
- Local file `freeradius-config/mods-available/sql` now synced with VPS

**2. VPS Performance � Swap + Redis + Nginx Gzip**
- Swap: 474MB used ? reclaimed to 0 via `swapoff -a && swapon -a`
- Redis: mem_fragmentation_ratio was 9.13x ? restarted ? improved to 1.17x
- Nginx: `gzip_comp_level` was default (1, minimal) ? set to 6 in both Block 2 (HTTP) and Block 3 (HTTPS)
  - Also enabled in global `/etc/nginx/nginx.conf`: gzip_vary, gzip_proxied, gzip_buffers, gzip_http_version
  - Verified: `Content-Encoding: gzip` on static JS files ? ~80% size reduction on 565KB bundles
  - Local `production/nginx-salfanet-radius.conf` synced with VPS

**3. Theme Dark/Light Smooth Transition**
- Problem: Theme switch was instant (jarring flash), neon glow blobs persisted in light mode
- Fix in `src/hooks/useTheme.ts`:
  - `toggleTheme()` now adds `theme-transitioning` class before switching
  - Uses `requestAnimationFrame` so transition class is applied before `.dark` toggle
  - Removes `theme-transitioning` class after 400ms
- Fix in `src/app/globals.css`:
  - Added `html.theme-transitioning *` block with 0.35s ease transitions for bg-color, color, border-color, box-shadow, opacity, filter
  - Added `.cyberpunk-bg` class rule: `opacity:0; visibility:hidden` in light mode (`:root:not(.dark)`)
- Fix in `src/app/admin/layout.tsx`:
  - Added `cyberpunk-bg` class to fixed neon effects container
  - This ensures all 3 glow orbs + scan lines + grid pattern are hidden when in light mode
- Built on VPS, PM2 restart #95

**VPS State setelah session ini:**
- FreeRADIUS: active (running), pool tuning applied, $INCLUDE intact
- PM2: `salfanet-radius` online (restart #95), `salfanet-cron` online (restart #5)
- Nginx: gzip_comp_level=6, reloaded
- Swap: 0MB used
- Redis: fragmentation improved

---

### February 28, 2026 (Session 15 � Dark/Light Mode Toggle)

**Dark/Light Mode Toggle � SELESAI ?**

**Files Created:**
- `src/hooks/useTheme.ts` � Custom hook, manages isDark state + localStorage persistence
  - `useEffect` reads `localStorage.getItem('theme')` OR `window.matchMedia('(prefers-color-scheme: dark)')`
  - `toggleTheme()` � flips `.dark` class on `<html>`, saves `'dark'`|`'light'` to localStorage

**Files Modified:**
- `src/app/globals.css` � Added `:root:not(.dark)` light mode CSS variables block:
  - `--background: #f8fafc` (slate-50), `--foreground: #0f172a` (slate-900)
  - `--card: rgba(255,255,255,0.95)`, `--muted: #e2e8f0`, `--muted-foreground: #475569`
  - `--primary: #0891b2` (slightly darker cyan; readable on white)
  - Sidebar stays dark (`--sidebar: #1e293b`) for cyberpunk aesthetic contrast
  - `color-scheme: light`
  
- `src/app/admin/layout.tsx`:
  - Added `Sun`, `Moon` to lucide imports
  - `import { useTheme } from '@/hooks/useTheme'`
  - Replaced `document.documentElement.classList.add('dark')` hardcode with `const { isDark, toggleTheme } = useTheme()`
  - Added Sun/Moon toggle button in header (between NotificationDropdown & LanguageSwitcher)
  - Button shows `<Sun>` when dark (click ? go light), `<Moon>` when light (click ? go dark)

**VPS Deploy:** Files uploaded, rebuilt, PM2 restarted.
**TypeScript:** `npx tsc --noEmit` ? **0 errors ?**

---

### February 28, 2026 (Session 13 � HttpError Fix + Laporan Analitik Advanced)

**1. Fix requireAdmin() throws 500 ? HttpError � SELESAI ?**

`src/lib/auth.ts` dimodifikasi:
- Tambah `import { NextResponse }` ke existing import `{ NextRequest }` from `next/server`
- Tambah class `export class HttpError extends Error { constructor(public readonly status: number, message: string) { super(message); this.name = 'HttpError'; } }`
- Tambah helper `export function handleRouteError(error: unknown): NextResponse` � returns 401/403/500 berdasarkan error type
- Semua `throw new Error('Unauthorized')` ? `throw new HttpError(401, 'Unauthorized')`
- Semua `throw new Error('Forbidden: ...')` ? `throw new HttpError(403, 'Forbidden: ...')`
- TSC clean: `npx tsc --noEmit` ? 0 errors

**Deployed to VPS (PM2 #78) � semua file session 12 + auth.ts fix:**
- `src/lib/auth.ts`, `src/lib/mikrotik/routeros.ts`, `src/lib/hotspot-radius-sync.ts`
- `src/app/api/network/vpn-client/route.ts`, `src/app/api/network/vpn-server/setup/route.ts`
- `src/app/api/network/routers/[id]/setup-radius/route.ts`, `setup-isolir/route.ts`
- `src/app/admin/network/vpn-client/page.tsx`, `vpn-server/page.tsx`

**2. Laporan Analitik Advanced � SELESAI ?**

**Files dibuat:**
1. ? `src/app/api/admin/analytics/route.ts` � Analytics data API
   - `GET /api/admin/analytics?period=3|6|12|24` (default 12)
   - MySQL raw queries via `prisma.$queryRaw`:
     - `SELECT DATE_FORMAT(paidAt, '%Y-%m') as month, SUM(amount), COUNT(*) FROM invoices WHERE status='PAID'`
     - `SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, COUNT(*) FROM pppoe_users`
     - `SELECT DATE_FORMAT(updatedAt, '%Y-%m') as month, COUNT(*) FROM pppoe_users WHERE status='stop'`
   - buildMonthList() fills zero-months in the date range
   - Returns: `{ monthlyData[], profileBreakdown[], areaBreakdown[], summary }`
   - monthly metrics: `revenue`, `invoiceCount`, `newCustomers`, `churned`, `churnRate`, `arpu`, `cumulativeCustomers`
   - summary: `totalRevenue`, `totalNewCustomers`, `totalChurned`, `avgArpu`, `avgChurnRate`, `avgRetentionRate`, `currentActiveUsers`
   - Churn approximation: `status='stop' AND updatedAt >= startDate` (no stoppedAt field in schema)
   - ARPU = `revenue[month] / cumulativeActiveUsers[month]`
   - Profile breakdown via `pppoeUser.groupBy('profileId')` + profile lookup
   - Area breakdown via `pppoeUser.groupBy('areaId')` + area lookup

2. ? `src/app/admin/laporan/analitik/page.tsx` � Analytics dashboard page
   - Period selector tabs: 3B / 6B / 12B / 24B
   - 4 KPI cards: Total Pendapatan, Avg ARPU, Avg Churn Rate (+Retention), Pelanggan Aktif
   - AreaChart: Revenue per bulan (recharts) with gradient fill
   - BarChart: Pelanggan Baru vs Churn per bulan (paired bars)
   - LineChart: ARPU trend per bulan
   - LineChart: Churn Rate % per bulan
   - AreaChart: Cumulative active customers estimate
   - PieChart: Profile breakdown (donut with legend)
   - Area breakdown: horizontal progress bars
   - Full monthly data table (8 columns)
   - Churn methodology note (amber banner)
   - All data from `/api/admin/analytics`

3. ? `src/app/admin/laporan/page.tsx` � Tambah navigation link
   - Import: `Link` from `next/link`, `Activity` from `lucide-react`
   - Button: `<Link href="/admin/laporan/analitik">Analitik Advanced</Link>` di header

**VPS Deploy (Session 13):**
- Directories created: `/var/www/salfanet-radius/src/app/api/admin/analytics/` dan `/src/app/admin/laporan/analitik/`
- Uploaded 3 files via pscp
- `nohup npm run build > /tmp/next-build.log 2>&1` triggered
- PM2 restart: pm2 restart salfanet-radius

**TypeScript Check:** `npx tsc --noEmit` ? **0 errors ?**

---

### February 28, 2026 (Session 12 � Admin Dashboard Improvements + Full SALFANET Rebrand)

**1. Admin Dashboard Improvements � SELESAI ?**

**Files dimodifikasi:**
- `src/app/api/dashboard/stats/route.ts` � Tambah 2 query baru dalam cache block:
  - **Agent Voucher Sales**: query `hotspotVoucher` dengan `agentId != null` dan `firstLoginAt` di bulan ini, group by agent, hitung sold count + IDR revenue. Return `agentSales` (top 5) + `agentSalesTotal { count, revenue }`
  - **RADIUS Auth Log**: query `radpostauth` last 15 entries `ORDER BY authdate DESC` + count `Access-Accept` / `Access-Reject` hari ini. Return `radiusAuthLog` + `radiusAuthStats { acceptToday, rejectToday }`
- `src/app/admin/page.tsx` � 4 perubahan:
  - Fix semua hardcoded string di `statCards[]` ? pakai `t()` keys (totalPppoeUsers, activePppoeSessions, activeHotspotSessions, unusedVouchers, isolatedCustomers, suspendedCustomers, voucherRevenue, invoiceRevenue, thisMonth)
  - Fix ChartCard hardcoded titles ? `t('dashboard.customerStatus')`, `t('dashboard.pppoeUsers')`, `t('dashboard.incomeVsExpense')`, `t('dashboard.last6Months')`
  - Tambah interfaces `AgentSaleEntry` dan `RadiusAuthEntry`
  - Tambah 2 new sections sebelum System Status:
    - **Agent Voucher Sales card**: ranked top-5 table + total footer, icon Store
    - **RADIUS Auth Log card**: accept/reject badge counts + scrollable list entries (ShieldCheck/ShieldX icon per entry)
- `src/locales/id.json` + `en.json` � Tambah 28 keys baru di section `"dashboard"`:
  `totalPppoeUsers`, `activePppoeSessions`, `activeHotspotSessions`, `unusedVouchers`, `isolatedCustomers`, `suspendedCustomers`, `voucherRevenue`, `invoiceRevenue`, `customerStatus`, `agentVoucherSales`, `agentVoucherSalesSubtitle`, `agentName`, `agentVouchersSold`, `agentRevenue`, `agentTotalSales`, `agentTotalRevenue`, `noAgentSales`, `radiusAuthLog`, `radiusAuthLogSubtitle`, `loginSuccess`, `loginFailed`, `todayAccepted`, `todayRejected`, `noAuthLogs`

**2. Full Branding Replacement: AIBILL ? SALFANET � SELESAI ?**

Seluruh file project (`.ts`, `.tsx`, `.js`, `.sh`, `.json`, `.md`, `.conf`, `.ps1`, `.html`) di-replace dengan PowerShell `[IO.File]::ReadAllText` + `-creplace`:
- `AIBILL RADIUS` ? `SALFANET RADIUS`
- `AIBILL-RADIUS` ? `SALFANET-RADIUS`
- `aibill-radius` ? `salfanet-radius`
- `AIBILLRADIUS` ? `SALFANETRADIUS`
- `AIBILL` ? `SALFANET`
- `aibill` ? `salfanet`
- Semua interface names: `wg0-aibill` ? `wg0-salfanet`, `l2tp-client-aibill` ? `l2tp-client-salfanet`, IPSec secret: `aibill-vpn-secret` ? `salfanet-vpn-secret`
- VPS install scripts di `vps-install/`: semua references + log path `/var/log/aibill-vps-install.log` ? `/var/log/salfanet-vps-install.log`

**3. MikroTik Setup-RADIUS Script: Tambah Profile `salfanetradius` � SELESAI ?**

`src/app/api/network/routers/[id]/setup-radius/route.ts` � Tambah 2 profile creation block:
```mikrotik
# PPPoE Profile  (?? use-vj-compression DIHAPUS � tidak valid di ROS 7.x)
:if ([:len [/ppp profile find name="salfanetradius"]] = 0) do={
    /ppp profile add name=salfanetradius local-address=10.10.10.1 remote-address=pool-radius-default use-compression=no use-encryption=no comment="SALFANET RADIUS - PPPoE Profile"
}
# Hotspot Profile
:if ([:len [/ip hotspot user profile find name="salfanetradius"]] = 0) do={
    /ip hotspot user profile add name=salfanetradius shared-users=1 rate-limit=""
}
```

**Bugfix (Session 14):** `use-vj-compression=no` dihapus dari `/ppp profile add salfanetradius` � parameter ini **tidak ada di RouterOS 7.x**, menyebabkan error `expected end of command (line 2 column 121)` saat script dipaste ke MikroTik terminal.

**VPS Deploy (Session 11 ? 12 cumulative):**
- Upload 4 files: `id.json`, `en.json`, `route.ts` (stats), `page.tsx` (admin dashboard)
- `nohup npm run build` ? BUILD_ID confirmed
- PM2 restart: salfanet-radius #77 online, salfanet-cron #5 online

**TypeScript Check:** `npx tsc --noEmit` ? **0 errors ?**

---

### February 28, 2026 (Session 11 � Customer Self-service Suspend + Deploy)

**Feature: Customer Self-service Suspend � SELESAI ? (Web + Mobile)**

**Prisma Schema:**
- Added `suspendRequests suspendRequest[]` relation to `pppoeUser` model
- Added `model suspendRequest` with fields: `id`, `userId`, `status` (PENDING|APPROVED|REJECTED|CANCELLED|COMPLETED), `reason`, `startDate`, `endDate`, `adminNotes`, `requestedAt`, `approvedAt`, `approvedBy`, `updatedAt`
- `@@map("suspend_requests")` � table created on VPS via `prisma db push`

**Files dibuat:**
1. ? `src/app/api/customer/suspend-request/route.ts`
   - **Auth**: Bearer token dari `customerSession` table (bukan NextAuth!)
   - `GET` � return latest suspend request milik customer
   - `POST` � buat request baru (validasi: future dates, max 90 hari, blok jika sudah ada PENDING/APPROVED)
   - `DELETE ?id=` � cancel request berstatus PENDING
2. ? `src/app/api/admin/suspend-requests/route.ts`
   - `GET ?status=PENDING|APPROVED|...` � list dengan filter status + pagination (limit 500)
   - Include user data (name, username, customerId, phone)
3. ? `src/app/api/admin/suspend-requests/[id]/route.ts`
   - `PUT { action: 'APPROVE'|'REJECT', adminNotes? }` � approve/reject request
   - Jika APPROVE dan startDate <= now: langsung set `pppoeUser.status = 'stopped'`
4. ? `src/app/customer/suspend/page.tsx`
   - Cyberpunk theme (CyberCard/CyberButton)
   - Tampilkan request aktif + status badge + tombol cancel (jika PENDING)
   - Form (startDate, endDate, reason) hanya jika tidak ada request aktif
5. ? `src/app/admin/suspend-requests/page.tsx`
   - Tab filter status, tabel pelanggan, tombol Approve/Reject
   - Dialog dengan textarea adminNotes (wajib saat Reject)
6. ? `mobile-app/services/suspend.ts` � `SuspendService` class: `getCurrent()`, `create()`, `cancel()`
7. ? `mobile-app/app/suspend.tsx` � Expo screen dengan form + current request card

**Files dimodifikasi:**
- `prisma/schema.prisma` � tambah model suspendRequest
- `src/app/api/cron/route.ts` � tambah case `suspend_check` (aktivasi/restore berdasarkan tanggal)
- `cron-service.js` � tambah schedule #15 `0 * * * *` (setiap jam)
- `src/app/customer/layout.tsx` � tambah menu Suspend (PauseCircle icon)
- `src/app/admin/layout.tsx` � tambah `suspendRequests` di nav pppoe children
- `src/locales/id.json` + `en.json` � tambah key `suspendRequests`
- `mobile-app/constants/index.ts` � tambah `SUSPEND_REQUEST` endpoint
- `mobile-app/app/(tabs)/profile.tsx` � tambah menu "Suspend Sementara"

**VPS Deploy:**
- `prisma db push` � tabel `suspend_requests` berhasil dibuat
- `npm run build` � selesai
- PM2 restart #67 (salfanet-radius online), #4 (salfanet-cron online)

**Customer Auth Pattern (PENTING):**
```typescript
// Customer API routes TIDAK pakai getServerSession!
// Pakai Bearer token dari customerSession table:
const auth = request.headers.get('authorization');
const token = auth?.split(' ')[1];
const customerSession = await prisma.customerSession.findFirst({
  where: { token, expiresAt: { gt: new Date() } },
  include: { user: true },
});
if (!customerSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

---

### February 27, 2026 (Session 10 � Bulk Import Invoice dari CSV)

**Feature: Bulk Import Invoice CSV � SELESAI ?**

**Files dibuat:**
1. ? `src/app/api/admin/invoices/import/route.ts` � API endpoint:
   - `GET` � download template CSV (`username,amount,dueDate,notes`)
   - `POST` � multipart/form-data, parse CSV via `papaparse` (server-side)
   - Per-row validation: username required, amount numeric, dueDate format check
   - Lookup `pppoeUser` by username ? get `userId`
   - Generate invoice number format `INV-YYYYMM-NNNN` per existing pattern
   - Batch insert via `prisma.invoice.create()` per row
   - Returns: `{ success, total, imported, failed, results[{row, username, status, invoiceNumber, reason}] }`
2. ? `src/app/admin/invoices/import/page.tsx` � Admin UI:
   - Drag & drop + click-to-upload zone (.csv only)
   - Client-side CSV preview (50 rows) � shows username, amount, dueDate, notes
   - Validation hints (format info box, missing columns alert)
   - Import button ? per-row result table (Berhasil/Gagal + invoiceNumber or reason)
   - Summary cards: Total / Berhasil / Gagal
   - "Download Template CSV" button ? `GET /api/admin/invoices/import`
   - "Ganti File" + "Import File Lain" reset buttons
3. ? `src/app/admin/invoices/page.tsx` � Added "Import CSV" button in header toolbar

**Dependencies installed:**
```bash
npm install papaparse @types/papaparse  # 2 packages added
```

**CSV Template format:**
```
username,amount,dueDate,notes
pppoe_user01,100000,2025-08-30,Tagihan Agustus
```

**Route URL:** `/admin/invoices/import`
**API URL:** `/api/admin/invoices/import` (GET = template, POST = import)

---

### February 27, 2026 (Session 9 � Export Laporan PDF/Excel + Middleware Discovery)

**Feature: Laporan & Export (PDF/Excel) � SELESAI ?**

**Files dibuat:**
1. ? `src/app/api/admin/laporan/route.ts` � API GET endpoint, 3 jenis laporan:
   - `type=invoice` � filter by `createdAt` range + status (PAID/PENDING/OVERDUE/CANCELLED)
   - `type=payment` � filter by `paidAt` range
   - `type=customer` � filter by `createdAt` range + status (active/isolated/stopped/expired)
   - Returns: `{ rows, summary, type }`
2. ? `src/app/admin/laporan/page.tsx` � Admin page with:
   - Date range filter (default: first of current month � today)
   - Report type tabs: Invoice | Pembayaran | Pelanggan
   - Status filter dropdown
   - Preview table (max 100 rows displayed)
   - "Export Excel" button � dynamic import `xlsx`, generates `.xlsx` file client-side
   - "Export PDF" button � dynamic import `jspdf` + `jspdf-autotable`, landscape A4
   - Summary cards: totals, amounts, status breakdown
3. ? `src/app/admin/layout.tsx` � Added "Laporan & Export" menu item in KEUANGAN section
4. ? `src/locales/id.json` + `en.json` � Added `nav.laporan` key

**Dependencies installed:**
```bash
npm install xlsx jspdf jspdf-autotable  # 8 packages added
```

**?? CRITICAL DISCOVERY � Next.js 16 `proxy.ts` IS middleware:**
Next.js 16.1.x explicitly supports `proxy.ts` as an alternative middleware filename (alongside `middleware.ts`). The build output shows "Proxy (Middleware)" confirming it is active.
- Build error if BOTH `middleware.ts` AND `proxy.ts` exist: `"Both middleware file and proxy file are detected. Please use proxy.ts only."`
- **Conclusion: `src/proxy.ts` was ALWAYS active as middleware in Next.js 16. No action needed.**
- `src/middleware.ts` was created and immediately deleted after causing the conflict.

**PM2 State:** restart #48, online

---

### February 27, 2026 (Session 8 � 2FA Admin Login: TOTP Google Authenticator)

**Feature: Two-Factor Authentication (2FA) untuk Admin Login � SELESAI ?**

**DB Changes (Prisma � sudah di-migrate ke VPS):**
```prisma
model AdminUser {
  twoFactorEnabled Boolean @default(false)
  twoFactorSecret  String? // Base32-encoded TOTP secret
}

model AdminTwoFactorPending {
  id        Int      @id @default(autoincrement())
  token     String   @unique  // UUID (random, 32 hex chars)
  userId    Int
  expiresAt DateTime             // 10 menit dari create
  createdAt DateTime @default(now())
  @@map("admin_two_factor_pending")
}
```

**Files yang dibuat/dimodifikasi:**
1. ? `src/app/api/admin/2fa/setup/route.ts` � Generate TOTP secret, return QR code URI
2. ? `src/app/api/admin/2fa/verify/route.ts` � Verify TOTP code, enable 2FA on account
3. ? `src/app/api/admin/2fa/disable/route.ts` � Disable 2FA (verify code dulu)
4. ? `src/app/api/admin/auth/pre-login/route.ts` � Pre-login check: validate credentials + cek 2FA, buat `AdminTwoFactorPending` record, return `{ requires2FA, token }`
5. ? `src/app/admin/settings/security/page.tsx` � Halaman setup 2FA (QR code scan, enable/disable)
6. ? `src/lib/auth.ts` � Modifikasi `authorize()`: Branch A (2FA login via tfaToken+tfaCode) + Branch B (normal login, block jika 2FA enabled)
7. ? `src/app/admin/login/page.tsx` � **INLINE 2-STEP FLOW** (rewrite lengkap)

**Alur Login 2FA (Inline � tanpa redirect ke halaman terpisah):**
```
Step 1: username + password
  ? POST /api/admin/auth/pre-login
  ? if requires2FA: setStep('twoFactor'), simpan token di state
  ? if no 2FA: langsung signIn() via NextAuth

Step 2: 6-digit TOTP code (tampil di halaman yang sama)
  ? signIn('credentials', { tfaToken, tfaCode })
  ? NextAuth authorize() Branch A: lookup AdminTwoFactorPending by token, verifyTOTP, delete record, return user
```

**Root Cause Bug Sebelumnya (3 lapisan):**
1. NextAuth v4 sanitize semua error dari `authorize()` ? `"CredentialsSignin"` � `throw new Error('TWO_FACTOR:...')` tidak pernah sampai ke client
2. `router.push('/admin/auth/two-factor?t=TOKEN')` ? race condition di halaman terpisah: `useEffect` dengan `if (!tfaToken) router.replace('/admin/login')` terpicu sebelum `useSearchParams()` ter-populate
3. Tidak ada `middleware.ts` � Next.js hanya baca `src/middleware.ts`, bukan `src/proxy.ts`

**Fix akhir � Login page inline 2-step:**
- Tidak ada navigasi ke halaman terpisah ? tidak ada race condition
- Pre-login API handle semua validasi credential + 2FA check
- `auth.ts` Branch B: `return null` (bukan `throw`) jika 2FA enabled + bypass langsung

**?? Known Issue � `src/proxy.ts` vs `src/middleware.ts`:**
Next.js middleware hanya membaca file bernama `middleware.ts` (bukan `proxy.ts`). Saat ini `src/proxy.ts` berisi logika proteksi `/admin/*` routes. File ini **tidak jalan sebagai middleware** karena namanya salah. Namun admin routes tetap aman karena setiap API route punya `getServerSession` check sendiri.
- **TODO:** Buat `src/middleware.ts` yang re-export dari `src/proxy.ts`, atau rename file

**TOTP Library:** `otplib` v12.x � `authenticator.generateSecret()`, `authenticator.keyuri()`, `authenticator.check(token, secret)`

**PM2 State:** restart #47, online

---

### February 27, 2026 (Session 6 � Security Audit Round 1 & Round 2: API Auth Hardening)

**Security Audit � All `/api/*` routes now require authentication**

Root cause discovered: Next.js middleware (`src/proxy.ts`) only protects `/admin/*` page routes via `getToken()`. It does NOT protect any `/api/*` routes. Every API route must handle its own auth check.

**Auth fix pattern applied to all routes:**
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// At start of GET handler:
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Round 1 (10 routes fixed � critical credential exposure):**
1. ? `src/app/api/freeradius/radcheck/route.ts` � was exposing RADIUS cleartext passwords
2. ? `src/app/api/freeradius/logs/route.ts`
3. ? `src/app/api/freeradius/status/route.ts`
4. ? `src/app/api/freeradius/config/list/route.ts`
5. ? `src/app/api/network/routers/route.ts` � was exposing router secret `vgZ8kSRuXN9bRFHu`
6. ? `src/app/api/sessions/route.ts`
7. ? `src/app/api/invoices/route.ts`
8. ? `src/app/api/notifications/route.ts`
9. ? `src/app/api/whatsapp/providers/route.ts`
10. ? `src/app/api/payment-gateway/config/route.ts` � was exposing Midtrans keys

**Round 2 (29 routes fixed � full audit coverage):**
- ? `src/app/api/settings/genieacs/route.ts` � was exposing GenieACS URL+credentials
- ? `src/app/api/settings/email/templates/route.ts`
- ? `src/app/api/keuangan/transactions/route.ts`
- ? `src/app/api/keuangan/categories/route.ts`
- ? `src/app/api/payment-gateway/webhook-logs/route.ts`
- ? `src/app/api/permissions/route.ts`
- ? `src/app/api/permissions/role-templates/route.ts`
- ? `src/app/api/whatsapp/templates/route.ts`
- ? `src/app/api/whatsapp/history/route.ts`
- ? `src/app/api/whatsapp/reminder-settings/route.ts`
- ? `src/app/api/admin/technicians/route.ts`
- ? `src/app/api/admin/topup-requests/route.ts`
- ? `src/app/api/admin/registrations/route.ts`
- ? `src/app/api/admin/push-notifications/route.ts`
- ? `src/app/api/admin/evoucher/orders/route.ts`
- ? `src/app/api/tickets/route.ts`
- ? `src/app/api/tickets/stats/route.ts`
- ? `src/app/api/hotspot/profiles/route.ts`
- ? `src/app/api/hotspot/agents/route.ts`
- ? `src/app/api/pppoe/profiles/route.ts`
- ? `src/app/api/network/servers/route.ts`
- ? `src/app/api/network/odps/route.ts`
- ? `src/app/api/network/olts/route.ts`
- ? `src/app/api/network/odcs/route.ts`
- ? `src/app/api/manual-payments/route.ts`
- ? `src/app/api/voucher-templates/route.ts`
- ? `src/app/api/company/route.ts`
- ? `src/app/api/cron/route.ts`
- ? `src/app/api/cron/status/route.ts`

**Bonus � Isolation routes (3 files had 500 instead of 401):**
- ? `src/app/api/admin/isolated-users/route.ts` � was using `requireAdmin()` which throws, catch block returned 500
- ? `src/app/api/admin/settings/isolation/route.ts` � same issue (GET + PUT handlers)
- ? `src/app/api/admin/settings/isolation/mikrotik-script/route.ts` � same issue
- ? `src/app/api/admin/isolate-user/route.ts` � same issue (POST handler)
- Root cause: `requireAdmin(request)` throws `new Error('Unauthorized')`, caught by error handler ? 500. Fixed by replacing with `getServerSession` pattern.

**Intentionally kept public (no auth):**
- `src/app/api/settings/company/route.ts` � Intentional public endpoint for branding (login page logo/name)

**VPS State after session:**
- All 30 routes (+3 previously 500) verified returning HTTP 401 without auth
- Build: 290 pages, clean rebuild (rm -rf .next required due to incremental cache)
- PM2: `salfanet-radius` online (restart #41), unstable restarts: 0
- Backups created: `salfanet-src-backup-20260227_0308.zip` (1.3 MB src/), `salfanet-prisma-backup-20260227.zip`

**?? Lesson Learned � Turbopack incremental cache:**
When uploading source files to VPS and rebuilding, always run `rm -rf .next && npm run build` (NOT just `npm run build`) because Turbopack's incremental cache may serve the old compiled output even with new source files.

**?? Previously 500, now fixed:**
- `/api/admin/isolated-users`, `/api/admin/settings/isolation`, `/api/admin/settings/isolation/mikrotik-script`, `/api/admin/isolate-user` � all now return proper 401.

---

### February 27, 2026 (Session 5 � PPPoE Customer Documents Feature)

**Feature: Tambah Field Dokumen Pelanggan PPPoE (dari billing-radius)**

Migrasi fitur extra dari project billing-radius ke salfanet-radius:

1. ? **Branding audit** � tidak ada teks "billing-radius" / "SALFANET" di `src/` salfanet, semua aman
2. ? **Prisma Schema** � tambah 4 field baru ke model `pppoeUser`:
   - `idCardNumber String? @db.VarChar(50)` � NIK KTP pelanggan
   - `idCardPhoto String? @db.VarChar(500)` � URL foto KTP
   - `installationPhotos Json?` � Array URL foto instalasi
   - `followRoad Boolean @default(false)` � Garis ke ODP ikuti jalanan
3. ? **DB Migration** � `prisma/migrations/20260227_add_pppoe_customer_docs/migration.sql` dijalankan di VPS � semua 6 kolom baru terkonfirmasi ada di `pppoe_users` table
4. ? **Upload API** � `src/app/api/upload/pppoe-customer/route.ts` (baru)
   - POST handler, auth check via getServerSession
   - type=`idCard` ? `/uploads/pppoe-customers/id-cards/ktp-{ts}-{id}.ext`
   - type=`installation` ? `/uploads/pppoe-customers/installations/install-{ts}-{id}.ext`
   - Max 5MB, JPG/PNG/WebP only
5. ? **API pppoe/users** � `src/app/api/pppoe/users/route.ts` POST+PUT diupdate:
   - Destructure dan simpan: `idCardNumber`, `idCardPhoto`, `installationPhotos`, `followRoad`
6. ? **page.tsx** � `src/app/admin/pppoe/users/page.tsx` diupdate:
   - Interface `PppoeUser` tambah field baru
   - `formData` state: tambah `macAddress`, `comment`, `idCardNumber`, `idCardPhoto`, `installationPhotos: []`, `followRoad: false`
   - Upload handlers: `handleUploadIdCard`, `handleUploadInstallation`, `handleRemoveInstallationPhoto`
   - `resetForm()` dan `handleEdit()` diupdate dengan field baru
   - Modal UI: Static IP + MAC Address grid, Komentar textarea, KTP section (input NIK + upload foto + preview), Foto Instalasi section (upload multiple + grid 3-col + hapus per foto)
7. ? **UserDetailModal.tsx** � `src/components/UserDetailModal.tsx` diupdate:
   - Interface `User` tambah field baru
   - Form UI tab Info: MAC Address + Komentar fields, KTP section, Foto Instalasi (4-col grid)
8. ? **Build & Deploy** � build sukses 255 pages, PM2 restart `salfanet-radius` online

**New Upload Directory:** `/var/www/salfanet-radius/public/uploads/pppoe-customers/` (auto-created on first upload)

**VPS State setelah session ini:**
- DB: 4 kolom baru di `pppoe_users` ? (idCardNumber, idCardPhoto, installationPhotos, followRoad)
- PM2: `salfanet-radius` online (restart #37), `salfanet-cron` online
- All previous features intact (RADIUS, FreeRADIUS, VPN, Billing, etc.)

---

### February 26, 2026 (Session 4 � Unicode Mass Fix + Mobile UI + VPS Performance)

**VPS Performance Fix (web kadang lambat):**
1. ? Root cause: Swap memory terpakai 484MB di swappiness=60 (kernel agresif swap ? ~100x lebih lambat dari RAM)
2. ? Fix: `swapoff -a && swapon -a` ? swap cleared dari 483MB ? 0MB
3. ? Persisted: `vm.swappiness=10` di `/etc/sysctl.conf`
4. ? Redis AOF: rewrite 27KB ? 89B, `appendfsync = everysec`, RDB saves disabled
5. ? Hasil: web load significantly lebih cepat

**Unicode/Mojibake Mass Fix (202 fixes):**
- Root cause: Double-encoded UTF-8 � emoji UTF-8 bytes diinterpretasi sebagai cp1252/Latin-1, lalu di-encode ulang sebagai UTF-8
- Python fix method: cp1252 reverse map + C1 Latin-1 control chars (0x81, 0x8d, 0x8f, 0x90, 0x9d)
- **Total: 202 mojibake fixed across 31 files**
- Files fixed: settings/company, settings/email, settings/database, settings/genieacs, settings/cron, settings/isolation/mikrotik, whatsapp/providers, whatsapp/send, whatsapp/history, whatsapp/templates, whatsapp/notifications, notifications, push-notifications, network/map, network/vpn-client, network/routers, network/customers, hotspot/template, hotspot/profile, hotspot/agent, hotspot/rekap-voucher, pppoe/registrations, pppoe/stopped, sessions/hotspot, sessions, genieacs/virtual-parameters, genieacs/devices, genieacs/parameter-config, genieacs/tasks, inventory/items, isolated-users
- Clean dirs: locales, prisma/seeds, src/app/api, src/components, src/lib, billing, dashboard, customer

**WhatsApp Templates page.tsx � 30 title mojibake:**
1. ? `src/app/admin/whatsapp/templates/page.tsx` � templateConfig 30 titles semua fixed (? ?? ? ?? ?? ?? dll)
2. ? Pass 1: 23/30 dengan standard cp1252 reverse map
3. ? Pass 2: 7/30 tersisa dengan C1 Latin-1 control chars

**Mobile UI Tab Wrap Fix (flex-wrap):**
1. ? `settings/whatsapp/page.tsx`: 5 tab buttons � `overflow-x-auto` + `whitespace-nowrap` ? `flex flex-wrap`
2. ? `settings/email/page.tsx`: 4 main tabs + template subtabs � `overflow-x-auto scrollbar-*` wrapper dihapus ? `flex flex-wrap`
3. ? `whatsapp/templates/page.tsx`: 30 template type buttons � `overflow-x-auto min-w-max` ? `flex flex-wrap`

**VPS State setelah session ini:**
- FreeRADIUS: active, expiration module bekerja, no BlastRADIUS warnings (lanjut dari Session 3)
- PM2: `salfanet-radius` online (restart #21), `salfanet-cron` online
- Swap: 0MB (cleared), swappiness=10
- Redis: AOF rewritten, appendfsync=everysec
- All 31 files: mojibake-free ?

---

### February 26, 2026 (Session 3 � FreeRADIUS NAS + BlastRADIUS Fix)

**FreeRADIUS NAS Clients Fix:**
1. ? Root cause: `read_clients = yes` + `client_table = "nas"` gagal karena kolom `id` UUID bukan integer
2. ? Fix: `read_clients = no` di `/etc/freeradius/3.0/mods-enabled/sql`
3. ? Buat `/etc/freeradius/3.0/clients.d/nas-from-db.conf` dengan NAS entries manual
4. ? Tambah `$INCLUDE clients.d/` ke `clients.conf`
5. ? Tambah `syncNasClients()` di `src/lib/freeradius.ts` � auto-regenerate clients.d/nas-from-db.conf dari DB setiap FreeRADIUS restart
6. ? `reloadFreeRadius()` kini memanggil `syncNasClients()` sebelum restart

**BlastRADIUS Fix:**
1. ? Error: `BlastRADIUS check: Received packet with Message-Authenticator. Setting "require_message_authenticator = true" for client localhost`
2. ? Fix: Tambah `require_message_authenticator = no` ke semua client blocks:
   - `client localhost` di clients.conf ?
   - `client localhost_ipv6` di clients.conf ?
   - `client nas_cabang1` di clients.d/nas-from-db.conf ?
   - `client vpn_subnet_auto` di clients.d/nas-from-db.conf ?
3. ? BlastRADIUS warnings hilang total dari journalctl

**Expiration Module Fix:**
1. ? `mods-enabled/expiration` sudah ada tapi TIDAK dipanggil di authorize section
2. ? Fix: Tambah `expiration` sebelum `pap` di `sites-enabled/default` authorize section
3. ? Test verified: expired voucher (`Expiration = Jan 01 2020`) ? `Access-Reject` ?

**Duplicate NAS client Fix:**
1. ? SQL module dengan `read_clients = yes` sebelumnya load NAS lagi ? `Failed to add duplicate client cabang1`
2. ? Fix: `read_clients = no` di mods-enabled/sql
3. ? freeradius -CX: "Configuration appears to be OK" tanpa error

**Unicode Bug Fix (routers + genieacs page):**
1. ? `src/app/admin/network/routers/page.tsx` line 595: `{'•'.repeat(8)}` ? `{'*'.repeat(8)}`
2. ? `src/app/admin/network/routers/page.tsx` line 775: placeholder `"••..."` ? `"********"`
3. ? `src/app/admin/settings/genieacs/page.tsx`: placeholder `'•...'` ? `'********'`

**Backup Config Updated:**
1. ? `freeradius-config/sites-available/default` � tambah `expiration` di authorize
2. ? `freeradius-config/mods-available/sql` � `read_clients = no`
3. ? `freeradius-config/clients.conf` � `require_message_authenticator = no` + `$INCLUDE clients.d/`
4. ? `freeradius-config/clients.d/nas-from-db.conf` � template baru
5. ? `vps-install/install-freeradius.sh` � tambah `configure_clients_d()` function, expiration auto-fix

**RADIUS Test Results (Feb 26):**
- Valid user `648148`: `Access-Accept` ?
- Wrong password: `Access-Reject` ?
- Expired voucher (`Expiration = Jan 01 2020`): `Access-Reject` ?
- BlastRADIUS warning: **hilang** ?

**Build & Deploy:**
1. ? Upload: `freeradius.ts`, `routers/page.tsx`, `genieacs/page.tsx`
2. ? Build VPS: `Compiled successfully in 53s` (289 pages)
3. ? PM2 restart: `salfanet-radius` online (restart #17)

**VPS State setelah session ini:**
- FreeRADIUS: active, expiration module bekerja, no BlastRADIUS warnings
- PM2: `salfanet-radius` online (restart #17), `salfanet-cron` online
- Remaining warning (harmless): `MYSQL_OPT_RECONNECT deprecated` � dari libmysql MySQL 8.0+, tidak bisa difix tanpa recompile FreeRADIUS

---

### February 25, 2026 (Session 2 � Chat Lanjutan)

**Sidebar Menu 3-Level Hierarchy:**
1. ? Restructured sidebar dari flat `menuItems[]` ke 3-level: `MenuGroup` ? `MenuItem` ? `children`
2. ? Tambah `CategoryItem` collapsible component (icon + label header, expandable)
3. ? Deploy ke VPS, build clean, pm2 restart berhasil

**Dashboard Active Sessions Fix:**
1. ? Root cause: `activeSessionsPPPoE` & `activeSessionsHotspot` selalu 0
2. ? Tambah `countLiveSessionsFromRouter()` di `src/app/api/dashboard/stats/route.ts`
3. ? Query `/ppp/active/print` + `/ip/hotspot/active/print` langsung ke semua router via RouterOS API
4. ? Redis + radacct sebagai fallback jika RouterOS API gagal

**FreeRADIUS REST Authorize Integration:**
1. ? Tambah `authorize {}` section ke `mods-enabled/rest` ? call `/api/radius/authorize`
2. ? Tambah `-rest` ke `authorize {}` di `sites-enabled/default` (non-fatal)
3. ? Tambah PPPoE `expiredAt` check di `src/app/api/radius/authorize/route.ts`
4. ? Hotspot voucher status=EXPIRED + expiresAt check sudah ada
5. ? CRITICAL FIX: `sites-enabled/default` di VPS ini adalah STANDALONE FILE, bukan symlink!
   Upload ke `sites-available/default` saja tidak cukup, harus edit `sites-enabled/default`
6. ? Reply-Message behavior explained: muncul di browser, bukan RouterOS system log
7. ? FreeRADIUS restart dengan debug mode untuk verifikasi REST dipanggil

**FreeRADIUS Config (VPS � Feb 25 23:25):**
- `sites-enabled/default` � `-rest` di authorize section ?
- `mods-enabled/rest` � authorize + accounting section ?
- FreeRADIUS status: active (running)
- connect_uri = http://localhost:3000

**Database � KOREKSI PENTING:**
- VPS menggunakan **MySQL 8.0**, BUKAN PostgreSQL!
- Credentials: `mysql://salfanet_user:salfanetradius123@localhost:3306/salfanet_radius`
- DATABASE_URL di `.env` VPS: `mysql://salfanet_user:salfanetradius123@localhost:3306/salfanet_radius?connection_limit=10&pool_timeout=20`

---

### February 25, 2026 (Session 1)

**VPN Setup Route � Cloudflare 524 Fix:**
1. ? Merged to single RouterOS API connection (was 2 ? HTTP 524)
2. ? `maxDuration = 90`, `timeout: 30` (was 10 ? "Timed out after 10s", was 30+2conn ? 524)
3. ? AbortController (150s) in `handleSetup()` UI for non-JSON/timeout graceful handling
4. ? Setup steps + elapsed time displayed in Swal result popup

**VPN Server Page � PPTP/SSTP Quick Fill Dropdown Fix:**
1. ? PPTP dialog: removed `${action==='configure' ? ... : ''}` � VPN config always visible
2. ? SSTP dialog: same fix � VPN config + dropdown always shows
3. ? Auto-configure triggers when VPN fields are filled (not limited to 'configure' action)
4. ? Root cause of empty dropdown found: DB stores 'L2TP'/'PPTP'/'SSTP' (uppercase)
5. ? Fix: `loadVpnClients()` normalizes `vpnType` with `.toLowerCase()`

**Infrastructure & Domain:**
1. ? `radius.hotspotapp.net` live via Cloudflare proxy on VPS 103.151.140.110
2. ? nginx re-configured with SSL, separate `/api/` no-cache block, `/_next/static/` 365d cache
3. ? `production/nginx-salfanet-radius.conf` = source of truth for VPS nginx
4. ? CSP fix: `src/proxy.ts` allows `cloudflareinsights.com` for analytics beacon

**WireGuard Removed:**
1. ? `src/app/admin/network/vpn-client/page.tsx` � all WireGuard types, UI, script generation removed
2. ? VPN type is now `'l2tp' | 'sstp' | 'pptp'` only

**Installer Scripts:**
1. ? `vps-install/vps-installer.sh` � domain/SSL support
2. ? `vps-install/install-nginx.sh`, `install-app.sh`, `install-apk.sh` � updated
3. ? `production/install-wizard.html` � web install wizard updated

---

### December 29, 2024

**L2TP Control API Fixes:**
1. ? Added automatic CHAP secrets file creation
2. ? Removed duplicate settings from PPP options
3. ? Fixed PPP interface detection (all interfaces, not just ppp0)
4. ? Increased connection wait time (5s ? 8s)
5. ? Improved logging and error messages

**Documentation Updates:**
1. ? VPN_CLIENT_SETUP_GUIDE.md - Added troubleshooting section
2. ? PROXMOX_L2TP_SETUP.md - Added pppd exit code 2 fix
3. ? Created AI_PROJECT_MEMORY.md - This file!

**Customer Portal:**
1. ? Hardcoded Indonesian translations (no i18n hook)
2. ? Fixed build errors with `export const dynamic = 'force-dynamic'`
3. ? Applied cyberpunk theme to ticket creation page
4. ? Fixed balance card button layout (2-row design)

### December 28, 2024

**Translation System:**
1. ? Renamed duplicate "nav" to "customerNav"
2. ? Added 70+ translation keys for customer portal
3. ? Fixed missing invoice and navigation translations

---

## ?? Development Guidelines

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
// ? Good: Use TypeScript interfaces
interface Customer {
  id: string;
  name: string;
  email: string;
}

// ? Good: Async/await with try-catch
try {
  const customers = await prisma.customer.findMany();
  return NextResponse.json({ success: true, customers });
} catch (error) {
  return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}

// ? Good: Separate concerns
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

## ?? Documentation Index

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

## ?? AI Assistant Tips

### When Helping with This Project:

1. **Always check this file first** before asking repetitive questions
2. **VPN issues?** ? Check L2TP section above for known fixes
3. **Build errors?** ? Check Known Issues section
4. **Database changes?** ? Remember to run `npx prisma generate`
5. **Translation issues?** ? Customer portal uses hardcoded Indonesian
6. **Adding features?** ? Follow Development Guidelines section
7. **VPN Quick Fill dropdown empty?** ? Check that `loadVpnClients()` lowercases vpnType
8. **VPN setup timeout/524?** ? Must be single connection, `timeout:30`, `maxDuration:90`
9. **Deploying to VPS?** ? Use PuTTY tools (`pscp`/`plink`) with `-pw "Seven789@"` and `&` operator in PowerShell (not `&&`)
10. **Cloudflare caching issues?** ? Check nginx has `CDN-Cache-Control: no-store` on `/api/` location
11. **FreeRADIUS Reply-Message tidak muncul di log MikroTik?** ? Normal! Reply-Message hanya muncul di browser hotspot login page
12. **Deploy FreeRADIUS config?** ? Upload ke `sites-enabled/default` dan `mods-enabled/rest` (STANDALONE, bukan symlink!)
13. **Dashboard active sessions = 0?** ? Cek `countLiveSessionsFromRouter()` di `stats/route.ts`, pastikan router aktif di DB
14. **MySQL query dari PowerShell?** ? Pipe via stdin: `"SELECT ..." | plink ... "mysql -u user -ppass db"`
15. **FreeRADIUS NAS duplicate / read_clients?** ? `read_clients = no` di SQL module! NAS dimuat via `clients.d/nas-from-db.conf` + `syncNasClients()` di `freeradius.ts`
16. **BlastRADIUS warning?** ? Tambah `require_message_authenticator = no` ke SEMUA client blocks di clients.conf dan clients.d/nas-from-db.conf
17. **Voucher expired masih Access-Accept?** ? Cek `expiration` ada di authorize section `sites-enabled/default` (setelah `sql`, sebelum `pap`)
18. **Upload file ke VPS?** ? `pscp -batch -pw "Seven789@" ...` lalu `plink -batch -ssh -pw "Seven789@" ...` (dua command terpisah di background terminal, JANGAN semicolon dalam satu plink)
19. **PPPoE customer foto KTP / instalasi?** ? Upload via `/api/upload/pppoe-customer` (POST, multipart), simpan di `public/uploads/pppoe-customers/`
20. **MySQL query dari plink gagal / ERROR 1064?** ? PowerShell memakan double-quotes! Gunakan SINGLE quotes untuk semua nilai string di query MySQL, jangan double-quotes
21. **MySQL `ADD COLUMN IF NOT EXISTS` error?** ? MySQL 8.0 tidak support syntax ini! Hapus `IF NOT EXISTS`, gunakan plain `ALTER TABLE t ADD COLUMN c ...`
22. **2FA admin login flow?** ? Pre-login API (`/api/admin/auth/pre-login`) ? inline Step 2 di login page (bukan redirect ke halaman berbeda). NextAuth v4 sanitize semua error ? pakai pre-login API dulu.
23. **`src/proxy.ts` vs middleware?** ? Next.js 16.x MENDUKUNG `proxy.ts` sebagai middleware alternative! Build output menampilkan "Proxy (Middleware)". Jika ada KEDUANYA (`middleware.ts` + `proxy.ts`), build error. Selalu pakai `proxy.ts` saja.
24. **TOTP 2FA di admin?** ? Library `otplib`. Secret: `authenticator.generateSecret()`. Verify: `authenticator.check(code, secret)`. Pending token disimpan di tabel `admin_two_factor_pending` (expire 10 menit).
25. **Export laporan?** ? API `/api/admin/laporan?type=invoice|payment|customer&dateFrom=&dateTo=&status=`. Frontend: dynamic import `xlsx` untuk Excel, `jspdf`+`jspdf-autotable` untuk PDF. Halaman: `/admin/laporan`.

26. **Customer API auth pattern?** ? Customer routes pakai Bearer token dari `customerSession` table via `prisma.customerSession.findFirst({ where: { token } })`, BUKAN `getServerSession`. Lihat `src/app/api/customer/suspend-request/route.ts` sebagai contoh.

27. **Branding: AIBILL sudah dihapus seluruhnya** ? Semua referensi `AIBILL`/`aibill` telah di-replace ke `SALFANET`/`salfanet` pada Session 12. IPSec secret: `salfanet-vpn-secret`. Interface name VPN: `wg0-salfanet`, `l2tp-client-salfanet`. Log file VPS: `/var/log/salfanet-vps-install.log`. Jika menemukan `AIBILL` di file baru, ganti ke `SALFANET` secara konsisten.

28. **VPS build via nohup (WAJIB persistence)?** ? `plink` background processes mati saat session plink ditutup! Selalu gunakan `nohup npm run build > /tmp/next-build.log 2>&1 & disown` untuk long-running build. Poll progress dengan `plink -ssh ... "cat /tmp/next-build.log | tail -20"`. Konfirmasi selesai dengan `ls .next/BUILD_ID`.

29. **Edit FreeRADIUS config \u2192 JANGAN via plink heredoc!** ? Shell heredoc lewat plink akan merusak karakter khusus: `$INCLUDE` menjadi `\ \/\/...`, tanda kutip terbalik, dll. SELALU edit file lokal dulu ? upload via `pscp` ? restart. File lokal: `freeradius-config/mods-available/sql`, `freeradius-config/sites-available/default`, dll.

30. **Theme transition smooth?** ? `useTheme.ts` menambahkan class `theme-transitioning` ke `<html>` sebelum toggle `.dark`. CSS di `globals.css` menangkap `html.theme-transitioning *` dengan transition 0.35s ease. Class dihapus setelah 400ms. Cyberpunk background (neon orbs, scan lines, grid) disembunyikan via `.cyberpunk-bg { opacity:0; visibility:hidden }` di `:root:not(.dark)`.

31. **FreeRADIUS SQL pool \u2014 setting optimal (Mar 2026)?** ? `retry_delay=1`, `lifetime=300`, `idle_timeout=20`, `connect_timeout=3`, `max=32`. Ini mencegah MySQL Error 4031 (stale connection) yang menyebabkan user harus input voucher 2x. File: `freeradius-config/mods-available/sql`.

32. **MySQL installer: `mysql_native_password` wajib untuk FreeRADIUS?** ? Saat `CREATE USER`, SELALU gunakan `IDENTIFIED WITH mysql_native_password BY '...'`. MySQL 8.0+ default `caching_sha2_password` akan menyebabkan FreeRADIUS `rlm_sql_mysql` gagal koneksi DB. File: `vps-install/install-mysql.sh`. Juga set `mysql_native_password = ON` di `timezone.cnf`.

33. **ROADMAP bisa berbohong � selalu cek kode dulu!** ? Beberapa item ROADMAP statusnya tidak akurat (sudah DONE tapi masih `[ ]`, atau deskripsi terbalik). Sebelum mengimplementasi fitur, selalu `file_search` atau `grep_search` dulu! Contoh: `Laporan export PDF/Excel` sudah ada lengkap di `src/app/admin/laporan/page.tsx` (456 baris) + API `laporan/route.ts` (183 baris). `Laporan analitik advanced` sudah ada di `src/app/admin/laporan/analitik/page.tsx`. `SweetAlert2 migration` � admin panel CLEAN (bukan customer portal), customer portal (`upgrade/`, `topup-request/`, `topup-direct/`, `pay-manual/`) **4 file** masih ada Swal.

34. **VPN control modal � pola inline SSH credentials (Session 19, Mar 2026)?** ? L2TP/PPTP/SSTP page di `src/app/admin/network/vpn-server/page.tsx` menggunakan **inline SSH form** di dalam control modal (bukan sub-modal terpisah). Ada state `sshConnected[clientId]` + `sshFormData[clientId]`. Tombol action (Start/Stop/Configure/Restart/Logs) hanya tampil jika sudah connected. Pola ini menghindari double-modal anti-pattern (control modal ? lalu popup SSH modal lagi). Apply Routing via Frontend di `vpn-client/page.tsx` pakai endpoint `POST /api/network/vpn-routing` yang menerima `{ host, port, username, password, script }`, mengeksekusi script via SSH ke remote VPS.

35. **`generateVpsRoutingScript()` di vpn-client � jangan duplikasi body!** ? Bug Mar 2026: script body di-copy-paste dua kali dalam satu function ? bash script jadi invalid. Selalu verifikasi tidak ada duplicate lines di function ini. File: `src/app/admin/network/vpn-client/page.tsx`.

36. **Light theme text classes � pattern yang benar (Mar 2026)?** ? Gunakan Tailwind semantic tokens: `text-foreground` (primary text), `text-muted-foreground` (secondary/label text), `bg-input` (form inputs), `border-border` (borders). JANGAN gunakan: `text-white` (kecuali di atas bg warna), `text-[#e0d0ff]`, `text-gray-300/400`, `bg-slate-900/80`, `bg-[#1a0f35]`. Intentional `text-white` exceptions: gradient header banners, WhatsApp/push preview mockups.

37. **Scripts directory � hanya 4 utility scripts yang aktif (Mar 2026)?** ? `remove-console-logs.js` (npm run cleanup), `start-ngrok.js` (npm run tunnel), `sync-translations.js` (i18n sync), `vpn-routing-setup.sh` (VPS infra). Semua one-time fix scripts (fix_*.py, patch-*.ps1, audit_*.py) sudah dihapus. Jangan buat fix scripts baru di `scripts/` � jika perlu bulk-fix, jalankan langsung dan hapus setelah selesai.

38. **FreeRADIUS config file types di VPS (Mar 2026)?** ? `sites-enabled/default` dan `mods-enabled/sql` adalah **standalone files** (bukan symlink!). `sites-enabled/coa` dan `mods-enabled/rest` adalah **symlinks** ke `../*-available/`. Saat deploy config, harus tahu target file: jika standalone ? upload ke `*-enabled/`, jika symlink ? upload ke `*-available/`.

39. **PPPoE live traffic tidak muncul?** ? Sessions API (`/api/sessions?live=true`) fetch `/interface/print ?type=pppoe-in` dari MikroTik via RouterOS API. Interface PPPoE dinamis bernama `<pppoe-{username}>` � regex `^<pppoe-(.+)>$` untuk extract username. Field `rx-byte` = upload client, `tx-byte` = download client. **BUKAN** `/ppp/active/print` � field itu TIDAK punya traffic bytes! Pastikan VPN tunnel (ppp0) UP agar RouterOS API connect ke 10.20.30.11:8728.

40. **CoA disconnect tidak bekerja / user masih konek di MikroTik?** ? Urutan disconnect PPPoE: (1) MikroTik API `/ppp/active/remove` via VPN tunnel 10.20.30.11:8728 � ini PRIMARY. (2) CoA via `radclient` port 3799 hanya fallback. Untuk CoA berfungsi, MikroTik perlu `/radius incoming set accept=yes` dan RADIUS entry address harus match source IP CoA packet. Jika ada gateway masquerade (NAT), perlu tambah RADIUS entry untuk IP gateway.

41. **`interim-update` untuk traffic di radacct?** ? Script setup-radius sekarang include `/ppp aaa set use-radius=yes accounting=yes interim-update=5m`. Ini membuat MikroTik kirim Interim-Update setiap 5 menit ? `radacct.acctinputoctets/acctoutputoctets` ter-update. Historical traffic di halaman Activity user jadi akurat.

42. **Rate limit PPPoE berubah tanpa disconnect?** ? Pakai `changePPPoERateLimit()` dari `src/lib/mikrotik-rate-limit.ts`. Strategy berurutan: (1) **CoA**: kirim `Mikrotik-Rate-Limit=<rateLimit>` CoA-Request ke NAS port 3799 � primary, standard RADIUS. (2) **API /ppp/active/set rate-limit**: langsung set rate-limit pada active PPP (RouterOS 7.x) � modifies dynamic queue. (3) **API /queue/simple/set max-limit**: cari queue `<pppoe-{username}>` dan set max-limit. (4) **Disconnect** (hanya jika `allowDisconnect: true`). Fungsi ini dipakai di `profiles/route.ts` (bulk update) dan `users/route.ts` (ganti paket individual).

43. **CoA rejected "unknown address"?** ? MikroTik cek SOURCE IP paket CoA terhadap RADIUS `address` config. Jika ada masquerade/NAT di path (gateway), source IP berubah. Solusi: tambah RADIUS entry untuk IP yang masqueraded. Contoh: VPS (10.20.30.10) ? Gateway (10.20.30.1) masquerade ? MikroTik (10.20.30.11) terima dari 10.20.30.1 ? perlu `/radius add address=10.20.30.1 secret=<same> service=ppp require-message-auth=no`. Bisa dieksekusi via RouterOS API (`/radius/add`).

44. **MikroTik queue name format PPPoE?** ? Dynamic queue dibuat oleh PPPoE server: `<pppoe-{username}>` (e.g., `<pppoe-server>` untuk user "server"). Target juga `<pppoe-{username}>`. Queue `.id` bisa berubah setiap reconnect. Jangan hardcode `.id` � selalu cari by name pattern.

45. **Export keuangan (`/admin/keuangan`) � cara kerja export yang benar (Mar 7, 2026)?** ? Bug lama: gate `if (!startDate || !endDate)` di `handleExport` memblokir export tanpa range tanggal; Excel pakai `window.open()` ? diblokir popup blocker. Fix: gate dihapus, tanggal opsional; Excel pakai `fetch` + `Blob` + `a.click()` programmatic. API `/api/keuangan/export`: `where` dimulai `{}` kosong, date filter hanya ditambahkan jika keduanya ada, filter `categoryId` dan `search` juga diteruskan ke query.

46. **Isolated portal (`/isolated`) layout compact (Mar 7, 2026)?** ? State: `showSteps` (default `false`) collapsible langkah-langkah pembayaran, `showAllInfo` (default `false`) hidden secondary fields (area, address, customerId). Primary info selalu tampil. Warning banner single-row dengan ikon kiri + teks kanan. API `check-isolation` mengembalikan: `address`, `customerId`, `area.name`, `profilePrice`. Desain ini no-scroll di mobile & desktop.

47. **Sidebar nav translation keys yang ada (Mar 7, 2026)?** ? `nav.communication` ada di `en.json` (nilai: `"Communication"`). `nav.pushNotifications` ada di `id.json` (nilai: `"Push Notifikasi"`). Menu `nav.isolation` ada di group `catCustomer` (bukan `catManagement`), ditempatkan sebelum Invoices. Jika pindah VPS baru dan setup fresh install, pastikan `src/locales/en.json` dan `id.json` sudah berisi semua keys ini.

48. **FreeRADIUS + Nginx config audit Mar 7, 2026 � hasil re-verifikasi?** ? Semua config lokal vs VPS **MATCH**. Ringkasan: `clients.conf` ? sama, `mods-available/sql` ? sama, `mods-available/rest` ? sama, `sites-available/default` ? sama dengan `sites-enabled/default` VPS, `sites-available/coa` ? sama, `policy.d/filter` ? sama, nginx `production/nginx-salfanet-radius.conf` ? sama dengan VPS `/etc/nginx/sites-enabled/salfanet-radius`. `clients.d/nas-from-db.conf` lokal adalah template saja � file di VPS berisi NAS aktual yang di-generate otomatis oleh app (benar, tidak perlu disamakan). VPS `sites-enabled/inner-tunnel` enabled (symlink default installer) � tidak berpengaruh ke PPPoE/PAP/CHAP alur.

49. **`firstLoginAt` dan `expiresAt` hotspot voucher perlu TZ correction (Mar 7, 2026)?** ? `hotspot_vouchers.firstLoginAt` dan `expiresAt` disimpan sebagai WIB naive DATETIME di MySQL. Prisma append `Z` saat baca ? angka epoch 7 jam terlalu besar. Sebelum mengirim ke browser, wajib koreksi: `new Date(voucher.firstLoginAt).getTime() - TZ_OFFSET_MS`. Berlaku di `src/app/api/sessions/route.ts` dan `src/app/api/agent/sessions/route.ts`. Jangan pakai `.toISOString()` langsung dari Prisma result untuk hotspot timestamps.

50. **Hotspot sessions hilang dari admin page padahal device masih konek di MikroTik (Mar 7, 2026)?** ? Penyebab: `Accounting-Stop` (Lost-Carrier/Session-Timeout) dikirim MikroTik ? FreeRADIUS set `acctstoptime` ? query `WHERE acctstoptime IS NULL` tidak mengembalikan row. Fix di `src/app/api/sessions/route.ts` step 4.5: setelah build sessions dari radacct, query MikroTik `/ip/hotspot/active/print`, bandingkan username dengan sessions yang ada, untuk yang hilang buat synthetic session `dataSource: 'live'` menggunakan `voucher.firstLoginAt` (TZ-corrected) sebagai startTime. Helper `parseMikrotikUptime()` untuk parse string `"3d9h5m3s"` ? seconds (fallback jika firstLoginAt null).

51. **Duration kolom hotspot sessions menampilkan countdown, bukan uptime (Mar 7, 2026)?** ? Admin hotspot page (`src/app/admin/sessions/hotspot/page.tsx`) dan agent sessions page (`src/app/agent/sessions/page.tsx`) kini menampilkan sisa waktu: `liveCountdown = Math.max(0, floor((expiresAt - now) / 1000))`, ditampilkan sebagai `"Xm Ys left"`. API mengembalikan `expiresAt` (TZ-corrected UTC ISO string) dalam object `voucher` atau field top-level di agent sessions. Fallback ke uptime (`liveDuration`) jika `expiresAt` null.

52. **Agent sessions page hardcoded `text-white` (Mar 7, 2026)?** ? `src/app/agent/sessions/page.tsx`: sel IP address dan Duration pakai `text-white` hardcoded ? invisible di light mode. Fix: `text-slate-900 dark:text-white`. Selalu gunakan dual-class `text-slate-900 dark:text-white` untuk teks data table agar visible di kedua tema.

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

# Deployment (from Windows PowerShell � use & not &&)
& "C:\Program Files\PuTTY\pscp.exe" -pw "Seven789@" -batch "<local>" "root@103.151.140.110:<remote>"
& "C:\Program Files\PuTTY\plink.exe" -pw "Seven789@" -batch "root@103.151.140.110" "<command>"

# VPS: Clean rebuild + restart
& "C:\Program Files\PuTTY\plink.exe" -pw "Seven789@" -batch "root@103.151.140.110" "cd /var/www/salfanet-radius && rm -rf .next && npm run build 2>&1 | tail -5 && pm2 restart salfanet-radius && sleep 2 && pm2 status"

# PM2
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

**?? This file is automatically updated when significant changes are made to the project.**

**For questions or additions, check the documentation index or recent changes log above.**
