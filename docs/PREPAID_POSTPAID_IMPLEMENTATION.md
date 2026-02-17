# Implementasi Sistem Prepaid & Postpaid

Dokumentasi ini menjelaskan implementasi sistem billing prepaid dan postpaid di AIBILL-RADIUS.

## 📋 Overview

Sistem billing kini mendukung 2 jenis subscription:
- **PREPAID**: Bayar dimuka sebelum masa aktif berakhir
- **POSTPAID**: Bayar dibelakang setelah menggunakan layanan

## 🗄️ Database Schema Changes

### Tabel `pppoe_users`
Ditambahkan field baru:

```sql
billingDay              INT DEFAULT 1           -- Tanggal tagihan (1-28) untuk POSTPAID
autoIsolationEnabled    BOOLEAN DEFAULT TRUE    -- Enable/disable auto-isolation
balance                 INT DEFAULT 0           -- Saldo deposit untuk PREPAID
autoRenewal             BOOLEAN DEFAULT FALSE   -- Auto perpanjangan dari saldo
connectionType          ENUM DEFAULT 'PPPOE'    -- Tipe koneksi: PPPOE/HOTSPOT/STATIC_IP
```

### Tabel `invoices`
Ditambahkan field baru:

```sql
invoiceType     ENUM    -- MONTHLY/INSTALLATION/ADDON/TOPUP/RENEWAL
baseAmount      INT     -- Jumlah sebelum pajak
taxRate         DECIMAL -- Persentase pajak
additionalFees  JSON    -- Array biaya tambahan
```

## 🔄 Alur Proses

### 1. Registrasi & Approval

**Endpoint**: `/api/admin/registrations/[id]/approve`

#### POSTPAID Flow:
```
1. User baru dibuat dengan status='isolated'
2. expiredAt = null (tidak ada tanggal kadaluarsa)
3. Generate invoice INSTALLATION (hanya biaya pemasangan)
4. User tetap isolated sampai bayar
5. Setelah bayar → status='active', expiredAt tetap null
```

#### PREPAID Flow:
```
1. User baru dibuat dengan status='isolated'
2. expiredAt = now + validity period
3. Generate invoice INSTALLATION (pemasangan + bulan pertama)
4. User tetap isolated sampai bayar
5. Setelah bayar → status='active', expiredAt diperpanjang
```

### 2. Invoice Generation (Cron Job)

**Endpoint**: `/api/invoices/generate`
**Schedule**: Daily at 00:00 WIB

#### POSTPAID Invoice Generation:
```sql
-- Cari user POSTPAID dengan billingDay = hari ini
SELECT * FROM pppoe_users 
WHERE subscriptionType = 'POSTPAID'
  AND billingDay = DAY(CURDATE())
  AND status IN ('active', 'isolated', 'blocked', 'suspended')
  AND expiredAt IS NULL
```

**Logic**:
- Generate invoice setiap tanggal billing (billingDay)
- dueDate = billingDay + 7 hari (grace period)
- invoiceType = 'MONTHLY'
- Jika H+7 belum bayar → auto isolate

**Contoh**:
- billingDay = 5
- Invoice generate: 5 Januari
- dueDate: 12 Januari
- Jika 13 Januari belum bayar → auto isolate

#### PREPAID Invoice Generation:
```sql
-- Cari user PREPAID yang akan expired dalam 7-30 hari
SELECT * FROM pppoe_users 
WHERE subscriptionType = 'PREPAID'
  AND expiredAt BETWEEN DATE_ADD(CURDATE(), INTERVAL 7 DAY) 
                    AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
  AND status IN ('active', 'isolated', 'blocked', 'suspended')
```

**Logic**:
- Generate invoice H-7 sebelum expiredAt
- dueDate = expiredAt
- invoiceType = 'RENEWAL'
- Jika expiredAt lewat → auto isolate immediately

**Contoh**:
- expiredAt = 15 Januari
- Invoice generate: 8 Januari (H-7)
- dueDate: 15 Januari
- Jika 16 Januari belum bayar → auto isolate

### 3. Payment Processing

**Endpoint**: `/api/payment/webhook`

#### POSTPAID Payment:
```typescript
// Setelah bayar invoice:
1. Invoice status = 'PAID'
2. User status = 'active' (jika sebelumnya isolated)
3. expiredAt = null (tetap null, tidak ada expiry)
4. Generate invoice berikutnya di billingDay bulan depan
```

#### PREPAID Payment:
```typescript
// Setelah bayar invoice:
1. Invoice status = 'PAID'
2. User status = 'active' (jika sebelumnya isolated)
3. expiredAt = expiredAt + validity period
   - Jika sudah expired: expiredAt = now + validity
4. Generate invoice berikutnya H-7 sebelum expiredAt baru
```

