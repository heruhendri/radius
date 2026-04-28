# SALFANET RADIUS - Billing System for ISP/RTRW.NET

Modern, full-stack billing & RADIUS management system for ISP/RTRW.NET with FreeRADIUS integration supporting PPPoE and Hotspot authentication.

> **Latest:** v2.25.2 — Native Baileys WhatsApp gateway built-in di VPS, QR modal auto-retry, auto-reconnect setelah device disconnect (Apr 26, 2026)

---

## 🤖 AI Development Assistant

**READ FIRST:** [docs/AI_PROJECT_MEMORY.md](docs/AI_PROJECT_MEMORY.md) — contains full architecture, VPS details, DB schema, known issues, and proven solutions.

---

## 🎯 Features

| Category | Key Capabilities |
|----------|-----------------|
| **RADIUS / Auth** | FreeRADIUS 3.0.26, PAP/CHAP/MS-CHAP, VPN L2TP/IPSec, PPPoE & Hotspot, CoA real-time speed/disconnect |
| **VPN Management** | MikroTik CHR via API, VPS built-in WireGuard & L2TP/IPsec peer management, configurable IP pool & gateway per protocol, auto-generated RouterOS scripts |
| **PPPoE Management** | Customer accounts, profile-based bandwidth, isolation, IP assignment, MikroTik auto-sync, foto KTP+instalasi via kamera HP, GPS otomatis |
| **Hotspot Voucher** | 8 code types, batch up to 25,000, agent distribution, auto-sync with RADIUS, print templates |
| **Billing** | Postpaid/prepaid invoices, auto-generation, payment reminders, balance/deposit, auto-renewal |
| **Payment** | Manual upload (bukti transfer), Midtrans/Xendit/Duitku gateway, approval workflow, 0–5 bank accounts |
| **Notifications** | WhatsApp (Fonnte/WAHA/GOWA/MPWA/Wablas/WABlast/**Kirimi.id**/**Baileys native**), Email SMTP, broadcast (outage/invoice/payment), webhook pesan masuk |
| **Agent/Reseller** | Balance-based voucher generation, commission tracking, sales stats |
| **Financial** | Income/expense tracking with categories, keuangan reconciliation |
| **Network (FTTH)** | OLT/ODC/ODP management, customer port assignment, network map, distance calculation |
| **GenieACS TR-069** | CPE/ONT management, WiFi config (SSID/password), device status & uptime |
| **Isolation** | Auto-isolate expired customers, customizable WhatsApp/Email/HTML landing page templates |
| **Cron Jobs** | 16 automated background jobs (tsx runner via PM2 fork), history, distributed locking, manual trigger |
| **Roles & Permissions** | 53 permissions, 5 portals (Admin/Customer/Agent/Technician + SuperAdmin) |
| **Activity Log** | Audit trail with auto-cleanup (30 days) |
| **Security** | Session timeout 30 min, idle warning, RBAC, HTTPS/SSL |
| **Bahasa** | Bahasa Indonesia (full) |
| **PWA** | Installable di semua portal (admin, customer, agent, technician), offline fallback, service worker cache |
| **Web Push** | VAPID-based browser push notifications, subscribe/unsubscribe toggle, admin broadcast |
| **System Update** | Update via SSH menggunakan `updater.sh`, tidak ada web-based update |
| **Mobile App** | Flutter customer portal (WiFi control, invoice, payment) |
| **WhatsApp Baileys** | Native WhatsApp gateway built-in VPS via `@whiskeysockets/baileys`, PM2 proses terpisah, scan QR langsung di admin panel, auto-reconnect |

---

## 📱 WhatsApp Baileys (Native Gateway)

Provider WhatsApp bawaan tanpa layanan pihak ketiga. Berjalan sebagai proses PM2 terpisah (`salfanet-wa`) di VPS.

### Setup

Provider Baileys otomatis di-setup saat menjalankan `updater.sh`. Tidak ada konfigurasi tambahan.

