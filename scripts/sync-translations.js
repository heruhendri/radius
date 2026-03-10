/**
 * Translation Sync Script
 * Ensures both en.json and id.json have all keys from each other.
 * Missing keys are auto-translated using a comprehensive dictionary.
 */
const fs = require('fs');
const path = require('path');

const EN_PATH = path.join(__dirname, '..', 'src', 'locales', 'en.json');
const ID_PATH = path.join(__dirname, '..', 'src', 'locales', 'id.json');

const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
const id = JSON.parse(fs.readFileSync(ID_PATH, 'utf8'));

// ============================================================
// COMPREHENSIVE EN→ID TRANSLATION DICTIONARY
// ============================================================
const enToId = {
  // Common UI
  'Save': 'Simpan', 'Cancel': 'Batal', 'Delete': 'Hapus', 'Edit': 'Edit', 'Add': 'Tambah',
  'Create': 'Buat', 'Update': 'Perbarui', 'Close': 'Tutup', 'Back': 'Kembali', 'Next': 'Selanjutnya',
  'Previous': 'Sebelumnya', 'Submit': 'Kirim', 'Search': 'Cari', 'Filter': 'Filter', 'Reset': 'Reset',
  'Refresh': 'Segarkan', 'Loading': 'Memuat', 'Processing': 'Memproses', 'Confirm': 'Konfirmasi',
  'Yes': 'Ya', 'No': 'Tidak', 'OK': 'OK', 'Done': 'Selesai', 'Apply': 'Terapkan',
  'Select': 'Pilih', 'Selected': 'Terpilih', 'All': 'Semua', 'None': 'Tidak ada',
  'Enable': 'Aktifkan', 'Disable': 'Nonaktifkan', 'Enabled': 'Aktif', 'Disabled': 'Nonaktif',
  'Active': 'Aktif', 'Inactive': 'Nonaktif', 'Status': 'Status', 'Action': 'Aksi', 'Actions': 'Aksi',
  'Details': 'Detail', 'Description': 'Deskripsi', 'Name': 'Nama', 'Type': 'Tipe', 'Date': 'Tanggal',
  'Time': 'Waktu', 'Amount': 'Jumlah', 'Total': 'Total', 'Price': 'Harga', 'Cost': 'Biaya',
  'Note': 'Catatan', 'Notes': 'Catatan', 'Comment': 'Komentar', 'Comments': 'Komentar',
  'Message': 'Pesan', 'Title': 'Judul', 'Category': 'Kategori', 'Tag': 'Tag', 'Tags': 'Tag',
  'Label': 'Label', 'Priority': 'Prioritas', 'Low': 'Rendah', 'Medium': 'Sedang', 'High': 'Tinggi',
  'Critical': 'Kritis', 'Urgent': 'Mendesak', 'Normal': 'Normal',
  'Success': 'Berhasil', 'Error': 'Error', 'Warning': 'Peringatan', 'Info': 'Info',
  'Failed': 'Gagal', 'Pending': 'Tertunda', 'Approved': 'Disetujui', 'Rejected': 'Ditolak',
  'Completed': 'Selesai', 'In Progress': 'Sedang Berlangsung', 'Open': 'Terbuka', 'Closed': 'Ditutup',
  'New': 'Baru', 'Old': 'Lama', 'View': 'Lihat', 'Show': 'Tampilkan', 'Hide': 'Sembunyikan',
  'Export': 'Ekspor', 'Import': 'Impor', 'Download': 'Unduh', 'Upload': 'Unggah',
  'Print': 'Cetak', 'Copy': 'Salin', 'Paste': 'Tempel', 'Move': 'Pindah', 'Send': 'Kirim',
  'Receive': 'Terima', 'Accept': 'Terima', 'Decline': 'Tolak', 'Assign': 'Tugaskan',
  'Unassign': 'Batalkan Tugas', 'Start': 'Mulai', 'Stop': 'Berhenti', 'Pause': 'Jeda',
  'Resume': 'Lanjutkan', 'Retry': 'Coba Lagi', 'Skip': 'Lewati',
  'Required': 'Wajib', 'Optional': 'Opsional', 'Default': 'Default',
  'Settings': 'Pengaturan', 'Configuration': 'Konfigurasi', 'Preferences': 'Preferensi',
  'Profile': 'Profil', 'Account': 'Akun', 'Password': 'Kata Sandi', 'Email': 'Email',
  'Phone': 'Telepon', 'Address': 'Alamat', 'Location': 'Lokasi', 'Area': 'Area', 'Region': 'Wilayah',
  'Company': 'Perusahaan', 'Branch': 'Cabang', 'Department': 'Departemen', 'Team': 'Tim',
  'Role': 'Peran', 'Permission': 'Izin', 'Permissions': 'Izin', 'Access': 'Akses',
  'User': 'Pengguna', 'Users': 'Pengguna', 'Admin': 'Admin', 'Customer': 'Pelanggan', 'Customers': 'Pelanggan',
  'Employee': 'Karyawan', 'Employees': 'Karyawan', 'Manager': 'Manajer', 'Technician': 'Teknisi',
  'Agent': 'Agen', 'Coordinator': 'Koordinator',
  // Network/ISP
  'Router': 'Router', 'Routers': 'Router', 'Interface': 'Interface', 'Interfaces': 'Interface',
  'Bandwidth': 'Bandwidth', 'Speed': 'Kecepatan', 'Upload': 'Upload', 'Download': 'Download',
  'Connection': 'Koneksi', 'Connected': 'Terhubung', 'Disconnected': 'Terputus',
  'Online': 'Online', 'Offline': 'Offline', 'Session': 'Sesi', 'Sessions': 'Sesi',
  'Traffic': 'Trafik', 'Uptime': 'Uptime', 'IP Address': 'Alamat IP', 'MAC Address': 'Alamat MAC',
  'DNS': 'DNS', 'Gateway': 'Gateway', 'Subnet': 'Subnet', 'VLAN': 'VLAN', 'Port': 'Port',
  'Secret': 'Secret', 'Pool': 'Pool', 'Queue': 'Queue', 'Firewall': 'Firewall',
  'PPPoE': 'PPPoE', 'Hotspot': 'Hotspot', 'Voucher': 'Voucher', 'Vouchers': 'Voucher',
  'Package': 'Paket', 'Packages': 'Paket', 'Plan': 'Paket', 'Plans': 'Paket',
  'Profile': 'Profil', 'Profiles': 'Profil', 'Device': 'Perangkat', 'Devices': 'Perangkat',
  'Service': 'Layanan', 'Services': 'Layanan', 'Network': 'Jaringan',
  'OLT': 'OLT', 'ONU': 'ONU', 'ONT': 'ONT', 'ODP': 'ODP', 'Fiber': 'Fiber',
  'Wireless': 'Nirkabel', 'Signal': 'Sinyal', 'Frequency': 'Frekuensi',
  // Billing
  'Invoice': 'Faktur', 'Invoices': 'Faktur', 'Payment': 'Pembayaran', 'Payments': 'Pembayaran',
  'Billing': 'Penagihan', 'Balance': 'Saldo', 'Deposit': 'Deposit', 'Withdrawal': 'Penarikan',
  'Transaction': 'Transaksi', 'Transactions': 'Transaksi', 'Receipt': 'Kwitansi',
  'Due Date': 'Jatuh Tempo', 'Overdue': 'Jatuh Tempo', 'Paid': 'Lunas', 'Unpaid': 'Belum Lunas',
  'Partial': 'Sebagian', 'Refund': 'Pengembalian', 'Discount': 'Diskon', 'Tax': 'Pajak',
  'Fee': 'Biaya', 'Charge': 'Biaya', 'Revenue': 'Pendapatan', 'Expense': 'Pengeluaran',
  'Income': 'Pemasukan', 'Profit': 'Keuntungan', 'Loss': 'Kerugian',
  'Top Up': 'Isi Saldo', 'Auto Renewal': 'Perpanjangan Otomatis', 'Renewal': 'Perpanjangan',
  // Isolation
  'Isolation': 'Isolasi', 'Isolated': 'Terisolasi', 'Isolate': 'Isolasi',
  'Suspend': 'Tangguhkan', 'Suspended': 'Ditangguhkan', 'Activate': 'Aktifkan', 'Deactivate': 'Nonaktifkan',
  'Reactivate': 'Aktifkan Kembali', 'Terminate': 'Terminasi', 'Expired': 'Kedaluwarsa',
  // Ticket
  'Ticket': 'Tiket', 'Tickets': 'Tiket', 'Support': 'Dukungan', 'Report': 'Laporan',
  'Reports': 'Laporan', 'Issue': 'Masalah', 'Bug': 'Bug', 'Feature': 'Fitur', 'Request': 'Permintaan',
  'Assigned': 'Ditugaskan', 'Resolved': 'Diselesaikan', 'Reopened': 'Dibuka Kembali',
  // Time
  'Today': 'Hari Ini', 'Yesterday': 'Kemarin', 'Tomorrow': 'Besok',
  'This Week': 'Minggu Ini', 'This Month': 'Bulan Ini', 'This Year': 'Tahun Ini',
  'Last Week': 'Minggu Lalu', 'Last Month': 'Bulan Lalu', 'Last Year': 'Tahun Lalu',
  'Daily': 'Harian', 'Weekly': 'Mingguan', 'Monthly': 'Bulanan', 'Yearly': 'Tahunan',
  'Hour': 'Jam', 'Hours': 'Jam', 'Minute': 'Menit', 'Minutes': 'Menit',
  'Second': 'Detik', 'Seconds': 'Detik', 'Day': 'Hari', 'Days': 'Hari',
  'Week': 'Minggu', 'Weeks': 'Minggu', 'Month': 'Bulan', 'Months': 'Bulan',
  'Year': 'Tahun', 'Years': 'Tahun',
  // Dashboard/Analytics
  'Dashboard': 'Dasbor', 'Overview': 'Ringkasan', 'Summary': 'Ringkasan',
  'Statistics': 'Statistik', 'Analytics': 'Analitik', 'Chart': 'Grafik', 'Graph': 'Grafik',
  'Report': 'Laporan', 'Growth': 'Pertumbuhan', 'Trend': 'Tren', 'Average': 'Rata-rata',
  'Minimum': 'Minimum', 'Maximum': 'Maksimum', 'Count': 'Jumlah',
  'Percentage': 'Persentase', 'Ratio': 'Rasio', 'Rate': 'Tingkat',
  // Attendance/HR
  'Attendance': 'Kehadiran', 'Check In': 'Masuk', 'Check Out': 'Keluar',
  'Present': 'Hadir', 'Absent': 'Tidak Hadir', 'Late': 'Terlambat', 'Early': 'Awal',
  'Leave': 'Cuti', 'Leaves': 'Cuti', 'Sick': 'Sakit', 'Holiday': 'Libur',
  'Overtime': 'Lembur', 'Shift': 'Shift', 'Schedule': 'Jadwal', 'Salary': 'Gaji',
  // Notifications
  'Notification': 'Notifikasi', 'Notifications': 'Notifikasi', 'Broadcast': 'Broadcast',
  'Alert': 'Peringatan', 'Reminder': 'Pengingat', 'Template': 'Template', 'Templates': 'Template',
  'WhatsApp': 'WhatsApp', 'SMS': 'SMS', 'Push': 'Push', 'Webhook': 'Webhook',
  // Registration
  'Registration': 'Pendaftaran', 'Registrations': 'Pendaftaran', 'Register': 'Daftar',
  'Registered': 'Terdaftar', 'Application': 'Permohonan', 'Form': 'Formulir',
  // Database
  'Database': 'Database', 'Backup': 'Cadangan', 'Restore': 'Pulihkan', 'Migration': 'Migrasi',
  'Table': 'Tabel', 'Tables': 'Tabel', 'Column': 'Kolom', 'Row': 'Baris', 'Record': 'Data',
  // VPN
  'VPN': 'VPN', 'Tunnel': 'Tunnel', 'Server': 'Server', 'Client': 'Klien',
  'Certificate': 'Sertifikat', 'Key': 'Kunci', 'Encryption': 'Enkripsi',
  // Misc
  'Inventory': 'Inventaris', 'Stock': 'Stok', 'Item': 'Item', 'Items': 'Item',
  'Quantity': 'Jumlah', 'Unit': 'Unit', 'Supplier': 'Pemasok', 'Order': 'Pesanan',
  'Delivery': 'Pengiriman', 'Installation': 'Instalasi', 'Maintenance': 'Pemeliharaan',
  'Repair': 'Perbaikan', 'Replacement': 'Penggantian', 'Return': 'Pengembalian',
  'Job': 'Pekerjaan', 'Jobs': 'Pekerjaan', 'Task': 'Tugas', 'Tasks': 'Tugas',
  'Schedule': 'Jadwal', 'Recurring': 'Berulang', 'Manual': 'Manual', 'Automatic': 'Otomatis',
  'Log': 'Log', 'Logs': 'Log', 'History': 'Riwayat', 'Activity': 'Aktivitas',
  'Audit': 'Audit', 'Change': 'Perubahan', 'Changes': 'Perubahan',
  'Version': 'Versi', 'Changelog': 'Catatan Perubahan',
  'Help': 'Bantuan', 'Documentation': 'Dokumentasi', 'Guide': 'Panduan',
  'Tutorial': 'Tutorial', 'FAQ': 'FAQ', 'Contact': 'Kontak',
  'Language': 'Bahasa', 'Theme': 'Tema', 'Dark': 'Gelap', 'Light': 'Terang',
  'Notification Sound': 'Suara Notifikasi', 'Vibration': 'Getar',
  'General': 'Umum', 'Advanced': 'Lanjutan', 'Basic': 'Dasar',
  'Manage': 'Kelola', 'Management': 'Manajemen', 'Setup': 'Pengaturan',
  'Install': 'Instal', 'Uninstall': 'Copot', 'Configure': 'Konfigurasi',
  'Test': 'Uji', 'Testing': 'Pengujian', 'Debug': 'Debug', 'Preview': 'Pratinjau',
  'Generate': 'Buat', 'Generated': 'Dibuat', 'Automatic': 'Otomatis',
  'Manual': 'Manual', 'Custom': 'Kustom', 'Customization': 'Kustomisasi',
  // Portal
  'Portal': 'Portal', 'Login': 'Masuk', 'Logout': 'Keluar', 'Sign In': 'Masuk',
  'Sign Up': 'Daftar', 'Sign Out': 'Keluar', 'Forgot Password': 'Lupa Kata Sandi',
  'Reset Password': 'Atur Ulang Kata Sandi', 'Change Password': 'Ubah Kata Sandi',
  'Remember Me': 'Ingat Saya', 'Stay Logged In': 'Tetap Masuk',
};

