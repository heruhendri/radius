#!/usr/bin/env node

/**
 * Standalone Cron Service for SALFANET RADIUS
 * 
 * This script runs independently from Next.js server
 * Start with: pm2 start cron-service.js --name salfanet-cron
 */

const cron = require('node-cron');
const { execSync } = require('child_process');

// Use node-fetch for Node.js versions without built-in fetch
let fetch;
try {
  // Try built-in fetch (Node.js 18+)
  fetch = globalThis.fetch;
} catch (e) {
  // Fallback to node-fetch
  fetch = require('node-fetch');
}

const API_URL = process.env.API_URL || 'http://localhost:3000';

console.log('[CRON SERVICE] Starting cron service...');
console.log('[CRON SERVICE] API URL:', API_URL);
console.log('[CRON SERVICE] Node version:', process.version);

/**
 * Execute cron job via API endpoint
 */
async function runCronJob(jobType, description) {
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[CRON] Running ${description} (attempt ${attempt}/${maxRetries})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(`${API_URL}/api/cron`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'SALFANET-CRON-SERVICE'
        },
        body: JSON.stringify({ type: jobType }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`[CRON] ${description} completed:`, result.success ? '✓' : '✗', result.message || '');
      return result;
      
    } catch (error) {
      lastError = error;
      console.error(`[CRON] ${description} failed (attempt ${attempt}):`, error.message);
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[CRON] Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error(`[CRON] ${description} failed after ${maxRetries} attempts`);
  return { success: false, error: lastError?.message || 'Unknown error' };
}

// ==================== CRON SCHEDULES ====================

// 1. Hotspot Voucher Sync - Every minute
cron.schedule('* * * * *', async () => {
  await runCronJob('hotspot_sync', 'Hotspot Voucher Sync');
});

// 2. PPPoE Auto Isolir - Every hour
cron.schedule('0 * * * *', async () => {
  await runCronJob('pppoe_auto_isolir', 'PPPoE Auto Isolir');
});

// 3. Agent Sales Recording - Every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  await runCronJob('agent_sales', 'Agent Sales Recording');
});

// 4. Invoice Generation - Daily at 7 AM
cron.schedule('0 7 * * *', async () => {
  await runCronJob('invoice_generate', 'Invoice Generation');
});

// 5. Invoice Reminder - Every hour
cron.schedule('0 * * * *', async () => {
  await runCronJob('invoice_reminder', 'Invoice Reminder');
});

// 6. Invoice Status Update - Every hour
cron.schedule('0 * * * *', async () => {
  await runCronJob('invoice_status_update', 'Invoice Status Update');
});

// 7. Notification Check - Every 6 hours
cron.schedule('0 */6 * * *', async () => {
  await runCronJob('notification_check', 'Notification Check');
});

// 8. Session Monitoring - Every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  await runCronJob('session_monitor', 'Session Security Monitoring');
});

// 9. Disconnect Expired Sessions - Every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  await runCronJob('disconnect_sessions', 'Disconnect Expired Sessions');
});

// 9. Activity Log Cleanup - Daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  await runCronJob('activity_log_cleanup', 'Activity Log Cleanup');
});

// 10. Auto Renewal - Daily at 8 AM
cron.schedule('0 8 * * *', async () => {
  await runCronJob('auto_renewal', 'Auto Renewal');
});

// 11. Webhook Log Cleanup - Daily at 3 AM
cron.schedule('0 3 * * *', async () => {
  await runCronJob('webhook_log_cleanup', 'Webhook Log Cleanup');
});

// 12. FreeRADIUS Health Check - Every 5 minutes ⭐ NEW
cron.schedule('*/5 * * * *', async () => {
  await runCronJob('freeradius_health', 'FreeRADIUS Health Check');
});

console.log('[CRON SERVICE] All cron jobs initialized successfully!');
console.log('[CRON SERVICE] Schedules:');
console.log('  - Hotspot Sync: Every minute');
console.log('  - PPPoE Auto Isolir: Every hour');
console.log('  - Agent Sales: Every 5 minutes');
console.log('  - Invoice Generation: Daily at 7 AM');
console.log('  - Invoice Reminder: Every hour');
console.log('  - Invoice Status Update: Every hour');
console.log('  - Notification Check: Every 6 hours');
console.log('  - Disconnect Sessions: Every 5 minutes');
console.log('  - Activity Log Cleanup: Daily at 2 AM');
console.log('  - Auto Renewal: Daily at 8 AM');
console.log('  - Webhook Log Cleanup: Daily at 3 AM');
console.log('  - FreeRADIUS Health Check: Every 5 minutes');

// Keep the process running
process.on('SIGINT', () => {
  console.log('[CRON SERVICE] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[CRON SERVICE] Received SIGTERM, shutting down...');
  process.exit(0);
});