```bash
# Cek status wa-service
pm2 status
pm2 logs salfanet-wa --lines 20
```

### Cara Pakai

1. Buka **Admin → Pengaturan → WhatsApp → Penyedia**
2. Klik **+ Tambah Provider**, pilih tipe **Baileys**
3. Klik **QR Code** → scan dengan HP (WhatsApp → Linked Devices)
4. Setelah scan berhasil, modal menampilkan centang hijau konfirmasi
5. Provider siap digunakan untuk kirim notifikasi

### PM2 Processes

| Process | Mode | Port | Purpose |
|---------|------|------|---------|
| `salfanet-radius` | cluster | 3000 | Next.js app |
| `salfanet-wa` | fork | 4000 (internal) | Baileys WA service |
| `salfanet-cron` | fork | — | Background jobs |

### Auth Session

Session WhatsApp tersimpan di `/var/data/salfanet/baileys_auth/` dan persist meski PM2 restart. Untuk logout/scan ulang, klik **Restart Session** di admin panel.

---

## 🚀 Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router, standalone output) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | MySQL 8.0 + Prisma ORM |
| RADIUS | FreeRADIUS 3.0.26 |
| Process Manager | PM2 (cluster × 2) |
| Session Tracking | FreeRADIUS radacct (real-time) |
| Maps | Leaflet / OpenStreetMap |

---

## 📁 Project Structure

```
salfanet-radius/
├── src/
│   ├── app/
│   │   ├── admin/          # Admin panel
│   │   ├── agent/          # Agent/reseller portal
│   │   ├── api/            # API route handlers
│   │   ├── customer/       # Customer self-service portal
│   │   └── technician/     # Technician portal
│   ├── server/             # DB, services, jobs, cache, auth
│   ├── features/           # Vertical slices (queries, schemas, types)
│   ├── components/         # Shared React components
│   ├── locales/            # i18n translations (id, en)
│   └── types/              # Shared TypeScript types
├── prisma/
│   ├── schema.prisma       # Database schema (~45 models)
│   └── seeds/              # Seed scripts
├── freeradius-config/      # FreeRADIUS config (deployed by installer)
├── vps-install/            # One-command VPS installer scripts
├── production/             # PM2 & Nginx config templates
├── mobile-app/             # Flutter customer app
├── scripts/                # Utility & tuning scripts
└── docs/                   # Documentation & AI memory
```

---

## ⚙️ Installation

### Metode 1 — Git Clone (Recommended)

```bash
ssh root@YOUR_VPS_IP

git clone https://github.com/s4lfanet/salfanet-radius.git /root/salfanet-radius
cd /root/salfanet-radius
bash vps-install/vps-installer.sh
```

Installer akan berjalan **interaktif** — mendeteksi environment otomatis, memandu konfigurasi, lalu menjalankan semua step.

---

### Metode 2 — Upload Manual via SCP (Tanpa Akses Internet di Server)

```bash
# Jalankan di terminal LOKAL (bukan di server)
scp -r ./salfanet-radius root@YOUR_VPS_IP:/root/salfanet-radius

# SSH ke server, lalu jalankan installer
ssh root@YOUR_VPS_IP
cd /root/salfanet-radius
bash vps-install/vps-installer.sh
```

---

### Environment yang Didukung

| Environment | Flag | Akses |
|------------|------|-------|
| **Public VPS** (DigitalOcean, Vultr, Hetzner, AWS) | `--env vps` | Internet |
| **Proxmox LXC** | `--env lxc` | LAN/VLAN |
| **Proxmox VM / VirtualBox** | `--env vm` | LAN |
| **Bare Metal / Server Fisik** | `--env bare` | LAN |

```bash
# Contoh: paksa environment + IP
bash vps-install/vps-installer.sh --env lxc --ip 192.168.1.50
```

---

### Updating Existing Installation

