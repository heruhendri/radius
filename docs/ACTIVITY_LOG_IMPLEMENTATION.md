# Activity Log Implementation Guide

## Overview
Sistem activity log mencatat semua aktivitas penting di aplikasi SALFANET RADIUS untuk ditampilkan di dashboard admin.

## Database Schema
```prisma
model activityLog {
  id          String   @id @default(cuid())
  userId      String?
  username    String
  userRole    String?
  action      String
  description String   @db.Text
  module      String   // 'pppoe', 'hotspot', 'voucher', 'invoice', 'payment', 'agent', 'session', 'transaction', 'system', etc
  status      String   @default("success") // 'success', 'warning', 'error'
  ipAddress   String?
  metadata    String?  @db.Text // JSON string for additional data
  createdAt   DateTime @default(now())
}
```

## Helper Functions

### Import
```typescript
import { logActivity } from '@/lib/activity-log';
```

### Basic Usage
```typescript
await logActivity({
  userId: session.user.id,
  username: session.user.username,
  userRole: session.user.role,
  action: 'GENERATE_VOUCHER',
  description: `Generated ${count} vouchers for profile ${profileName}`,
  module: 'voucher',
  status: 'success',
  request: request, // Optional - auto extracts IP
  metadata: { count, profileId, batchCode }, // Optional
});
```

## Implementation Examples

### 1. Hotspot Voucher Generation
**File:** `src/app/api/hotspot/voucher/route.ts`

```typescript
// After successful voucher generation
await logActivity({
  username: 'Admin', // Get from session
  action: 'GENERATE_VOUCHER',
  description: `Generated ${result.count} vouchers (${profile.name}) - Batch: ${batchCode}`,
  module: 'voucher',
  status: 'success',
  metadata: {
    quantity: result.count,
    profileId,
    profileName: profile.name,
    batchCode,
    routerId,
    agentId,
  },
});
```

### 2. Agent Generate Voucher
**File:** `src/app/api/agent/generate-voucher/route.ts`

```typescript
await logActivity({
  username: agent.name,
  userRole: 'AGENT',
  action: 'AGENT_GENERATE_VOUCHER',
  description: `Agent ${agent.name} generated ${quantity} vouchers (${profile.name})`,
  module: 'agent',
  status: 'success',
  metadata: {
    agentId: agent.id,
    quantity,
    profileName: profile.name,
    costPrice: profile.costPrice * quantity,
    newBalance: agent.balance - totalCost,
  },
});
```

### 3. Agent Deposit
**File:** `src/app/api/agent/deposit/webhook/route.ts`

```typescript
// On successful payment
await logActivity({
  username: agent.name,
  userRole: 'AGENT',
  action: 'AGENT_DEPOSIT',
  description: `Agent ${agent.name} deposited Rp ${amount.toLocaleString('id-ID')}`,
  module: 'agent',
  status: 'success',
  metadata: {
    agentId: agent.id,
    amount,
    paymentGateway: deposit.paymentGateway,
    transactionId: deposit.transactionId,
  },
});
```

### 4. PPPoE User Create/Update
**File:** `src/app/api/pppoe/users/route.ts`

```typescript
// Create user
await logActivity({
  userId: session.user.id,
  username: session.user.username,
  action: 'CREATE_PPPOE_USER',
  description: `Created PPPoE user: ${username}`,
  module: 'pppoe',
  status: 'success',
  metadata: {
    username,
    profileId,
    routerId,
  },
});

// Update user
await logActivity({
  userId: session.user.id,
  username: session.user.username,
  action: 'UPDATE_PPPOE_USER',
  description: `Updated PPPoE user: ${username}`,
  module: 'pppoe',
  status: 'success',
  metadata: {
    username,
    changes: { status, profileId },
  },
});
```

### 5. Session Disconnect
**File:** `src/app/api/sessions/disconnect/route.ts`

```typescript
await logActivity({
  userId: session.user.id,
  username: session.user.username,
  action: 'DISCONNECT_SESSION',
  description: `Disconnected user: ${username}`,
  module: 'session',
  status: 'success',
  metadata: {
    username,
    ipAddress: framedIpAddress,
    nasIpAddress,
  },
});
```

### 6. Invoice Generation
**File:** `src/app/api/invoices/generate/route.ts`

```typescript
await logActivity({
  userId: session.user.id,
  username: session.user.username,
  action: 'GENERATE_INVOICE',
  description: `Generated ${invoices.length} invoices for period ${period}`,
  module: 'invoice',
  status: 'success',
  metadata: {
    count: invoices.length,
    period,
    totalAmount,
  },
});
```

### 7. Payment Received
**File:** `src/app/api/payment/webhook/route.ts`

```typescript
await logActivity({
  username: invoice.customerUsername || 'Customer',
  action: 'PAYMENT_RECEIVED',
  description: `Payment received for invoice ${invoice.invoiceNumber} - Rp ${amount.toLocaleString('id-ID')}`,
  module: 'payment',
  status: 'success',
  metadata: {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount,
    paymentMethod,
  },
});
```

### 8. Transaction (Keuangan)
**File:** `src/app/api/keuangan/transactions/route.ts`