### 4. Auto Isolation (Cron Job)

**Endpoint**: `/lib/cron/pppoe-sync.ts`
**Schedule**: Hourly

#### POSTPAID Isolation:
```typescript
// Isolate jika:
1. Ada invoice OVERDUE (lewat dueDate + grace period)
2. Status user = 'active'
3. expiredAt = null

// Action:
- Set status = 'isolated'
- Remove dari RADIUS (radcheck, radusergroup)
- Disconnect session via CoA
```

#### PREPAID Isolation:
```typescript
// Isolate jika:
1. expiredAt < now (masa aktif habis)
2. Status user = 'active'
3. subscriptionType = 'PREPAID'

// Action:
- Set status = 'isolated'
- Remove dari RADIUS (radcheck, radusergroup)
- Disconnect session via CoA
```

## 📊 Contoh Skenario

### Skenario 1: User Postpaid Baru
```
Timeline:
- 1 Jan: Daftar, pilih POSTPAID, billingDay=5
- 1 Jan: Admin approve → invoice pemasangan Rp 100.000
- 2 Jan: Bayar pemasangan → aktif
- 5 Jan: Auto generate invoice bulan pertama Rp 200.000, dueDate=12 Jan
- 10 Jan: Bayar → lanjut aktif
- 5 Feb: Auto generate invoice bulan kedua, dueDate=12 Feb
- 13 Feb: Belum bayar → auto isolate
- 14 Feb: Bayar → aktif kembali
```

### Skenario 2: User Prepaid Baru
```
Timeline:
- 1 Jan: Daftar, pilih PREPAID
- 1 Jan: Admin approve → invoice pemasangan+bulan pertama Rp 300.000
- 2 Jan: Bayar → aktif, expiredAt = 2 Feb
- 26 Jan: Auto generate invoice perpanjangan (H-7), dueDate=2 Feb
- 1 Feb: Bayar → expiredAt diperpanjang jadi 2 Mar
- 23 Feb: Auto generate invoice perpanjangan (H-7), dueDate=2 Mar
- 3 Mar: Belum bayar, expiredAt lewat → auto isolate
- 4 Mar: Bayar → aktif kembali, expiredAt = 4 Apr
```

## 🔧 Configuration

### Set Billing Day (POSTPAID)
```typescript
// Saat edit user atau approval
await prisma.pppoeUser.update({
  where: { id: userId },
  data: {
    subscriptionType: 'POSTPAID',
    billingDay: 5, // Tagihan tanggal 5 setiap bulan
    expiredAt: null
  }
})
```

### Set Expiry Date (PREPAID)
```typescript
// Saat approval atau payment
const expiredAt = new Date();
expiredAt.setMonth(expiredAt.getMonth() + 1); // +1 bulan

await prisma.pppoeUser.update({
  where: { id: userId },
  data: {
    subscriptionType: 'PREPAID',
    expiredAt: expiredAt,
    billingDay: 1 // Default, tidak dipakai untuk prepaid
  }
})
```

## 🧪 Testing Checklist

### POSTPAID Tests:
- [ ] Registrasi baru POSTPAID → invoice hanya pemasangan
- [ ] Approval POSTPAID → expiredAt = null
- [ ] Bayar invoice POSTPAID → status active, expiredAt tetap null
- [ ] Generate invoice di billingDay
- [ ] Isolate user POSTPAID jika invoice overdue
- [ ] Reactivate user POSTPAID setelah bayar invoice overdue

### PREPAID Tests:
- [ ] Registrasi baru PREPAID → invoice pemasangan + bulan pertama
- [ ] Approval PREPAID → expiredAt = now + validity
- [ ] Bayar invoice PREPAID → status active, expiredAt diperpanjang
- [ ] Generate invoice H-7 sebelum expiredAt
- [ ] Isolate user PREPAID jika expiredAt lewat
- [ ] Reactivate user PREPAID → expiredAt = now + validity

### Edge Cases:
- [ ] User POSTPAID dengan billingDay > 28 (gunakan 28)
- [ ] User PREPAID expired > 7 hari (jangan generate invoice duplikat)
- [ ] User ganti POSTPAID → PREPAID
- [ ] User ganti PREPAID → POSTPAID
- [ ] Invoice manual (admin create)

## 📈 Monitoring Queries

### Check POSTPAID Users Due for Invoice:
```sql
SELECT username, name, billingDay, status, expiredAt
FROM pppoe_users
WHERE subscriptionType = 'POSTPAID'
  AND billingDay = DAY(CURDATE())
  AND status IN ('active', 'isolated', 'blocked', 'suspended');
```