// Reverse dictionary for ID→EN
const idToEn = {};
for (const [enVal, idVal] of Object.entries(enToId)) {
  idToEn[idVal] = enVal;
}

// Smart translate EN→ID  
function translateToId(enValue) {
  if (typeof enValue !== 'string') return enValue;
  
  // Direct match
  if (enToId[enValue]) return enToId[enValue];
  
  // Try case-insensitive
  const lower = enValue.toLowerCase();
  for (const [k, v] of Object.entries(enToId)) {
    if (k.toLowerCase() === lower) return v;
  }
  
  // Context-based translation for common patterns
  let result = enValue;
  
  // Common sentence patterns
  const patterns = [
    // Success/failure messages
    [/^Successfully (.+)$/i, 'Berhasil $1'],
    [/^Failed to (.+)$/i, 'Gagal $1'],
    [/^Unable to (.+)$/i, 'Tidak dapat $1'],
    [/^Error (.+)$/i, 'Error $1'],
    [/^Invalid (.+)$/i, '$1 tidak valid'],
    [/^(.+) created successfully$/i, '$1 berhasil dibuat'],
    [/^(.+) updated successfully$/i, '$1 berhasil diperbarui'],
    [/^(.+) deleted successfully$/i, '$1 berhasil dihapus'],
    [/^(.+) saved successfully$/i, '$1 berhasil disimpan'],
    [/^(.+) sent successfully$/i, '$1 berhasil dikirim'],
    [/^(.+) is required$/i, '$1 wajib diisi'],
    [/^Please (.+)$/i, 'Silakan $1'],
    [/^Are you sure (.+)\?$/i, 'Apakah Anda yakin $1?'],
    [/^Do you want to (.+)\?$/i, 'Apakah Anda ingin $1?'],
    [/^No (.+) found$/i, 'Tidak ada $1 ditemukan'],
    [/^(.+) not found$/i, '$1 tidak ditemukan'],
    [/^Manage (.+)$/i, 'Kelola $1'],
    [/^Add New (.+)$/i, 'Tambah $1 Baru'],
    [/^Add (.+)$/i, 'Tambah $1'],
    [/^Edit (.+)$/i, 'Edit $1'],
    [/^Delete (.+)$/i, 'Hapus $1'],
    [/^Create (.+)$/i, 'Buat $1'],
    [/^Update (.+)$/i, 'Perbarui $1'],
    [/^View (.+)$/i, 'Lihat $1'],
    [/^Show (.+)$/i, 'Tampilkan $1'],
    [/^Hide (.+)$/i, 'Sembunyikan $1'],
    [/^Select (.+)$/i, 'Pilih $1'],
    [/^Enter (.+)$/i, 'Masukkan $1'],
    [/^Choose (.+)$/i, 'Pilih $1'],
    [/^Confirm (.+)$/i, 'Konfirmasi $1'],
    [/^(.+) Settings$/i, 'Pengaturan $1'],
    [/^(.+) Configuration$/i, 'Konfigurasi $1'],
    [/^(.+) Management$/i, 'Manajemen $1'],
    [/^(.+) Details$/i, 'Detail $1'],
    [/^(.+) List$/i, 'Daftar $1'],
    [/^(.+) History$/i, 'Riwayat $1'],
    [/^(.+) Report$/i, 'Laporan $1'],
    [/^(.+) Overview$/i, 'Ringkasan $1'],
    [/^Total (.+)$/i, 'Total $1'],
    [/^All (.+)$/i, 'Semua $1'],
    [/^My (.+)$/i, '$1 Saya'],
    [/^Set (.+)$/i, 'Atur $1'],
    [/^Remove (.+)$/i, 'Hapus $1'],
    [/^Clear (.+)$/i, 'Bersihkan $1'],
    [/^Reset (.+)$/i, 'Reset $1'],
    [/^Bulk (.+)$/i, '$1 Massal'],
    [/^Export (.+)$/i, 'Ekspor $1'],
    [/^Import (.+)$/i, 'Impor $1'],
    [/^(.+) Template$/i, 'Template $1'],
    [/^(.+) Status$/i, 'Status $1'],
    [/^(.+) Type$/i, 'Tipe $1'],
    [/^(.+) has been (.+)$/i, '$1 telah $2'],
  ];
  
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      if (result !== enValue) return result;
    }
  }
  
  // Word-by-word translation for compound phrases
  const words = result.split(/\s+/);
  if (words.length <= 6) {
    const translated = words.map(w => {
      const clean = w.replace(/[.,!?:;()]/g, '');
      const punct = w.slice(clean.length);
      if (enToId[clean]) return enToId[clean] + punct;
      // Try capitalized
      const cap = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
      if (enToId[cap]) return enToId[cap] + punct;
      return w;
    });
    const translatedStr = translated.join(' ');
    if (translatedStr !== result) return translatedStr;
  }
  
  // Return original if no translation found
  return enValue;
}

