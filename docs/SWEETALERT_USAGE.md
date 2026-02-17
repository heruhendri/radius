# SweetAlert Cyberpunk Theme - Usage Guide

## Overview
Semua halaman admin menggunakan SweetAlert dengan tema cyberpunk untuk konsistensi UI/UX yang lebih baik.

## ❌ TIDAK DIGUNAKAN LAGI
```typescript
// JANGAN gunakan native browser alerts
alert('Message');
confirm('Are you sure?');
window.confirm('Delete?');
```

## ✅ GUNAKAN SWEETALERT

### Import
```typescript
import { showSuccess, showError, showConfirm, showWarning, showInfo, showToast } from '@/lib/sweetalert';
```

### 1. Success Alert
```typescript
await showSuccess('Data berhasil disimpan');
await showSuccess('Berhasil!', 'Custom Title');
```

### 2. Error Alert
```typescript
await showError('Gagal menyimpan data');
await showError('Terjadi kesalahan', 'Error!');
```

### 3. Warning Alert
```typescript
await showWarning('Kategori ini memiliki 5 tiket aktif');
await showWarning('Peringatan!', 'Custom Title');
```

### 4. Info Alert
```typescript
await showInfo('Proses akan memakan waktu beberapa menit');
await showInfo('Informasi', 'Custom Title');
```

### 5. Confirmation Dialog
```typescript
const confirmed = await showConfirm('Apakah Anda yakin ingin menghapus?');
if (!confirmed) return;

// With custom text
const confirmed = await showConfirm(
  'Data akan dihapus permanen',
  'Hapus Data?',
  'Ya, Hapus',
  'Batal'
);
if (confirmed) {
  // proceed with delete
}
```

### 6. Toast Notification (Non-blocking)
```typescript
await showToast('Data tersimpan', 'success');
await showToast('Terjadi kesalahan', 'error');
await showToast('Perhatian!', 'warning');
await showToast('Info penting', 'info');
```

### 7. Loading Indicator
```typescript
import { showLoading, closeLoading } from '@/lib/sweetalert';

showLoading('Memproses data...');
// Do async operation
await someAsyncFunction();
closeLoading();
```

## Cyberpunk Theme Features

### Visual Elements
- **Background**: Dark gradient `#0a0520` → `#1a0a3a`
- **Border Glow**: Neon purple `#bc13fe`
- **Button Colors**:
  - Success: Cyan `#00ff88`
  - Error: Pink `#ff4466`
  - Warning: Amber `#fbbf24`
  - Info: Cyan `#00f7ff`
  - Cancel: Gray gradient

### Custom Styling
All alerts automatically apply:
- Neon borders with glow effect
- Cyberpunk color scheme
- Backdrop blur
- Shadow effects
- Icon glow effects

## Common Patterns

### Delete with Confirmation
```typescript
const handleDelete = async (id: string, name: string) => {
  const confirmed = await showConfirm(
    `Hapus ${name}? Tindakan ini tidak bisa dibatalkan.`,
    'Konfirmasi Hapus',
    'Ya, Hapus',
    'Batal'
  );
  
  if (!confirmed) return;
  
  try {
    const res = await fetch(`/api/data/${id}`, { method: 'DELETE' });
    
    if (res.ok) {
      await showSuccess('Data berhasil dihapus');
      loadData();
    } else {
      const error = await res.json();
      await showError(error.message || 'Gagal menghapus data');
    }
  } catch (error) {
    await showError('Terjadi kesalahan pada server');
  }
};
```

### Save/Update with Validation
```typescript
const handleSave = async () => {
  if (!formData.name) {
    await showWarning('Nama harus diisi');
    return;
  }
  
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (res.ok) {
      await showSuccess('Data berhasil disimpan');
      setIsDialogOpen(false);
      loadData();
    } else {
      const error = await res.json();
      await showError(error.message || 'Gagal menyimpan');
    }
  } catch (error) {
    await showError('Terjadi kesalahan');
  }
};
```

### Bulk Operations
```typescript
const handleBulkDelete = async () => {
  if (selectedIds.size === 0) {
    await showWarning('Pilih minimal 1 item');
    return;
  }
  
  const confirmed = await showConfirm(
    `Hapus ${selectedIds.size} item yang dipilih?`,
    'Hapus Massal'
  );
  
  if (!confirmed) return;
  
  showLoading('Menghapus data...');
  
  try {
    const res = await fetch('/api/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: Array.from(selectedIds) })
    });
    
    closeLoading();
    
    if (res.ok) {
      await showSuccess(`${selectedIds.size} item berhasil dihapus`);
      setSelectedIds(new Set());
      loadData();
    } else {
      await showError('Gagal menghapus beberapa item');
    }
  } catch (error) {
    closeLoading();
    await showError('Terjadi kesalahan');
  }
};
```

### Form Validation
```typescript
const validateForm = async () => {
  if (!formData.email) {
    await showWarning('Email harus diisi');
    return false;
  }
  
  if (!formData.phone.match(/^[0-9]+$/)) {
    await showWarning('Nomor telepon hanya boleh angka');
    return false;
  }
  
  return true;
};

const handleSubmit = async () => {
  if (!(await validateForm())) return;
  
  // proceed with save
};
```

## Migration Checklist

Jika ada halaman yang masih menggunakan `alert()` atau `confirm()`:

1. ✅ Import SweetAlert functions
2. ✅ Replace `alert()` → `await showError()` atau `await showWarning()`
3. ✅ Replace `confirm()` → `const confirmed = await showConfirm()`
4. ✅ Add success notifications after successful operations
5. ✅ Use `showLoading()` for long operations
6. ✅ Test all notification scenarios

## ✅ All Pages Updated (100% Coverage)

### Admin Pages
- ✅ [src/app/admin/pppoe/users/page.tsx](src/app/admin/pppoe/users/page.tsx) - **FIXED**: Double notification on delete
- ✅ [src/app/admin/pppoe/registrations/page.tsx](src/app/admin/pppoe/registrations/page.tsx)
- ✅ [src/app/admin/tickets/[id]/page.tsx](src/app/admin/tickets/[id]/page.tsx)
- ✅ [src/app/admin/tickets/categories/page.tsx](src/app/admin/tickets/categories/page.tsx)
- ✅ [src/app/admin/coordinators/page.tsx](src/app/admin/coordinators/page.tsx)
- ✅ [src/app/admin/technicians/page.tsx](src/app/admin/technicians/page.tsx)
- ✅ [src/app/admin/manual-payments/page.tsx](src/app/admin/manual-payments/page.tsx)
- ✅ [src/app/admin/hotspot/profile/page.tsx](src/app/admin/hotspot/profile/page.tsx)
- ✅ [src/app/admin/freeradius/config/page.tsx](src/app/admin/freeradius/config/page.tsx)
- ✅ [src/app/admin/genieacs/parameter-config/page.tsx](src/app/admin/genieacs/parameter-config/page.tsx)
- ✅ [src/app/admin/settings/database/page.tsx](src/app/admin/settings/database/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/topup-requests/page.tsx](src/app/admin/topup-requests/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/pppoe/stopped/page.tsx](src/app/admin/pppoe/stopped/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/pppoe/profiles/page.tsx](src/app/admin/pppoe/profiles/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/pppoe/areas/page.tsx](src/app/admin/pppoe/areas/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/network/routers/page.tsx](src/app/admin/network/routers/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/network/olts/page.tsx](src/app/admin/network/olts/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/network/odps/page.tsx](src/app/admin/network/odps/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/network/odcs/page.tsx](src/app/admin/network/odcs/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/network/vpn-server/page.tsx](src/app/admin/network/vpn-server/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/network/vpn-client/page.tsx](src/app/admin/network/vpn-client/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/network/customers/page.tsx](src/app/admin/network/customers/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/keuangan/page.tsx](src/app/admin/keuangan/page.tsx) - Already using SweetAlert
- ✅ [src/app/admin/agent/dashboard/page.tsx](src/app/admin/agent/dashboard/page.tsx) - Already using SweetAlert

### Customer Pages
- ✅ [src/app/customer/page.tsx](src/app/customer/page.tsx) - WiFi config, payment regeneration
- ✅ [src/app/customer/tickets/[id]/page.tsx](src/app/customer/tickets/[id]/page.tsx)
- ✅ [src/app/customer/tickets/create/page.tsx](src/app/customer/tickets/create/page.tsx)

### Coordinator Pages
- ✅ [src/app/coordinator/tasks/page.tsx](src/app/coordinator/tasks/page.tsx) - Already using SweetAlert

### Technician Pages
- ✅ [src/app/technician/dashboard/page.tsx](src/app/technician/dashboard/page.tsx)

### Components
- ✅ [src/components/PermissionCheckboxes.tsx](src/components/PermissionCheckboxes.tsx)
- ✅ [src/components/MapPicker.tsx](src/components/MapPicker.tsx)
- ✅ [src/components/UserDetailModal.tsx](src/components/UserDetailModal.tsx)

### Core System
- ✅ [src/lib/sweetalert.ts](src/lib/sweetalert.ts) - Cyberpunk theme implementation
- ✅ [src/app/globals.css](src/app/globals.css) - Cyberpunk CSS styling

**Total: 35+ files updated** across all user roles (Admin, Customer, Coordinator, Technician)

## Fixed Issues

### ✅ Double Notification Fix
**Before (WRONG)**:
```typescript
// Modal with confirmation button
<SimpleModal isOpen={!!deleteId}>
  <ModalButton onClick={handleDelete}>Delete</ModalButton>
</SimpleModal>

// PLUS showConfirm inside handler
const handleDelete = async () => {
  const confirmed = await showConfirm('Are you sure?'); // DOUBLE!
  if (!confirmed) return;
  // delete logic
};
```

**After (CORRECT)**:
```typescript
// Modal already confirms, NO showConfirm inside
const handleDelete = async () => {
  // No showConfirm here!
  try {
    const res = await fetch(...);
    if (res.ok) {
      await showSuccess('Deleted');
    }
  } catch (error) {
    await showError('Failed');
  }
};
```

## Z-Index Hierarchy
- SweetAlert: `999999` (highest)
- Modals: `9999`
- Leaflet Map: `1000`
- Normal content: `1-10`

## Browser Compatibility
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers

## Performance
- Lazy loaded via dynamic import
- No performance impact
- Supports async/await
- Toast auto-dismisses after 3s

## Accessibility
- Keyboard navigation (Enter/Esc)
- Screen reader friendly
- Focus trap in modals
- ARIA labels included