Cara paling aman. **Semua data upload (logo, foto KTP pelanggan, bukti bayar) otomatis dipreservasi.**

```bash
bash /var/www/salfanet-radius/vps-install/updater.sh
```

Atau update dari branch terbaru secara manual:

```bash
cd /var/www/salfanet-radius
git pull origin master
npm install --legacy-peer-deps
npx prisma db push
npm run build
pm2 reload all
```

Lihat detail lengkap di [vps-install/README.md](vps-install/README.md).

---

### Data yang Aman Saat Update

| Data | Status |
|------|--------|
| Logo perusahaan (`public/uploads/logos/`) | ✅ Dipreservasi |
| Foto KTP & dokumen pelanggan | ✅ Dipreservasi |
| Bukti pembayaran | ✅ Dipreservasi |
| File `.env` (database, secrets) | ✅ Tidak disentuh |
| **Database MySQL (semua data pelanggan)** | ✅ Tidak disentuh |

---

### Default Credentials

| | |
|--|--|
| Admin URL | `http://YOUR_VPS_IP/admin/login` |
| Username | `superadmin` |
| Password | `admin123` |

⚠️ **Ganti password segera setelah login pertama!**

---

## 🔌 FreeRADIUS

Key config files at `/etc/freeradius/3.0/`:

| File | Purpose |
|------|---------|
| `mods-enabled/sql` | MySQL connection for user auth |
| `mods-enabled/rest` | REST API for voucher management |
| `sites-enabled/default` | Main auth logic (PPPoE realm support) |
| `clients.conf` | NAS/router clients (+ `$INCLUDE clients.d/`) |
| `sites-enabled/coa` | CoA/Disconnect-Request virtual server |

Config backup in `freeradius-config/` is auto-deployed by the installer.

### Auth Flow

**PPPoE:** `MikroTik → FreeRADIUS → MySQL (radcheck/radusergroup/radgroupreply)` → Access-Accept with Mikrotik-Rate-Limit

**Hotspot Voucher:** Same RADIUS path + `REST /api/radius/post-auth` → sets firstLoginAt, expiresAt, syncs keuangan

### RADIUS Tables

| Table | Purpose |
|-------|---------|
| `radcheck` | User credentials |
| `radreply` | User-specific reply attrs |
| `radusergroup` | User → Group mapping |
| `radgroupreply` | Group reply (bandwidth, session timeout) |
| `radacct` | Session accounting |
| `nas` | NAS/Router clients (dynamic) |

---

## ⏰ Cron Jobs (16 automated)

| Job | Schedule | Function |
|-----|----------|----------|
| Voucher Sync | Every 5 min | Sync voucher status with RADIUS |
| Disconnect Sessions | Every 5 min | CoA disconnect expired vouchers |
| Auto Isolir (PPPoE) | Every hour | Suspend overdue customers |
| FreeRADIUS Health | Every 5 min | Auto-restart if down |
| PPPoE Session Sync | Every 10 min | Sync radacct sessions |
| Agent Sales | Daily 1 AM | Update sales statistics |
| Invoice Generate | Daily 2 AM | Generate monthly invoices |
| Activity Log Cleanup | Daily 2 AM | Delete logs >30 days |
| Invoice Reminder | Daily 8 AM | Send payment reminders |
| Invoice Status | Daily 9 AM | Mark overdue invoices |
| Notification Check | Every 10 min | Process notification queue |
| Auto Renewal | Daily 8 AM | Prepaid auto-renew from balance |
| Webhook Log Cleanup | Daily 3 AM | Delete webhook logs >30 days |
| Session Monitor | Every 5 min | Security session monitoring |
| Cron History Cleanup | Daily 4 AM | Keep last 50 per job type |
| Suspend Check | Every hour | Activate/restore suspend requests |

All jobs can be triggered manually from **Settings → Cron** in the admin panel.

---

## � Android APK Builder