```typescript
await logActivity({
  userId: session.user.id,
  username: session.user.username,
  action: transaction.type === 'INCOME' ? 'ADD_INCOME' : 'ADD_EXPENSE',
  description: `${transaction.type}: ${transaction.description} - Rp ${transaction.amount.toLocaleString('id-ID')}`,
  module: 'transaction',
  status: 'success',
  metadata: {
    transactionId: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    categoryId: transaction.categoryId,
  },
});
```

### 9. WhatsApp Broadcast
**File:** `src/app/api/whatsapp/broadcast/route.ts`

```typescript
await logActivity({
  userId: session.user.id,
  username: session.user.username,
  action: 'WHATSAPP_BROADCAST',
  description: `Sent WhatsApp broadcast to ${recipients.length} recipients`,
  module: 'whatsapp',
  status: 'success',
  metadata: {
    recipientCount: recipients.length,
    template,
    filter,
  },
});
```

### 10. Network Router Add/Update
**File:** `src/app/api/network/routers/route.ts`

```typescript
await logActivity({
  userId: session.user.id,
  username: session.user.username,
  action: 'ADD_ROUTER',
  description: `Added router: ${name} (${ipAddress})`,
  module: 'network',
  status: 'success',
  metadata: {
    routerId: router.id,
    name,
    ipAddress,
    type,
  },
});
```

### 11. System Actions (RADIUS Restart, etc)
**File:** `src/app/api/system/radius/route.ts`

```typescript
await logActivity({
  userId: session.user.id,
  username: session.user.username,
  action: 'RESTART_RADIUS',
  description: `Restarted FreeRADIUS service`,
  module: 'system',
  status: 'success',
});
```

### 12. User Login
**File:** `src/app/api/auth/[...nextauth]/route.ts` or `src/lib/auth.ts`

```typescript
// In signIn callback
await logActivity({
  userId: user.id,
  username: user.username,
  userRole: user.role,
  action: 'LOGIN',
  description: `User logged in: ${user.username} (${user.role})`,
  module: 'auth',
  status: 'success',
});
```

### 13. PPPoE Sync from MikroTik
**File:** `src/app/api/pppoe/users/sync-mikrotik/route.ts`

```typescript
await logActivity({
  userId: session.user.id,
  username: session.user.username,
  action: 'SYNC_MIKROTIK',
  description: `Synced ${syncedCount} PPPoE users from MikroTik`,
  module: 'pppoe',
  status: 'success',
  metadata: {
    routerId,
    syncedCount,
    addedCount,
    updatedCount,
  },
});
```

## Modules Reference

- **pppoe** - PPPoE user management
- **hotspot** - Hotspot profile/template management
- **voucher** - Voucher generation and management
- **invoice** - Invoice generation and management
- **payment** - Payment processing
- **agent** - Agent voucher generation and deposits
- **session** - Session monitoring and disconnection
- **transaction** - Keuangan (income/expense)
- **system** - System operations (RADIUS restart, etc)
- **network** - Network device management (routers, OLT, etc)
- **whatsapp** - WhatsApp notifications and broadcasts
- **genieacs** - GenieACS TR-069 management
- **settings** - System settings
- **user** - User management
- **auth** - Authentication (login/logout)

## Status Values

- **success** - Operation completed successfully
- **warning** - Operation completed with warnings
- **error** - Operation failed

## API Endpoints to Update

### Priority 1 (High Traffic)
- ✅ Dashboard stats (already updated)
- [ ] Hotspot voucher generation
- [ ] Agent voucher generation
- [ ] Agent deposit
- [ ] Payment webhook
- [ ] Session disconnect
- [ ] PPPoE user CRUD
- [ ] User login/logout

### Priority 2 (Medium Traffic)
- [ ] Invoice generation
- [ ] WhatsApp broadcast
- [ ] Transaction (keuangan) CRUD
- [ ] PPPoE sync MikroTik
- [ ] Network router CRUD
- [ ] System operations

### Priority 3 (Low Traffic)
- [ ] Settings changes
- [ ] User management
- [ ] GenieACS operations
- [ ] Network OLT/ODC/ODP CRUD

## Maintenance

### Clean Old Logs
Run periodically via cron job:

```typescript
import { cleanOldActivities } from '@/lib/activity-log';

// Keep last 30 days
await cleanOldActivities(30);
```

## Dashboard Display

Activity logs are automatically fetched and displayed in the dashboard:

```typescript
// In src/app/api/dashboard/stats/route.ts
import { getRecentActivities } from '@/lib/activity-log';

const activities = await getRecentActivities(10);
```

The dashboard will show:
- Username
- Action description
- Time (formatted in WIB)
- Status badge (success/warning/error)

## Testing

After implementing activity logs, test by:
1. Performing actions (generate voucher, create user, etc)
2. Check dashboard "Aktivitas Terbaru" section
3. Verify logs are appearing with correct info
4. Check different status types (success/warning/error)

## Notes

- Activity logging should NOT break the main flow if it fails
- All log calls are wrapped in try-catch internally
- IP address is automatically extracted from request headers
- Metadata field can store any JSON data for future analysis