// Smart translate ID→EN
function translateToEn(idValue) {
  if (typeof idValue !== 'string') return idValue;
  if (idToEn[idValue]) return idToEn[idValue];
  
  // Common ID→EN patterns
  const patterns = [
    [/^Berhasil (.+)$/i, 'Successfully $1'],
    [/^Gagal (.+)$/i, 'Failed to $1'],
    [/^(.+) berhasil (.+)$/i, '$1 successfully $2'],
    [/^(.+) tidak ditemukan$/i, '$1 not found'],
    [/^(.+) wajib diisi$/i, '$1 is required'],
    [/^Silakan (.+)$/i, 'Please $1'],
    [/^Apakah Anda yakin (.+)\?$/i, 'Are you sure $1?'],
    [/^Kelola (.+)$/i, 'Manage $1'],
    [/^Tambah (.+)$/i, 'Add $1'],
    [/^Hapus (.+)$/i, 'Delete $1'],
    [/^Edit (.+)$/i, 'Edit $1'],
    [/^Buat (.+)$/i, 'Create $1'],
    [/^Pengaturan (.+)$/i, '$1 Settings'],
    [/^Daftar (.+)$/i, '$1 List'],
  ];
  
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(idValue)) {
      const result = idValue.replace(pattern, replacement);
      if (result !== idValue) return result;
    }
  }
  
  return idValue;
}