Buat APK Android (WebView wrapper) untuk 4 portal langsung di server VPS — tanpa GitHub Actions, tanpa Android Studio.

### 1) Setup Android SDK (satu kali via SSH)

```bash
apt-get update && apt-get install -y openjdk-17-jdk wget unzip && \
mkdir -p /opt/android/cmdline-tools && \
wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdtools.zip && \
unzip -q /tmp/cmdtools.zip -d /opt/android/cmdline-tools && \
mv /opt/android/cmdline-tools/cmdline-tools /opt/android/cmdline-tools/latest && \
yes | /opt/android/cmdline-tools/latest/bin/sdkmanager --licenses && \
/opt/android/cmdline-tools/latest/bin/sdkmanager "platforms;android-34" "build-tools;34.0.0" && \
echo 'export ANDROID_HOME=/opt/android' >> /etc/environment && \
echo 'Selesai!'
```

> **Perkiraan waktu:** ~5–10 menit (download ~500MB). Disk yang dibutuhkan: ~2GB.

### 2) Build APK via Admin Panel

Buka **Admin → Download Aplikasi Android** → klik **Build APK** pada role yang diinginkan.

- Build berjalan di background (tidak timeout meski butuh beberapa menit)
- Status diperbarui otomatis setiap 3 detik
- Setelah selesai, tombol **Download APK** muncul

### 3) Build via API (opsional)

```bash
# Cek environment
curl http://YOUR_VPS/api/admin/apk/trigger

# Mulai build (role: admin | customer | technician | agent)
curl -X POST http://YOUR_VPS/api/admin/apk/trigger?role=customer \
  -H "Cookie: next-auth.session-token=..."

# Cek status
curl http://YOUR_VPS/api/admin/apk/status?role=customer

# Download APK
curl -OJ http://YOUR_VPS/api/admin/apk/file?role=customer \
  -H "Cookie: next-auth.session-token=..."
```

### Storage APK

| Path | Keterangan |
|------|------------|
| `/var/data/salfanet/apk/{role}/app.apk` | File APK hasil build |
| `/var/data/salfanet/apk/{role}/status.json` | Status & metadata build |
| `/var/data/salfanet/apk/{role}/build.log` | Log Gradle |
| `/var/data/salfanet/gradle-cache` | Cache Gradle (mempercepat build berikutnya) |

### Paket Aplikasi

| Role | Package ID | Warna |
|------|-----------|-------|
| Admin | `net.salfanet.admin` | Biru |
| Customer | `net.salfanet.customer` | Cyan |
| Technician | `net.salfanet.technician` | Hijau |
| Agent | `net.salfanet.agent` | Ungu |

---

## �🛠️ Common Commands

```bash
# PM2
pm2 status ; pm2 logs salfanet-radius
pm2 restart ecosystem.config.js --update-env

# FreeRADIUS
systemctl restart freeradius
freeradius -XC    # Test config
radtest 'user@realm' password 127.0.0.1 0 testing123

# Database
mysql -u salfanet_user -psalfanetradius123 salfanet_radius
mysqldump -u salfanet_user -psalfanetradius123 salfanet_radius > backup.sql
```

---

## 🧯 Troubleshooting Cepat

### 1) Website tidak bisa diakses dari IP VPS

Jika `Nginx` dan app sudah jalan di server tapi dari internet tetap tidak bisa akses, biasanya masalah ada di layer jaringan (NAT/forwarding/firewall external), bukan di aplikasi.

```bash
# Di VM/VPS guest
ss -tulpn | grep -E ':80|:443|:3000'
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1
systemctl status nginx --no-pager
pm2 status
```

Jika semua check local di atas OK, cek mapping di host Proxmox/router/cloud firewall:

1. `Public:2020 -> VM:22` (SSH)
2. `Public:80 -> VM:80` (HTTP)
3. `Public:443 -> VM:443` (HTTPS)

Catatan: `IP:2020` adalah port SSH, bukan URL web aplikasi.

