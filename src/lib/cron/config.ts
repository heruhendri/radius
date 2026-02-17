export interface CronJobConfig {
  type: string;
  name: string;
  description: string;
  schedule: string; // cron pattern
  scheduleLabel: string; // human readable
  handler: () => Promise<any>;
  enabled: boolean;
}

// Centralized cron configuration
export const CRON_JOBS: CronJobConfig[] = [
  {
    type: 'hotspot_sync',
    name: 'Hotspot Voucher Sync',
    description: 'Sync hotspot voucher first login and expiry status with RADIUS',
    schedule: '* * * * *',
    scheduleLabel: 'Every minute',
    handler: async () => {
      const { syncHotspotWithRadius } = await import('./hotspot-sync');
      return syncHotspotWithRadius();
    },
    enabled: true,
  },
  {
    type: 'pppoe_auto_isolir',
    name: 'PPPoE Auto Isolir',
    description: 'Auto-isolate expired PPPoE users and move to isolir group',
    schedule: '0 * * * *',
    scheduleLabel: 'Every hour',
    handler: async () => {
      const { autoIsolatePPPoEUsers } = await import('./pppoe-sync');
      return autoIsolatePPPoEUsers();
    },
    enabled: true,
  },
  {
    type: 'agent_sales',
    name: 'Agent Sales Recording',
    description: 'Record agent sales for active vouchers and calculate commissions',
    schedule: '*/5 * * * *',
    scheduleLabel: 'Every 5 minutes',
    handler: async () => {
      const { recordAgentSales } = await import('./voucher-sync');
      return recordAgentSales();
    },
    enabled: true,
  },
  {
    type: 'invoice_generate',
    name: 'Invoice Generation',
    description: 'Generate monthly invoices for active PPPoE users',
    schedule: '0 7 * * *',
    scheduleLabel: 'Daily at 7 AM',
    handler: async () => {
      const { generateInvoices } = await import('./voucher-sync');
      return generateInvoices();
    },
    enabled: true,
  },
  {
    type: 'invoice_reminder',
    name: 'Invoice Reminder',
    description: 'Send WhatsApp reminders for unpaid invoices based on schedule',
    schedule: '0 * * * *',
    scheduleLabel: 'Every hour',
    handler: async () => {
      const { sendInvoiceReminders } = await import('./voucher-sync');
      return sendInvoiceReminders();
    },
    enabled: true,
  },
  {
    type: 'notification_check',
    name: 'Notification Check',
    description: 'Check for overdue invoices, expired users, and pending registrations',
    schedule: '0 */6 * * *',
    scheduleLabel: 'Every 6 hours',
    handler: async () => {
      const { NotificationService } = await import('../notifications');
      return await NotificationService.runNotificationCheck();
    },
    enabled: true,
  },
  {
    type: 'disconnect_sessions',
    name: 'Disconnect Expired Sessions',
    description: 'Disconnect active RADIUS sessions for expired hotspot vouchers via CoA',
    schedule: '*/5 * * * *',
    scheduleLabel: 'Every 5 minutes',
    handler: async () => {
      const { disconnectExpiredVoucherSessions } = await import('./voucher-sync');
      return disconnectExpiredVoucherSessions();
    },
    enabled: true,
  },
  {
    type: 'telegram_backup',
    name: 'Telegram Auto Backup',
    description: 'Automatic database backup to Telegram based on schedule (daily/12h/6h/weekly)',
    schedule: 'dynamic', // Schedule is set by settings
    scheduleLabel: 'Based on settings',
    handler: async () => {
      const { autoBackupToTelegram } = await import('./telegram-cron');
      return autoBackupToTelegram();
    },
    enabled: true,
  },
  {
    type: 'telegram_health',
    name: 'Telegram Health Check',
    description: 'Send comprehensive system health report to Telegram (DB, RADIUS, billing status)',
    schedule: '0 * * * *',
    scheduleLabel: 'Every hour',
    handler: async () => {
      const { sendHealthCheckToTelegram } = await import('./telegram-cron');
      return sendHealthCheckToTelegram();
    },
    enabled: true,
  },
  {
    type: 'activity_log_cleanup',
    name: 'Activity Log Cleanup',
    description: 'Clean old activity logs older than 30 days to maintain database performance',
    schedule: '0 2 * * *',
    scheduleLabel: 'Daily at 2 AM',
    handler: async () => {
      const { cleanOldActivities } = await import('../activity-log');
      return cleanOldActivities(30);
    },
    enabled: true,
  },
  {
    type: 'auto_renewal',
    name: 'Auto Renewal (Prepaid)',
    description: 'Automatically renew prepaid users from balance if autoRenewal enabled',
    schedule: '0 8 * * *',
    scheduleLabel: 'Daily at 8 AM',
    handler: async () => {
      const { processAutoRenewal } = await import('./auto-renewal');
      return processAutoRenewal();
    },
    enabled: true,
  },
  {
    type: 'webhook_log_cleanup',
    name: 'Webhook Log Cleanup',
    description: 'Clean old webhook logs older than 30 days to maintain database performance',
    schedule: '0 3 * * *',
    scheduleLabel: 'Daily at 3 AM',
    handler: async () => {
      const { prisma } = await import('../prisma');
      const { nanoid } = await import('nanoid');
      
      const startedAt = new Date();
      
      // Create history record
      const history = await prisma.cronHistory.create({
        data: {
          id: nanoid(),
          jobType: 'webhook_log_cleanup',
          status: 'running',
          startedAt,
        },
      });
      
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        
        const result = await prisma.webhookLog.deleteMany({
          where: {
            createdAt: { lt: cutoffDate }
          }
        });
        
        const completedAt = new Date();
        const duration = completedAt.getTime() - startedAt.getTime();
        
        // Update history with success
        await prisma.cronHistory.update({
          where: { id: history.id },
          data: {
            status: 'success',
            completedAt,
            duration,
            result: `Deleted ${result.count} webhook logs older than 30 days`,
          },
        });
        
        return { 
          success: true,
          deleted: result.count, 
          cutoffDate: cutoffDate.toISOString(),
          message: `Deleted ${result.count} webhook logs older than 30 days`
        };
      } catch (error: any) {
        // Update history with error
        await prisma.cronHistory.update({
          where: { id: history.id },
          data: {
            status: 'error',
            completedAt: new Date(),
            error: error.message,
          },
        });
        
        return {
          success: false,
          deleted: 0,
          error: error.message
        };
      }
    },
    enabled: true,
  },
  {
    type: 'freeradius_health',
    name: 'FreeRADIUS Health Check',
    description: 'Monitor FreeRADIUS service health, auto-restart if down, and send alerts to admins',
    schedule: '*/5 * * * *',
    scheduleLabel: 'Every 5 minutes',
    handler: async () => {
      const { freeradiusHealthCheck } = await import('./freeradius-health');
      return freeradiusHealthCheck(true); // auto-restart enabled
    },
    enabled: true,
  },
];