// Deep merge: copy missing keys from source to target with translation
function deepMerge(source, target, translateFn, path = '') {
  let added = 0;
  for (const [key, value] of Object.entries(source)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      added += deepMerge(value, target[key], translateFn, fullPath);
    } else {
      if (target[key] === undefined) {
        target[key] = translateFn(value);
        added++;
      }
    }
  }
  return added;
}

// Sort object keys recursively
function sortKeys(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

// ============================================================
// FIX KEY NAMING INCONSISTENCIES
// ============================================================

// 1. ID has "emailSettings" → should map to EN "settings.email" 
// Copy ID emailSettings into ID settings.email to match EN structure
if (id.emailSettings && en.settings && en.settings.email) {
  console.log('Merging ID emailSettings → ID settings.email');
  if (!id.settings) id.settings = {};
  if (!id.settings.email) id.settings.email = {};
  deepMerge(id.emailSettings, id.settings.email, v => v, 'settings.email');
}

// 2. ID has "manualPayment" → EN has "manualPayments" (plural)
if (id.manualPayment && en.manualPayments) {
  console.log('Merging ID manualPayment → ID manualPayments');
  if (!id.manualPayments) id.manualPayments = {};
  deepMerge(id.manualPayment, id.manualPayments, v => v, 'manualPayments');
}

// 3. ID has "customer" section → EN may not; copy to EN
if (id.customer && !en.customer) {
  console.log('Copying ID customer → EN customer');
  en.customer = {};
}

// 4. ID has "customerNav" → EN may not; copy to EN
if (id.customerNav && !en.customerNav) {
  console.log('Copying ID customerNav → EN customerNav');
  en.customerNav = {};
}

// ============================================================
// MERGE MISSING KEYS
// ============================================================

console.log('\n--- Adding missing keys to ID from EN ---');
const addedToId = deepMerge(en, id, translateToId);
console.log(`Added ${addedToId} keys to ID`);

console.log('\n--- Adding missing keys to EN from ID ---');
const addedToEn = deepMerge(id, en, translateToEn);
console.log(`Added ${addedToEn} keys to EN`);

// ============================================================
// SORT AND WRITE
// ============================================================
const sortedEn = sortKeys(en);
const sortedId = sortKeys(id);

fs.writeFileSync(EN_PATH, JSON.stringify(sortedEn, null, 2) + '\n', 'utf8');
fs.writeFileSync(ID_PATH, JSON.stringify(sortedId, null, 2) + '\n', 'utf8');

// Final counts
function countKeys(obj) {
  let c = 0;
  for (const v of Object.values(obj)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) c += countKeys(v);
    else c++;
  }
  return c;
}

console.log(`\nFinal EN keys: ${countKeys(sortedEn)}`);
console.log(`Final ID keys: ${countKeys(sortedId)}`);

// Verify symmetry
function flatKeys(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? prefix + '.' + k : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) keys = keys.concat(flatKeys(v, p));
    else keys.push(p);
  }
  return keys;
}

const enFinal = new Set(flatKeys(sortedEn));
const idFinal = new Set(flatKeys(sortedId));
const stillMissingInId = [...enFinal].filter(k => !idFinal.has(k));
const stillMissingInEn = [...idFinal].filter(k => !enFinal.has(k));
console.log(`Still missing in ID: ${stillMissingInId.length}`);
console.log(`Still missing in EN: ${stillMissingInEn.length}`);
if (stillMissingInId.length > 0) console.log('Sample:', stillMissingInId.slice(0, 5).join(', '));
if (stillMissingInEn.length > 0) console.log('Sample:', stillMissingInEn.slice(0, 5).join(', '));
