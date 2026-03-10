/**
 * Push Notification Templates
 * Structured templates matching email/WhatsApp templates for FCM push notifications
 */

import { sendFCMNotifications } from '@/server/services/notifications/push.service';
import { prisma } from '@/server/db/client';

// Template types matching email/WhatsApp system
export type PushTemplateType = 
  | 'invoice-reminder'
  | 'invoice-overdue'
  | 'payment-success'
  | 'payment-rejected'
  | 'auto-renewal-success'
  | 'isolation-notice'
  | 'package-change-invoice'
  | 'broadcast'
  | 'info';

export interface PushTemplateData {
  // Common
  customerName?: string;
  companyName?: string;
  companyPhone?: string;
  
  // Invoice related
  invoiceNumber?: string;
  amount?: number;
  dueDate?: Date;
  profileName?: string;
  area?: string;
  paymentLink?: string;
  
  // Overdue
  isOverdue?: boolean;
  daysOverdue?: number;
  
  // Auto-renewal
  newBalance?: number;
  expiredDate?: Date;
  
  // Isolation
  username?: string;
  
  // Broadcast / custom
  customTitle?: string;
  customBody?: string;
}

/**
 * Generate push notification title and body from template type and data
 */
export function generatePushContent(
  type: PushTemplateType,
  data: PushTemplateData
): { title: string; body: string; dataPayload: Record<string, string> } {
  const formatCurrency = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const dataPayload: Record<string, string> = { type };

  // Add structured data for mobile app rendering
  if (data.invoiceNumber) dataPayload.invoiceNumber = data.invoiceNumber;
  if (data.amount) dataPayload.amount = String(data.amount);
  if (data.dueDate) dataPayload.dueDate = new Date(data.dueDate).toISOString();
  if (data.expiredDate) dataPayload.expiredDate = new Date(data.expiredDate).toISOString();
  if (data.customerName) dataPayload.customerName = data.customerName;
  if (data.profileName) dataPayload.profileName = data.profileName;
  if (data.username) dataPayload.username = data.username;
  if (data.newBalance !== undefined) dataPayload.newBalance = String(data.newBalance);

  const company = data.companyName || 'Salfanet';
  const phone = data.companyPhone || '';
  const footer = phone ? `\n${company} ☎️ ${phone}` : `\n${company}`;

  switch (type) {
    case 'invoice-reminder': {
      const name = data.customerName || 'Pelanggan';
      const inv = data.invoiceNumber || '';
      const amt = data.amount ? formatCurrency(data.amount) : '';
      const due = data.dueDate ? formatDate(data.dueDate) : '';
      const pkg = data.profileName || '';
      
      return {
        title: `⏰ Pengingat Pembayaran - ${inv}`,
        body: `Halo ${name},\n\nIni adalah pengingat untuk tagihan Anda yang akan segera jatuh tempo.\n\n📋 Detail Invoice:\n🧾 No. Invoice: ${inv}\n📦 Paket: ${pkg}\n💰 Jumlah: ${amt}\n📅 Jatuh Tempo: ${due}\n\nSegera lakukan pembayaran agar layanan internet Anda tidak terganggu.${footer}`,
        dataPayload: {
          ...dataPayload,
          link: '/(tabs)/invoices',
        },
      };
    }

    case 'invoice-overdue': {
      const name = data.customerName || 'Pelanggan';
      const inv = data.invoiceNumber || '';
      const amt = data.amount ? formatCurrency(data.amount) : '';
      const due = data.dueDate ? formatDate(data.dueDate) : '';
      const days = data.daysOverdue || 0;
      
      return {
        title: `⚠️ Tagihan Jatuh Tempo - ${inv}`,
        body: `Halo ${name},\n\nTagihan Anda telah melewati jatuh tempo.\n\n📋 Detail Invoice:\n🧾 No. Invoice: ${inv}\n💰 Jumlah: ${amt}\n📅 Jatuh Tempo: ${due}${days > 0 ? `\n⏱️ Terlambat: ${days} hari` : ''}\n\nMohon segera lakukan pembayaran untuk menghindari isolir layanan.${footer}`,
        dataPayload: {
          ...dataPayload,
          link: '/(tabs)/invoices',
        },
      };
    }

    case 'payment-success': {
      const name = data.customerName || 'Pelanggan';
      const inv = data.invoiceNumber || '';
      const amt = data.amount ? formatCurrency(data.amount) : '';
      const user = data.username || '';
      const exp = data.expiredDate ? formatDate(data.expiredDate) : '';
      
      return {
        title: `✅ Pembayaran Berhasil - ${inv}`,
        body: `Halo ${name},\n\nTerima kasih! Pembayaran Anda telah berhasil dikonfirmasi.\n\n📋 Detail Pembayaran:\n📌 Invoice: ${inv}\n💰 Jumlah: ${amt}${user ? `\n👤 Username: ${user}` : ''}${exp ? `\n📅 Aktif hingga: ${exp}` : ''}\n\n🎉 Akun Anda sekarang aktif. Terima kasih!${footer}`,
        dataPayload: {
          ...dataPayload,
          link: '/(tabs)/invoices',
        },
      };
    }

    case 'payment-rejected': {
      const name = data.customerName || 'Pelanggan';
      const inv = data.invoiceNumber || '';
      const amt = data.amount ? formatCurrency(data.amount) : '';
      const reason = data.customBody || '';
      
      return {
        title: `❌ Pembayaran Ditolak - ${inv}`,
        body: `Halo ${name},\n\nPembayaran Anda untuk invoice ${inv}${amt ? ` sebesar ${amt}` : ''} telah ditolak.${reason ? `\n\nAlasan: ${reason}` : ''}\n\nSilakan upload ulang bukti pembayaran yang valid atau hubungi admin untuk bantuan.${footer}`,
        dataPayload: {
          ...dataPayload,
          link: '/(tabs)/invoices',
        },
      };
    }

    case 'package-change-invoice': {
      const name = data.customerName || 'Pelanggan';
      const inv = data.invoiceNumber || '';
      const pkg = data.profileName || '';
      const amt = data.amount ? formatCurrency(data.amount) : '';
      
      return {
        title: `📦 Invoice Ganti Paket - ${inv}`,
        body: `Halo ${name},\n\nInvoice perubahan paket telah dibuat.\n\n📋 Detail:\n🧾 No. Invoice: ${inv}\n📦 Paket Baru: ${pkg}\n💰 Jumlah: ${amt}\n\nSegera lakukan pembayaran untuk memproses perubahan paket Anda.${footer}`,
        dataPayload: {
          ...dataPayload,
          link: '/(tabs)/invoices',
        },
      };
    }

    case 'auto-renewal-success': {
      const name = data.customerName || 'Pelanggan';
      const amt = data.amount ? formatCurrency(data.amount) : '';
      const pkg = data.profileName || '';
      const bal = data.newBalance !== undefined ? formatCurrency(data.newBalance) : '';
      const exp = data.expiredDate ? formatDate(data.expiredDate) : '';
      
      return {
        title: `🔄 Perpanjangan Otomatis Berhasil`,
        body: `Halo ${name},\n\nPaket ${pkg} Anda telah diperpanjang otomatis.\n\n📋 Detail:\n💰 Biaya: ${amt}\n💳 Sisa Saldo: ${bal}\n📅 Aktif hingga: ${exp}\n\nTerima kasih telah menggunakan layanan kami!${footer}`,
        dataPayload: {
          ...dataPayload,
          link: '/(tabs)',
        },
      };
    }

    case 'isolation-notice': {
      const name = data.customerName || 'Pelanggan';
      const user = data.username || '';
      const amt = data.amount ? formatCurrency(data.amount) : '';
      const due = data.dueDate ? formatDate(data.dueDate) : '';
      
      return {
        title: `🔒 Layanan Diisolir`,
        body: `Halo ${name}${user ? ` (@${user})` : ''},\n\nLayanan internet Anda telah diisolir karena ada tagihan yang belum dibayar.${amt ? `\n\n💰 Tagihan: ${amt}` : ''}${due ? `\n📅 Jatuh Tempo: ${due}` : ''}\n\nSilakan segera lakukan pembayaran untuk mengaktifkan kembali layanan Anda.${footer}`,
        dataPayload: {
          ...dataPayload,
          link: '/(tabs)/invoices',
        },
      };
    }

    case 'broadcast': {
      return {
        title: data.customTitle || '📢 Pengumuman',
        body: data.customBody || '',
        dataPayload,
      };
    }

    case 'info': {
      return {
        title: data.customTitle || 'ℹ️ Informasi',
        body: data.customBody || '',
        dataPayload,
      };
    }

    default: {
      return {
        title: data.customTitle || 'Notifikasi',
        body: data.customBody || '',
        dataPayload,
      };
    }
  }
}