### Check PREPAID Users Expiring Soon:
```sql
SELECT username, name, expiredAt, status
FROM pppoe_users
WHERE subscriptionType = 'PREPAID'
  AND expiredAt BETWEEN DATE_ADD(CURDATE(), INTERVAL 7 DAY) 
                    AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
  AND status IN ('active', 'isolated', 'blocked', 'suspended');
```

### Check Overdue Invoices:
```sql
SELECT i.invoiceNumber, u.username, u.subscriptionType, 
       i.amount, i.dueDate, i.status
FROM invoices i
JOIN pppoe_users u ON i.userId = u.id
WHERE i.status IN ('PENDING', 'OVERDUE')
  AND i.dueDate < CURDATE()
ORDER BY i.dueDate ASC;
```

## 🐛 Bug Fixes Applied

### BUG-01: Prepaid/Postpaid Logic Not Implemented
**Status**: ✅ FIXED
- Added conditional logic in approval route
- Different invoice amounts for PREPAID vs POSTPAID
- Different expiredAt handling

### BUG-04: Invoice Generation Doesn't Respect Subscription Type
**Status**: ✅ FIXED
- Split query into PREPAID and POSTPAID
- Different due date calculation
- Different invoice type (MONTHLY vs RENEWAL)

### BUG-05: Wrong Expiry Calculation
**Status**: ✅ FIXED
- POSTPAID: expiredAt = null
- PREPAID: expiredAt = date based on validity
- Payment webhook handles both types correctly

### BUG-03: No billingDay Field
**Status**: ✅ FIXED
- Added billingDay field to schema
- Used in POSTPAID invoice generation
- Default value = 1

### BUG-06: No Balance Field
**Status**: ✅ FIXED (Schema Only)
- Added balance field for future deposit system
- TODO: Implement top-up and auto-deduct logic

### BUG-07: Auto-renewal Not Implemented
**Status**: ✅ FIXED (Schema Only)
- Added autoRenewal field
- TODO: Implement auto-payment from balance

## 🚀 Next Steps

1. **Balance & Top-up System**
   - Create `/api/topup` endpoint
   - Auto-deduct from balance on invoice due
   - Balance notification when low

2. **Auto-renewal Logic**
   - Check balance before expiry
   - Auto-pay invoice if balance sufficient
   - Send notification if balance insufficient

3. **Grace Period Configuration**
   - Make grace period configurable per user/profile
   - Different grace periods for PREPAID vs POSTPAID

4. **Flexible Billing Dates**
   - Allow billingDay > 28 (use last day of month)
   - Handle February (28/29 days)

5. **Invoice Templates**
   - Different templates for MONTHLY vs RENEWAL
   - Include breakdown (base + tax + fees)

6. **Email Notifications**
   - Invoice generated email
   - Payment reminder emails (H-3, H-1)
   - Overdue notification

## 📝 Migration Notes

### From Old System:
```sql
-- Users created before this update have subscriptionType = NULL
-- Set default based on expiredAt:
UPDATE pppoe_users 
SET subscriptionType = CASE 
  WHEN expiredAt IS NULL THEN 'POSTPAID'
  ELSE 'PREPAID'
END
WHERE subscriptionType IS NULL;

-- Set default billingDay = 1 for all POSTPAID users
UPDATE pppoe_users 
SET billingDay = 1
WHERE subscriptionType = 'POSTPAID' AND billingDay IS NULL;
```

### Rollback Plan:
```sql
-- If needed to rollback schema changes:
ALTER TABLE pppoe_users 
  DROP COLUMN billingDay,
  DROP COLUMN autoIsolationEnabled,
  DROP COLUMN balance,
  DROP COLUMN autoRenewal,
  DROP COLUMN connectionType;

ALTER TABLE invoices 
  DROP COLUMN invoiceType,
  DROP COLUMN baseAmount,
  DROP COLUMN taxRate,
  DROP COLUMN additionalFees;

DROP TYPE IF EXISTS InvoiceType;
DROP TYPE IF EXISTS ConnectionType;
```

## 🔗 Related Files

- Schema: `prisma/schema.prisma`
- Migration: `prisma/migrations/20251223_add_billing_fields.sql`
- Approval: `src/app/api/admin/registrations/[id]/approve/route.ts`
- Payment: `src/app/api/payment/webhook/route.ts`
- Invoice Gen: `src/app/api/invoices/generate/route.ts`
- Cron: `src/lib/cron/voucher-sync.ts`
- Roadmap: `ROADMAP_BILLING_FIX.md`

---

**Version**: 1.0  
**Date**: 2025-12-23  
**Author**: AIBILL Development Team  
**Status**: ✅ Implemented (Core Features)