// Helper to get next run time from cron pattern
export function getNextRunTime(cronPattern: string, from: Date = new Date()): Date {
  // Simple implementation for common patterns
  // For production, use 'cron-parser' library
  const now = new Date(from);
  
  if (cronPattern === '* * * * *') {
    // Every minute
    return new Date(now.getTime() + 60000);
  } else if (cronPattern === '*/5 * * * *') {
    // Every 5 minutes
    const nextMinute = Math.ceil(now.getMinutes() / 5) * 5;
    const next = new Date(now);
    next.setMinutes(nextMinute, 0, 0);
    if (next <= now) next.setMinutes(nextMinute + 5);
    return next;
  } else if (cronPattern === '0 * * * *') {
    // Every hour
    const next = new Date(now);
    next.setHours(now.getHours() + 1, 0, 0, 0);
    return next;
  } else if (cronPattern === '0 2 * * *') {
    // Daily at 2 AM
    const next = new Date(now);
    next.setHours(2, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  } else if (cronPattern === '0 7 * * *') {
    // Daily at 7 AM
    const next = new Date(now);
    next.setHours(7, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  } else if (cronPattern === '0 */6 * * *') {
    // Every 6 hours (at 0, 6, 12, 18)
    const next = new Date(now);
    const currentHour = now.getHours();
    const nextHour = Math.ceil((currentHour + 1) / 6) * 6;
    next.setHours(nextHour, 0, 0, 0);
    if (next <= now) next.setHours(nextHour + 6, 0, 0, 0);
    return next;
  }
  
  return new Date(now.getTime() + 60000); // Default: 1 minute
}
