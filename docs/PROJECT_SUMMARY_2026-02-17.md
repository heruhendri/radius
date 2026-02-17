# 📋 RANGKUMAN PROJECT SALFANET RADIUS v2.9.0

**Tanggal:** 17 Februari 2026  
**Tujuan:** Referensi untuk melanjutkan project di chat baru

---

## 🏗️ Tentang Project

**SALFANET RADIUS** — Sistem billing ISP dengan RADIUS authentication untuk PPPoE users, hotspot voucher, dan integrasi MikroTik.

**Tech Stack:**
- **Frontend:** Next.js 16 + React 19 + TypeScript
- **Database:** Prisma ORM + MySQL (Laragon di dev, MariaDB/MySQL di production)
- **Auth:** NextAuth v4
- **RADIUS:** FreeRADIUS + radcheck/radreply/radusergroup/radgroupreply tables
- **Router:** MikroTik RouterOS via node-routeros API
- **Payment:** Midtrans, Xendit, Duitku
- **Cron:** node-cron (PM2 managed)
- **i18n:** next-intl (Indonesian + English)

---

## 📅 Riwayat Perubahan Terakhir (1-2 Feb 2026)

### Session 1 — 1 Feb 2026: Translation & API Fix
- Fixed translation keys `isolation.*` yang nested salah di `src/locales/en.json`
- Fixed API 404 karena company record belum ada di database
- Created `check-company.js` script

### Session 2 — 2 Feb 2026 (Pagi): Isolation System Enhancement
**Critical Bug Found & Fixed:** Sistem menggunakan **SUSPENDED** (block login) bukan **ISOLATED** (allow login, restricted access). User tidak bisa login dan bayar!

**Perubahan besar (11 file baru + 4 file updated):**
- `src/proxy.ts` — Auto-detect isolated IP, redirect ke `/isolated`
- `src/app/admin/isolated-users/page.tsx` — Monitoring dashboard
- `src/app/api/admin/isolated-users/route.ts` — Dashboard API
- `src/app/api/admin/isolate-user/route.ts` — Manual isolation API
- `src/lib/cron/auto-isolation.ts` — Enhanced auto-isolation cron
- 6 dokumentasi di `docs/`

**Workflow Isolasi:**
```
Expire → ISOLATED → Login → IP pool-isolir (192.168.200.x) → MikroTik firewall block
→ NAT redirect ke /isolated → User bayar → Webhook → Auto-restore → Full access
```

### Session 3 — 2 Feb 2026 (Siang): Fixes & Completion
- Fixed **7 TypeScript errors** (verifyAuth, schema mismatch, null checks)
- Added "Isolated Users" menu ke admin layout
- Fixed **11 duplicate keys** di `id.json`
- Migrated `middleware.ts` → `proxy.ts` (Next.js 16 compatibility)

### Session 4 — 2 Feb 2026 (Sore): Notification & Dynamic Config
- **15+ notification types** ditambahkan ke `src/lib/notifications.ts`
- **Session monitor** `src/lib/session-monitor.ts` dan **auth monitor** `src/lib/auth-monitor.ts`
- **Dynamic IP isolation config** `src/lib/isolation-settings.ts` — IP pool configurable via database (5-min cache)
- **Isolation settings API** `src/app/api/admin/settings/isolation/route.ts` — GET/PUT
- **MikroTik script generator** `src/app/api/admin/settings/isolation/mikrotik-script/route.ts`
- **Critical fix:** `src/lib/cron/pppoe-sync.ts` — Separated BLOCKED/STOP (reject login) dari ISOLATED (allow login)
- **Critical fix:** `src/app/api/radius/authorize/route.ts` — Hanya reject BLOCKED/STOP, bukan ISOLATED
- Database seed dijalankan, radgroupreply 'isolir' configured
- Cleanup project, fixed **15 implicit `any` TypeScript errors**
- **TypeScript Errors: 0** ✅

---

## 🔑 Status Logic PPPoE User (PENTING!)

| Status | Login | Akses Internet | Keterangan |
|--------|-------|----------------|------------|
| **ACTIVE** | ✅ | ✅ Full | Normal user |
| **ISOLATED** | ✅ | ❌ Restricted | Expired, get IP pool-isolir, redirect ke halaman isolasi, bisa bayar |
| **BLOCKED** | ❌ Reject | ❌ | Admin block manual (Auth-Type=Reject) |
| **STOP** | ❌ Reject | ❌ | Langganan dihentikan (Auth-Type=Reject) |

**PENTING:** Status `String` (bukan enum) — flexible tapi perlu hati-hati casing.

---

## 📊 File-File Utama Isolation System

