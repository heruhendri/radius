# Security Fixes Applied Tracker

> Last updated: 2026-03-28
> Tujuan: satu sumber status implementasi semua security fix.

---

## Legend

- `DONE` = fix sudah diterapkan dan diverifikasi
- `IN_PROGRESS` = sedang dikerjakan
- `PENDING` = belum dikerjakan
- `N/A` = tidak relevan di lingkungan ini

---

## Critical Findings Tracker

| ID | Temuan | Severity | Status | Owner | PR/Commit | Verified By | Verified Date | Notes |
|----|--------|----------|--------|-------|-----------|-------------|---------------|-------|
| C-01 | Payment webhook signature verification disabled | CRITICAL | DONE | Backend | - | Copilot | 2026-03-28 | Unified webhook verifikasi aktif di [src/app/api/payment/webhook/route.ts](src/app/api/payment/webhook/route.ts#L85), [src/app/api/payment/webhook/route.ts](src/app/api/payment/webhook/route.ts#L140), [src/app/api/payment/webhook/route.ts](src/app/api/payment/webhook/route.ts#L205), [src/app/api/payment/webhook/route.ts](src/app/api/payment/webhook/route.ts#L254). Agent deposit webhook juga sudah diverifikasi di [src/app/api/agent/deposit/webhook/route.ts](src/app/api/agent/deposit/webhook/route.ts#L38). |
| C-02 | Command injection risk in system/update execution | CRITICAL | IN_PROGRESS | Backend | - | - | 2026-03-28 | Update route memakai spawn dengan argv tetap di [src/app/api/admin/system/update/route.ts](src/app/api/admin/system/update/route.ts#L183), tapi masih ada execSync string command di [src/app/api/admin/system/update/route.ts](src/app/api/admin/system/update/route.ts#L34) dan [src/app/api/admin/system/info/route.ts](src/app/api/admin/system/info/route.ts#L29). |
| C-03 | Shell injection via script arguments/path | CRITICAL | IN_PROGRESS | Backend | - | - | 2026-03-28 | Argumen user saat trigger update dibatasi boolean force di [src/app/api/admin/system/update/route.ts](src/app/api/admin/system/update/route.ts#L150), namun hardening belum tuntas karena masih ada pemanggilan shell berbasis string pada endpoint system info/update. |
| C-04 | Path traversal in file handling endpoint | CRITICAL | IN_PROGRESS | Backend | - | Copilot | 2026-03-28 | FreeRADIUS read/save sudah ada normalize + allowlist di [src/app/api/freeradius/config/read/route.ts](src/app/api/freeradius/config/read/route.ts#L32) dan [src/app/api/freeradius/config/save/route.ts](src/app/api/freeradius/config/save/route.ts#L41). Route logo kini memvalidasi filename + extension di [src/app/api/uploads/logos/[filename]/route.ts](src/app/api/uploads/logos/[filename]/route.ts#L14). Audit endpoint file lain masih perlu.
| C-05 | Missing auth/authorization on sensitive routes | CRITICAL | IN_PROGRESS | Backend | - | Copilot | 2026-03-28 | Role guard SUPER_ADMIN sudah ditambah pada system update/info di [src/app/api/admin/system/update/route.ts](src/app/api/admin/system/update/route.ts#L47) dan [src/app/api/admin/system/info/route.ts](src/app/api/admin/system/info/route.ts#L39). Route logout log kini mewajibkan auth di [src/app/api/auth/logout-log/route.ts](src/app/api/auth/logout-log/route.ts#L10). Audit route lain masih berjalan. |

---

## High Findings Tracker

| ID | Temuan | Severity | Status | Owner | PR/Commit | Verified By | Verified Date | Notes |
|----|--------|----------|--------|-------|-----------|-------------|---------------|-------|
| H-01 | Inconsistent auth middleware coverage | HIGH | IN_PROGRESS | Backend | - | Copilot | 2026-03-28 | Perbaikan awal selesai untuk route sistem dan logout log, namun standardisasi middleware auth lintas semua route belum tuntas. |
| H-02 | Weak validation on input payload | HIGH | IN_PROGRESS | Backend | - | - | 2026-03-28 | Sebagian endpoint sudah schema-based, tapi masih ada parsing body langsung di route webhook/deposit tanpa validator terpusat. |
| H-03 | Potential SQL/query misuse on dynamic filter | HIGH | PENDING | Backend | - | - | 2026-03-28 | Butuh audit lanjutan query dinamis lintas route; belum diverifikasi selesai. |
| H-04 | Insufficient idempotency on callback/payment flow | HIGH | IN_PROGRESS | Backend | - | - | 2026-03-28 | Webhook utama sudah punya idempotency guard di [src/app/api/payment/webhook/route.ts](src/app/api/payment/webhook/route.ts#L286), namun endpoint agent deposit masih berbasis status check sederhana di [src/app/api/agent/deposit/webhook/route.ts](src/app/api/agent/deposit/webhook/route.ts#L126). |
| H-05 | Secrets and sensitive config handling gaps | HIGH | PENDING | DevOps | - | - | 2026-03-28 | Belum ada bukti final hardening menyeluruh untuk secret handling lintas env/runtime. |

---

## Verification Checklist (per temuan)

- [ ] Unit/integration test ditambahkan
- [ ] Manual exploit test gagal dieksekusi (good)
- [ ] Log tidak membocorkan secret
- [ ] Tidak ada regression di flow utama
- [ ] Evidence disimpan (PR/commit + screenshot/log)

---

## Change Log

| Date | Change | By |
|------|--------|----|
| 2026-03-28 | Initial tracker created | Copilot |
| 2026-03-28 | Initial evidence-based status mapping from current code review | Copilot |
| 2026-03-28 | Applied first hardening batch on webhook/auth/path validation | Copilot |