/**
 * Send push notification to a specific user by userId
 */
export async function sendPushToUser(
  userId: string,
  type: PushTemplateType,
  data: PushTemplateData
): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    // Get user's FCM tokens
    const user = await prisma.pppoeUser.findUnique({
      where: { id: userId },
      select: { fcmTokens: true, name: true, username: true },
    });

    if (!user?.fcmTokens) {
      console.log(`[Push] No FCM token for user ${userId}`);
      return { success: false, sent: 0, failed: 0 };
    }

    // Parse FCM tokens from JSON string
    let tokenObjects: any[] = [];
    let tokens: string[] = [];
    try {
      const parsed = JSON.parse(user.fcmTokens);
      if (Array.isArray(parsed)) {
        tokenObjects = parsed;
        tokens = parsed.map((t: any) => typeof t === 'string' ? t : t.token).filter(Boolean);
      } else if (typeof parsed === 'string') {
        tokenObjects = [parsed];
        tokens = [parsed];
      }
    } catch {
      // If not valid JSON, treat as single raw token
      tokenObjects = [user.fcmTokens];
      tokens = [user.fcmTokens];
    }

    // Deduplicate tokens before sending (prevent duplicate notifications)
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      console.log(`[Push] No valid FCM tokens for user ${userId}`);
      return { success: false, sent: 0, failed: 0 };
    }

    // Set customerName from user data if not provided
    if (!data.customerName) {
      data.customerName = user.name || user.username;
    }

    const { title, body, dataPayload } = generatePushContent(type, data);

    const result = await sendFCMNotifications(uniqueTokens, title, body, dataPayload);
    console.log(`[Push] Sent ${type} to user ${userId}: ${result.success} success, ${result.failed} failed`);

    // Clean up invalid/unregistered tokens from DB
    if (result.invalidTokens && result.invalidTokens.length > 0) {
      try {
        const invalidSet = new Set(result.invalidTokens);
        const cleanedTokenObjects = tokenObjects.filter((t: any) => {
          const tok = typeof t === 'string' ? t : t.token;
          return tok && !invalidSet.has(tok);
        });
        await prisma.pppoeUser.update({
          where: { id: userId },
          data: { fcmTokens: JSON.stringify(cleanedTokenObjects) },
        });
        console.log(`[Push] Cleaned ${result.invalidTokens.length} invalid token(s) for user ${userId}`);
      } catch (cleanupError: any) {
        console.error(`[Push] Failed to clean up tokens for user ${userId}:`, cleanupError.message);
      }
    }

    return { success: result.success > 0, sent: result.success, failed: result.failed };
  } catch (error: any) {
    console.error(`[Push] Error sending to user ${userId}:`, error.message);
    return { success: false, sent: 0, failed: 1 };
  }
}