| File | Fungsi | Lines |
|------|--------|-------|
| `src/lib/cron/pppoe-sync.ts` | Auto-isolation cron (hourly), enforce BLOCKED/STOP reject | 382 |
| `src/lib/cron/auto-isolation.ts` | Enhanced auto-isolation logic, true isolation (not suspension) | 314 |
| `src/lib/isolation-settings.ts` | Dynamic IP config dari DB, 5-min cache, CIDR parsing | 162 |
| `src/lib/notifications.ts` | 15+ notification types (isolation, reactivation, bulk, security) | 364 |
| `src/lib/session-monitor.ts` | Monitor suspicious login, concurrent sessions | 158 |
| `src/lib/auth-monitor.ts` | Log auth attempts, integrate with session monitor | 114 |
| `src/proxy.ts` | Auto-detect isolated IP → redirect `/isolated`, dynamic settings | 96 |
| `src/app/api/radius/authorize/route.ts` | RADIUS authorization, reject BLOCKED/STOP only | 159 |
| `src/app/api/admin/settings/isolation/route.ts` | GET/PUT isolation settings API | 160 |
| `src/app/api/admin/settings/isolation/mikrotik-script/route.ts` | Auto-generate MikroTik config script | 141 |
| `src/app/admin/isolated-users/page.tsx` | Monitoring dashboard (stats, search, export CSV) | 426 |
| `src/app/api/admin/isolated-users/route.ts` | Dashboard API (users + sessions + invoices) | 122 |
| `src/app/api/admin/isolate-user/route.ts` | Manual isolation API | 31 |
| `prisma/seeds/seed-all.ts` | Database seed including RADIUS 'isolir' group | 395 |

---

## 🗄️ Database Schema — Isolation Fields

### Company Table (12 isolation config fields):
```
isolationEnabled        Boolean   default: true
isolationIpPool         String    default: "192.168.200.0/24"
isolationRateLimit      String    default: "64k/64k"
isolationRedirectUrl    String?   null
isolationMessage        String?   null (deprecated — use templates)
isolationAllowDns       Boolean   default: true
isolationAllowPayment   Boolean   default: true
isolationNotifyWhatsapp Boolean   default: true
isolationNotifyEmail    Boolean   default: false
isolationWhatsappTemplateId  String?  null
isolationEmailTemplateId     String?  null
isolationHtmlTemplateId      String?  null
```

### RADIUS 'isolir' Group (radgroupreply):
```sql
('isolir', 'Mikrotik-Group',      ':=', 'isolir')
('isolir', 'Mikrotik-Rate-Limit', ':=', '64k/64k')  -- dynamic dari DB
('isolir', 'Session-Timeout',     ':=', '86400')
('isolir', 'Framed-Pool',         ':=', 'pool-isolir')
```

### PPPoE User Model:
```
status               String    default: "active"  -- ACTIVE, ISOLATED, BLOCKED, STOP
autoIsolationEnabled Boolean   default: true
expiredAt            DateTime? -- null untuk POSTPAID
subscriptionType     Enum      -- PREPAID, POSTPAID
balance              Int       default: 0
autoRenewal          Boolean   default: false
```

### Isolation Template Model:
```
type: whatsapp | email | html_page
name, subject, message, variables (Json), isActive
```

---

## 🔄 Complete Isolation Workflow

```
┌─────────────────────────────────────────────────┐
│ 1. USER EXPIRES (expiredAt < NOW)               │
│    Cron: autoIsolatePPPoEUsers() - hourly       │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│ 2. RADIUS UPDATE                                │
│    - Status → ISOLATED                          │
│    - Keep password (allow login!)               │
│    - Remove Auth-Type=Reject                    │
│    - Move to group 'isolir'                     │
│    - Remove static IP                           │
│    - Send CoA disconnect                        │
│    - Create notification                        │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│ 3. USER RE-LOGIN (PPPoE)                        │
│    - FreeRADIUS: password ✅ (radcheck)         │
│    - Group: 'isolir' (radusergroup)             │
│    - Reply: Framed-Pool=pool-isolir             │
│    - MikroTik: IP from 192.168.200.x           │
│    - Rate-Limit: 64k/64k                       │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│ 4. USER BROWSING                                │
│    - MikroTik firewall: block internet          │
│    - Allow: DNS, billing server, payment GW     │
│    - NAT redirect HTTP → billing server         │
│    - proxy.ts: detect IP → redirect /isolated   │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│ 5. ISOLATION PAGE (/isolated)                   │
│    - Shows: "Layanan Anda diisolir"             │
│    - User info, expired date                    │
│    - Unpaid invoices with payment links         │
│    - Button "Bayar Sekarang"                    │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│ 6. PAYMENT                                      │
│    - Redirect ke /pay/<token>                   │
│    - MikroTik allows payment gateway access     │
│    - User bayar (QRIS/VA/E-Wallet)             │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│ 7. WEBHOOK → AUTO-RESTORE                       │
│    - Invoice status → PAID                      │
│    - Status → ACTIVE                            │
│    - Restore original group & static IP         │
│    - CoA disconnect (force re-auth)             │
│    - User re-login → FULL ACCESS ✅             │
└─────────────────────────────────────────────────┘
```

---

## 🔧 MikroTik Configuration (Summary)

