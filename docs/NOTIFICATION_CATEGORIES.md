# Notification Category Filter System

## Overview
Category filter system untuk halaman admin notifications yang memungkinkan filtering notifikasi berdasarkan tipe/kategori dengan visual yang menarik menggunakan neon theme.

## Features Implemented

### 1. Category Filter Buttons
- **Grid Layout**: Responsive grid (2-6 columns depending on screen size)
- **Visual Design**: Neon gradient style dengan glow effects
- **Active State**: Purple/pink gradient dengan cyan icon glow
- **Count Badges**: Menampilkan jumlah notifikasi per kategori
- **Icons**: Setiap kategori memiliki icon yang sesuai

### 2. Available Categories

| Type | Label | Icon | Description |
|------|-------|------|-------------|
| `all` | Semua | Bell | Semua notifikasi |
| `unread` | Belum Dibaca | AlertCircle | Notifikasi yang belum dibaca |
| `invoice_overdue` | Invoice Jatuh Tempo | DollarSign | Invoice yang sudah jatuh tempo |
| `new_registration` | Pendaftaran Baru | UserPlus | Registrasi customer baru |
| `payment_received` | Pembayaran Diterima | CheckCheck | Konfirmasi pembayaran |
| `user_expired` | User Kadaluarsa | Clock | User yang sudah expired |
| `leave_request` | Pengajuan Cuti | Users | Request cuti karyawan |
| `overtime_request` | Pengajuan Lembur | Briefcase | Request lembur karyawan |
| `loan_request` | Pengajuan Kasbon | Wallet | Request kasbon karyawan |
| `technician_help` | Teknisi Butuh Bantuan | Wrench | Request bantuan dari teknisi |
| `system_alert` | Peringatan Sistem | AlertTriangle | Alert sistem |

### 3. "Tandai Semua Dibaca" Button
- **Prominent Position**: Di bawah category filters dengan border separator
- **Gradient Style**: Green-to-cyan gradient (#00ff88 to #00f7ff)
- **Glow Effect**: Shadow dengan green glow
- **Counter**: Menampilkan jumlah unread notifications
- **Visibility**: Hanya muncul jika ada unread notifications

### 4. API Enhancements

#### GET `/api/notifications`
**Query Parameters:**
- `limit`: Jumlah notifikasi yang diminta (default: 10)
- `unreadOnly`: Filter hanya unread (`true`/`false`)
- `type`: Filter berdasarkan kategori (e.g., `new_registration`, `invoice_overdue`)

**Response:**
```json
{
  "success": true,
  "notifications": [...],
  "unreadCount": 5,
  "categoryCounts": {
    "new_registration": 3,
    "invoice_overdue": 2,
    "payment_received": 1,
    ...
  }
}
```

**categoryCounts**: Object berisi jumlah notifikasi per tipe menggunakan Prisma `groupBy`

## Implementation Details

### Frontend (page.tsx)

```typescript
// State management
const [categoryFilter, setCategoryFilter] = useState('all');
const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

// Category definitions with icons
const NOTIFICATION_CATEGORIES = [
  { type: 'all', key: 'notifications.categories.all', icon: Bell },
  { type: 'unread', key: 'notifications.categories.unread', icon: AlertCircle },
  // ... more categories
];

// Load notifications with category filter
const loadNotifications = async () => {
  let url = '/api/notifications?limit=100';
  if (filter === 'unread') url += '&unreadOnly=true';
  if (categoryFilter !== 'all' && categoryFilter !== 'unread') {
    url += `&type=${categoryFilter}`;
  }
  // ...
};
```

### Backend (route.ts)

```typescript
export async function GET(request: NextRequest) {
  const type = searchParams.get('type');
  
  // Build where clause with type filter
  const where: any = {};
  if (unreadOnly) where.isRead = false;
  if (type) where.type = type;
  
  // Get category counts using groupBy
  const allNotifications = await prisma.notification.groupBy({
    by: ['type'],
    _count: { id: true }
  });
  
  const categoryCounts: Record<string, number> = {};
  allNotifications.forEach((item) => {
    categoryCounts[item.type] = item._count.id;
  });
  
  return NextResponse.json({
    notifications,
    unreadCount,
    categoryCounts // Include in response
  });
}
```

## Translations (id.json)

```json
"notifications": {
  "categories": {
    "all": "Semua",
    "unread": "Belum Dibaca",
    "invoice_overdue": "Invoice Jatuh Tempo",
    "new_registration": "Pendaftaran Baru",
    "payment_received": "Pembayaran Diterima",
    "user_expired": "User Kadaluarsa",
    "system_alert": "Peringatan Sistem",
    "leave_request": "Pengajuan Cuti",
    "overtime_request": "Pengajuan Lembur",
    "loan_request": "Pengajuan Kasbon",
    "technician_help": "Teknisi Butuh Bantuan"
  }
}
```

## Styling

### Neon Theme Colors
- **Primary Gradient**: `#bc13fe` (purple) to `#ff44cc` (pink)
- **Accent Color**: `#00f7ff` (cyan)
- **Success Gradient**: `#00ff88` (green) to `#00f7ff` (cyan)

### Active Category Button
```css
bg-gradient-to-br from-[#bc13fe]/20 to-[#ff44cc]/20
border-[#bc13fe]
shadow-[0_0_20px_rgba(188,19,254,0.4)]
```

### Active Icon
```css
text-[#00f7ff]
drop-shadow-[0_0_6px_rgba(0,247,255,0.8)]
```

### "Tandai Semua" Button
```css
bg-gradient-to-r from-[#00ff88] to-[#00f7ff]
shadow-[0_0_25px_rgba(0,255,136,0.4)]
```

## User Experience

1. **Default State**: Category "Semua" selected, showing all notifications
2. **Click Category**: Filter changes instantly, table updates
3. **Count Badges**: Always show real-time counts for each category
4. **Visual Feedback**: Active category has purple/pink glow with cyan icon
5. **Bulk Actions**: Still work with filtered notifications
6. **Mark All Read**: Prominent button appears when unread > 0

## Differences from AIBILL

| Aspect | AIBILL | SALFANET |
|--------|--------|----------|
| Theme | Standard Bootstrap/Tailwind | Neon purple/pink/cyan |
| Active Color | Teal/cyan | Purple gradient |
| Icon Glow | No | Yes (cyan glow) |
| Button Position | Top right | Below categories with separator |
| Grid Columns | 7 columns | 4-6 columns (responsive) |

## Testing

1. **Category Filtering**: Click each category button and verify notifications filter correctly
2. **Count Accuracy**: Verify counts match actual notification counts per type
3. **Unread Filter**: Check if "Belum Dibaca" category shows only unread
4. **Mark All Read**: Click button and verify all notifications marked as read
5. **Responsive**: Test grid layout on different screen sizes

## Future Enhancements

- [ ] Add animation when switching categories
- [ ] Add empty state per category
- [ ] Add category icons in notification cards
- [ ] Add category filter in notification dropdown (header bell)
- [ ] Add category statistics in dashboard