/**
 * Send push notification to multiple users by userIds
 */
export async function sendPushToUsers(
  userIds: string[],
  type: PushTemplateType,
  data: PushTemplateData
): Promise<{ success: number; failed: number }> {
  if (userIds.length === 0) return { success: 0, failed: 0 };

  try {
    // Get all FCM tokens for these users
    const users = await prisma.pppoeUser.findMany({
      where: { id: { in: userIds } },
      select: { fcmTokens: true },
    });

    // Parse FCM tokens from JSON strings
    const allTokens: string[] = [];
    for (const u of users) {
      if (!u.fcmTokens) continue;
      try {
        const parsed = JSON.parse(u.fcmTokens);
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            const tok = typeof t === 'string' ? t : t.token;
            if (tok) allTokens.push(tok);
          }
        } else if (typeof parsed === 'string') {
          allTokens.push(parsed);
        }
      } catch {
        allTokens.push(u.fcmTokens);
      }
    }

    if (allTokens.length === 0) {
      console.log(`[Push] No FCM tokens found for ${userIds.length} users`);
      return { success: 0, failed: 0 };
    }

    const { title, body, dataPayload } = generatePushContent(type, data);
    const result = await sendFCMNotifications(allTokens, title, body, dataPayload);

    console.log(`[Push] Sent ${type} to ${allTokens.length} devices: ${result.success} success, ${result.failed} failed`);
    return result;
  } catch (error: any) {
    console.error(`[Push] Batch send error:`, error.message);
    return { success: 0, failed: userIds.length };
  }
}

/**
 * Send push notification to ALL users with FCM tokens
 */
export async function sendPushToAll(
  type: PushTemplateType,
  data: PushTemplateData
): Promise<{ success: number; failed: number }> {
  try {
    const users = await prisma.pppoeUser.findMany({
      where: {
        fcmTokens: { not: null },
        status: { not: 'stop' },
      },
      select: { fcmTokens: true },
    });

    // Parse FCM tokens from JSON strings
    const allTokens: string[] = [];
    for (const u of users) {
      if (!u.fcmTokens) continue;
      try {
        const parsed = JSON.parse(u.fcmTokens);
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            const tok = typeof t === 'string' ? t : t.token;
            if (tok) allTokens.push(tok);
          }
        } else if (typeof parsed === 'string') {
          allTokens.push(parsed);
        }
      } catch {
        allTokens.push(u.fcmTokens);
      }
    }

    if (allTokens.length === 0) {
      console.log(`[Push] No FCM tokens found for broadcast`);
      return { success: 0, failed: 0 };
    }

    const { title, body, dataPayload } = generatePushContent(type, data);
    const result = await sendFCMNotifications(allTokens, title, body, dataPayload);

    console.log(`[Push Broadcast] ${type}: ${result.success} success, ${result.failed} failed out of ${allTokens.length} tokens`);
    return result;
  } catch (error: any) {
    console.error(`[Push Broadcast] Error:`, error.message);
    return { success: 0, failed: 0 };
  }
}