```routeros
# IP Pool
/ip pool add name=pool-isolir ranges=192.168.200.2-192.168.200.254

# PPP Profile
/ppp profile add name=isolir pool=pool-isolir rate-limit=64k/64k

# Firewall Filter
/ip firewall filter
add chain=forward src-address=192.168.200.0/24 protocol=udp dst-port=53 action=accept
add chain=forward src-address=192.168.200.0/24 dst-address=BILLING_IP action=accept
add chain=forward src-address=192.168.200.0/24 dst-address-list=payment-gateways action=accept
add chain=forward src-address=192.168.200.0/24 action=drop

# NAT Redirect
/ip firewall nat
add chain=dstnat src-address=192.168.200.0/24 protocol=tcp dst-port=80 action=dst-nat to-addresses=BILLING_IP

# Payment Gateway Address List
/ip firewall address-list
add list=payment-gateways address=api.midtrans.com
add list=payment-gateways address=api.xendit.co
add list=payment-gateways address=passport.duitku.com

# RADIUS & CoA
/radius add address=RADIUS_IP secret=SECRET service=ppp
/radius incoming set accept=yes port=3799
```

**PENTING:** Replace `BILLING_IP` dan `RADIUS_IP` dengan IP server asli. MikroTik **TIDAK** support hostname di firewall!

---

## ⚠️ Known Issues & TODO

### Bugs/Issues:
1. **Build error:** `src/app/agent/dashboard/page.tsx` line 142 — `setCurrentPage` not found (tidak terkait isolation)
2. **`verifyAuth()`** di `src/lib/auth.ts` — masih placeholder, perlu proper JWT verification
3. **WhatsApp/Email services** — commented out, console.log placeholder saja
4. **Case inconsistency:** Status kadang `ISOLATED` kadang `isolated` (perlu standardisasi)
5. **Migration files pending:** 4 migrations belum ter-apply (schema sudah sync via `db push`)

### Pending Testing:
- [ ] `npm run build` — Test production build (fix agent dashboard error dulu)
- [ ] Configure MikroTik (generate script dari admin panel, apply ke router)
- [ ] Test manual isolation: `POST /api/admin/isolate-user`
- [ ] Test user re-login: verify dapat IP dari pool-isolir
- [ ] Test auto-redirect: browse → redirect ke `/isolated`
- [ ] Test payment flow: gateway accessible dari isolation
- [ ] Test auto-restore setelah payment

### Enhancement Ideas:
- [ ] Implement WhatsApp notification service (real integration)
- [ ] Implement Email notification service
- [ ] Add batch isolation actions
- [ ] Create isolation history report
- [ ] Fix agent dashboard build error (`setCurrentPage`)
- [ ] Standardize status casing (ISOLATED vs isolated)
- [ ] Implement proper `verifyAuth()` JWT verification
- [ ] Add real-time WebSocket updates untuk monitoring dashboard

---

## 📁 Dokumentasi Terkait

| Dokumen | Isi |
|---------|-----|
| `docs/QUICK_START_ISOLATION.md` | 5 menit setup guide |
| `docs/ISOLATION_SYSTEM_WORKFLOW.md` | Architecture lengkap (1000+ lines) |
| `docs/ISOLATION_TESTING_GUIDE.md` | 7-phase testing checklist |
| `docs/FIREWALL_PAYMENT_INTEGRATION.md` | MikroTik firewall + payment |
| `docs/ISOLATION_NAT_VS_PROXY.md` | Why NAT redirect, bukan web proxy |
| `docs/IMPLEMENTATION_SUMMARY.md` | Complete changes overview |
| `docs/NOTIFICATION_SYSTEM_COMPLETE.md` | Notification system docs |
| `CHAT_HISTORY_2026-02-01_ISOLATION_TRANSLATION_FIX.md` | Chat history session 1 |
| `CHAT_HISTORY_2026-02-02_ISOLATION_SYSTEM_ENHANCEMENT.md` | Chat history session 2 |
| `docs/CHAT_HISTORY_2026-02-02_ISOLATION_FIXES_AND_COMPLETION.md` | Chat history session 3 |

---

## 🔧 Quick Commands

```bash
# Development
npm run dev                    # Start dev server (port 3000)

# Database (Laragon di Windows)
npx prisma db push             # Sync schema ke database
npx prisma db seed             # Populate data (seed)
npx prisma generate            # Regenerate Prisma client
npx prisma studio              # Visual database browser

# MySQL (Laragon path)
# C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe

# Production
npm run build                  # Build for production
pm2 restart salfanet-radius    # Restart main app
pm2 restart salfanet-cron      # Restart cron service
pm2 logs                       # View logs

# Admin Login (default)
# Username: superadmin
# Password: admin123
```

---

## 🎯 Success Criteria — Isolation System

Sistem bekerja dengan benar ketika:
1. ✅ Expired user bisa login (tidak di-reject)
2. ✅ User mendapat IP 192.168.200.x (isolated pool)
3. ✅ User browsing auto-redirect ke `/isolated` page
4. ✅ Isolation page menampilkan invoice + link bayar
5. ✅ User bisa akses payment gateway (Midtrans/Xendit/Duitku)
6. ✅ Setelah bayar, user auto-restore dalam 5 menit
7. ✅ User re-login mendapat IP normal + full internet access

**Test semua 7 kriteria sebelum dinyatakan production-ready!**

---

**END OF SUMMARY — 17 Februari 2026**