### 2) PM2 jalan tapi web tetap blank/error

```bash
pm2 status
pm2 logs salfanet-radius --lines 100
cd /var/www/salfanet-radius
npm run build
pm2 restart ecosystem.config.js --update-env
```

### 4) Jalankan diagnosa Nginx otomatis dari installer

Installer Nginx terbaru menambahkan self-check internal (`127.0.0.1:3000`, `127.0.0.1`) dan best-effort check publik (HTTP/HTTPS).

```bash
cd /var/www/salfanet-radius
bash vps-install/install-nginx.sh
```

Jika warning menunjukkan HTTP publik tidak reachable, fokus perbaikan di NAT/port-forward/security-group, bukan di Next.js.

---

## 🔐 Security

```bash
# Firewall
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw allow 1812/udp && ufw allow 1813/udp && ufw allow 3799/udp
```

1. Change default admin password on first login
2. Change MySQL passwords in `.env`
3. Configure SSL (Let's Encrypt or Cloudflare)
4. Enable UFW

---

## 📡 CoA (Change of Authorization)

Sends real-time speed/disconnect commands to MikroTik without dropping PPPoE connections.

**MikroTik requirement:** `/radius incoming set accept=yes port=3799`

**API:** `POST /api/radius/coa` — actions: `disconnect`, `update`, `sync-profile`, `test`

Auto-triggered when: PPPoE profile speed is edited (syncs all active sessions).

---

## 📲 WhatsApp Providers

| Provider | Base URL | Auth |
|----------|----------|------|
| Fonnte | `https://api.fonnte.com/send` | Token |
| WAHA | `http://IP:PORT` | API Key |
| GOWA | `http://IP:PORT` | `user:pass` |
| MPWA | `http://IP:PORT` | API Key |
| Wablas | `https://pati.wablas.com` | Token |

---

## ⏱️ Timezone

| Layer | Timezone | Note |
|-------|----------|------|
| Database (Prisma) | UTC | Prisma default |
| FreeRADIUS | WIB (UTC+7) | Server local time |
| PM2 env | WIB | `TZ: 'Asia/Jakarta'` in ecosystem.config.js |
| API / Frontend | WIB | Auto-converts UTC ↔ WIB |

For WITA (UTC+8) or WIT (UTC+9): change `TZ` in `.env`, `ecosystem.config.js`, and `src/lib/timezone.ts`.

---

## 📋 Admin Modules

Dashboard · PPPoE · Hotspot · Agent · Invoice · Payment · Keuangan · Sessions · WhatsApp · Network (OLT/ODC/ODP) · GenieACS · Settings

**Roles:** SUPER_ADMIN · FINANCE · CUSTOMER_SERVICE · TECHNICIAN · MARKETING · VIEWER

---

## 📝 Changelog

Bagian ini otomatis sinkron dari `CHANGELOG.md` saat file changelog berubah di GitHub.

<!-- AUTO-CHANGELOG:START -->

### v2.25.6 — 2026-04-28

### Fixed
- **Tema terang agent portal — seluruh teks/border neon tidak terbaca** — Halaman `vouchers`, `sessions`, dan `tickets` portal agen masih menggunakan warna hex neon (`#00f7ff`, `#bc13fe`, `#ff44cc`, `#00ff88`, dll.) yang di theme terang menjadi tidak terbaca karena di-override oleh `globals.css`. Seluruh warna tersebut diganti dengan pasangan class Tailwind standar yang aman untuk light dan dark mode.

### Added
- **Input lokasi GPS di form tiket agen** — Form "Buat Tiket" portal agen kini memiliki field tag lokasi (teks manual) dan tombol GPS yang mengambil koordinat dari browser (`navigator.geolocation`). Lokasi dan link Google Maps otomatis disisipkan ke deskripsi tiket agar teknisi lebih mudah menemukan lokasi pelanggan.

### Changed
- **Redesign UI agent/vouchers — pure Tailwind dark/light** — Loading spinner, container utama, filter controls, mobile cards, desktop table, pagination, dan dialog WhatsApp semuanya diperbarui ke class Tailwind standar (`bg-white dark:bg-slate-800/60`, `border-slate-200 dark:border-slate-700`, status badge `bg-emerald-100 text-emerald-700`, dll.).
- **Redesign UI agent/sessions — pure Tailwind dark/light** — Header, tombol refresh, stats cards (cyan/emerald/pink), search bar, daftar sesi (mobile card + desktop table) diperbarui; upload `text-emerald-600 dark:text-emerald-400`, download `text-pink-600 dark:text-pink-400`.
- **Redesign UI agent/tickets — pure Tailwind dark/light** — Header, tombol "Buat Tiket", form tiket, filter status, daftar tiket, chat bubble, dan reply box diperbarui dari neon gradient ke `from-violet-600 to-cyan-600`; active filter `bg-violet-100 dark:bg-violet-500/20`.

### Affected
- `src/app/agent/vouchers/page.tsx`
- `src/app/agent/sessions/page.tsx`
- `src/app/agent/tickets/page.tsx`

### v2.25.5 — 2026-04-28

### Added
- **APK Android: notifikasi native dengan suara, getaran & floating** — APK WebView kini menyertakan `NotificationChannel` (Android 8+), JavaScript bridge (`Android.showNotificationWithTag`) yang terhubung ke service worker push event (`PUSH_RECEIVED`), serta `NotificationWorker` berbasis WorkManager yang polling `/api/notifications` setiap 15 menit di background. Notifikasi tampil dengan prioritas HIGH, suara default, getaran, dan heads-up notification bahkan saat aplikasi ditutup.
- **Logo square 1:1 di semua halaman** — Semua container logo (login Admin/Customer/Technician/Agent, sidebar admin, settings company, download APK, halaman isolated) kini menggunakan rasio persegi (1:1) dengan `object-contain` sehingga logo 512×200 ditampilkan dalam kanvas 512×512 dengan letterbox — tidak distretch.

### v2.25.4 — 2026-04-28

### Added
- **Input lokasi GPS di form tiket pelanggan** — Halaman pembuatan tiket pelanggan kini mendukung tag lokasi, pengambilan koordinat GPS dari browser, dan penyisipan link Google Maps otomatis ke deskripsi tiket agar teknisi lebih mudah menemukan rumah pelanggan.
- **Tanggal Register editable untuk user PPPoE** — Form tambah dan edit user PPPoE kini menyediakan field `Tanggal Register` yang tersimpan ke `createdAt`, sehingga data historis pelanggan bisa dikoreksi tanpa manipulasi database manual.
- **Logo perusahaan di sidebar admin** — Sidebar admin kini menampilkan logo perusahaan secara langsung dengan fallback ke inisial jika logo belum tersedia.

### Fixed
- **CSV import/export PPPoE belum mendukung `registeredAt`** — Template CSV/XLSX, normalization map import, dan parsing data bulk kini mendukung `Tanggal Register` / `registeredAt` sehingga tanggal registrasi historis tidak lagi hilang saat impor massal.
- **Penyimpanan rate limit isolir ke tabel RADIUS tidak pernah update** — Endpoint pengaturan isolasi sebelumnya memakai `ON DUPLICATE KEY UPDATE` pada tabel `radgroupreply` yang tidak memiliki UNIQUE constraint. Diperbaiki ke pola `DELETE + INSERT` untuk atribut `Mikrotik-Rate-Limit`, `Mikrotik-Group`, dan `Framed-Pool`.
- **Label tanggal isolasi PPPoE masih memakai istilah kedaluwarsa** — Teks UI terkait `expiredAt` di form PPPoE dan detail user kini diseragamkan menjadi `Tanggal Isolir`.
- **Preview/logo branding belum konsisten di semua halaman** — Login Admin, Customer, Technician, Agent, halaman Isolated, Settings Company, dan Download APK kini memakai pola logo dinamis dengan `object-contain` dan batas layout ideal agar logo horizontal maupun vertikal tetap proporsional.

### Changed
- **Upload logo kini mendukung lebih banyak format** — Upload logo perusahaan sekarang menerima PNG, JPG, SVG, WebP, AVIF, dan GIF, dengan mapping ekstensi berbasis MIME type agar nama file hasil upload lebih konsisten.
- **Download APK memakai preview logo full-area** — Kartu logo pada halaman download APK kini memakai container preview lebih besar agar admin bisa melihat hasil branding secara proporsional sebelum build APK.
- **Versi aplikasi disinkronkan dengan changelog** — Metadata versi project dinaikkan ke `2.25.4` agar badge versi, package metadata, dan changelog tetap selaras.

### Affected
- `src/app/admin/AdminClientLayout.tsx`
- `src/app/admin/download-apk/page.tsx`
- `src/app/admin/login/page.tsx`
- `src/app/admin/pppoe/users/page.tsx`
- `src/app/admin/settings/company/page.tsx`
- `src/app/agent/page.tsx`
- `src/app/api/pppoe/users/bulk/route.ts`
- `src/app/api/settings/isolation/route.ts`
- `src/app/api/upload/logo/route.ts`
- `src/app/customer/login/page.tsx`
- `src/app/customer/tickets/create/page.tsx`
- `src/app/isolated/page.tsx`
- `src/app/technician/login/page.tsx`
- `src/components/UserDetailModal.tsx`
- `src/locales/id.json`
- `src/server/services/pppoe.service.ts`

### v2.25.3 — 2026-04-27

### Fixed
- **Nama perusahaan tidak terlihat di tema terang pada semua portal login role** — Beberapa halaman login menampilkan heading brand dengan gaya yang bisa kehilangan kontras di light mode (teks putih/gradient terhadap latar terang), sehingga nama perusahaan nyaris tidak terbaca. Diperbaiki dengan pola heading kontras yang konsisten (`text-slate-900` untuk light mode, `text-white` untuk dark mode) dan fallback nama perusahaan yang aman.

### Changed
- **Redesign UI login lintas role (Admin, Customer, Agent, Technician)** — Semua halaman login portal diseragamkan tata letaknya agar konsisten antar-role dan tetap responsif desktop/mobile.
  - Panel form login diseragamkan (`lg:w-[430px]`, background `bg-card`, batas `border-border`) untuk ritme visual yang sama.
  - Ditambahkan blok branding **"Nama Perusahaan"** di sisi form agar identitas tetap terbaca jelas pada tema terang maupun gelap.
  - Area hero kanan diperbarui dengan heading tunggal yang tegas + accent bar gradient per role untuk visual yang lebih clean dan kontras.
  - Gradien latar hero desktop dirapikan ke palet yang lebih lembut di light mode agar elemen teks tidak tenggelam.

### Affected
- `src/app/admin/login/page.tsx`
- `src/app/customer/login/page.tsx`
- `src/app/agent/page.tsx`
- `src/app/technician/login/page.tsx`

### v2.25.2 — 2026-04-26

### Added
- **WhatsApp Baileys — Native WhatsApp gateway built-in di VPS** — Provider baru `baileys` menggunakan library `@whiskeysockets/baileys` yang berjalan sebagai proses PM2 terpisah (`salfanet-wa`) di `127.0.0.1:4000`. Tidak perlu layanan pihak ketiga (Fonnte, WAHA, MPWA, dll).
  - `GET /api/whatsapp/providers/:id/qr` — Ambil QR code untuk scan WhatsApp Web
  - `GET /api/whatsapp/providers/:id/status` — Cek status koneksi (connected/disconnected)
  - `POST /api/whatsapp/providers/:id/restart` — Logout session & generate QR baru
  - `wa-service.js` — Express server standalone yang mengelola koneksi Baileys + generate QR (base64 PNG)
  - PM2 process `salfanet-wa` ditambahkan ke `production/ecosystem.config.js`
  - Auth session tersimpan di `/var/data/salfanet/baileys_auth` (persist across restart)
  - `vps-install/updater.sh` otomatis setup direktori auth + start `salfanet-wa`
- **QR Modal: success state + auto-refresh** — Setelah scan berhasil, modal WhatsApp QR menampilkan animasi centang hijau "WhatsApp Berhasil Terhubung!" beserta tombol tutup. Status provider card di-refresh otomatis tanpa reload halaman.

### Fixed
- **HTTP 400 saat QR belum siap (WAITING state)** — Saat Baileys masih inisialisasi (belum generate QR), `/qr` endpoint sebelumnya mengembalikan 400 → frontend tampil error dan tutup modal. Sekarang server balas 202 dengan `{ waiting: true }`, dan frontend otomatis retry setiap 2,5 detik dengan spinner loading tetap tampil.
- **Spinner menghilang saat WAITING** — Bug `finally { setQrLoading(false) }` selalu dieksekusi meskipun ada `return` di `try` block. Diperbaiki dengan flag `retrying` yang dideklarasi di luar `try` — `finally` hanya stop spinner jika `!retrying`.
- **Status tetap "terhubung" setelah device disconnect** — Saat perangkat melepas Linked Device dari HP, Baileys set status `logged_out` tapi tidak ada auto-reconnect. Klik tombol QR hanya mengembalikan WAITING tanpa pernah generate QR baru. Diperbaiki: endpoint `/qr` kini otomatis memanggil `connectToWhatsApp()` jika status `logged_out` atau `error`, sehingga QR baru muncul otomatis.
- **"Tidak dapat menautkan" saat scan QR** — WhatsApp menolak koneksi karena fingerprint browser `macOS Desktop` memicu deteksi bot. Diperbaiki dengan mengubah ke `Browsers.ubuntu('Chrome')` + `markOnlineOnConnect: false` + `connectTimeoutMs: 60000`.
- **`wa-service.js` crash: MODULE_NOT_FOUND `express`** — Modul `express` tidak ada di `node_modules` karena bukan dependency sebelumnya. Diperbaiki dengan menambahkan `"express": "^4.21.2"` ke `package.json` root.

### Changed
- **`whatsapp.service.ts`** — Menambahkan `'baileys'` ke union type provider dan method `sendViaBaileys()` yang memanggil `http://127.0.0.1:${WA_SERVICE_PORT}/send`
- **Dependencies tambahan di `package.json`** — `@whiskeysockets/baileys ^7.0.0-rc.9`, `pino ^10.3.1`, `express ^4.21.2`

<!-- AUTO-CHANGELOG:END -->

See full changelog: [docs/getting-started/CHANGELOG.md](docs/getting-started/CHANGELOG.md)

## 📚 Documentation

| File | Description |
|------|-------------|
| [docs/INSTALLATION-GUIDE.md](docs/INSTALLATION-GUIDE.md) | Complete VPS installation |
| [docs/GENIEACS-GUIDE.md](docs/GENIEACS-GUIDE.md) | GenieACS TR-069 setup & WiFi management |
| [docs/AGENT_DEPOSIT_SYSTEM.md](docs/AGENT_DEPOSIT_SYSTEM.md) | Agent balance & deposit |
| [docs/RADIUS-CONNECTIVITY.md](docs/RADIUS-CONNECTIVITY.md) | RADIUS architecture |
| [docs/FREERADIUS-SETUP.md](docs/FREERADIUS-SETUP.md) | FreeRADIUS configuration guide |

## 📝 License

MIT License - Free for commercial and personal use

## 👨‍💻 Development

Built with ❤️ for Indonesian ISPs

**Important**: Always use `formatWIB()` and `toWIB()` functions when displaying dates to users.
