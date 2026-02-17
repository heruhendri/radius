import { NextRequest, NextResponse } from 'next/server'
import { getCronHistory, recordAgentSales, generateInvoices, sendInvoiceReminders, disconnectExpiredVoucherSessions } from '@/lib/cron/voucher-sync'

/**
 * GET /api/cron - Get cron history
 */
export async function GET(request: NextRequest) {
  try {
    const history = await getCronHistory()
    
    return NextResponse.json({
      success: true,
      history
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * POST /api/cron - Manual trigger cron job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const jobType = body.type || 'voucher_sync'
    
    console.log('[CRON API] Received job type:', jobType, 'Body:', body)
    
    let result: any
    
    switch (jobType) {
      case 'hotspot_sync':
      case 'voucher_sync': // Backward compatibility
        const { syncHotspotWithRadius } = await import('@/lib/cron/hotspot-sync')
        result = await syncHotspotWithRadius()
        return NextResponse.json({
          success: result.success,
          activated: result.activated,
          expired: result.expired,
          message: result.message,
          error: result.error
        })
        
      case 'pppoe_auto_isolir':
      case 'auto_isolir': // Backward compatibility
        const { autoIsolatePPPoEUsers } = await import('@/lib/cron/pppoe-sync')
        result = await autoIsolatePPPoEUsers()
        return NextResponse.json({
          success: result.success,
          isolated: result.isolated,
          error: result.error
        })
        
      case 'agent_sales':
        result = await recordAgentSales()
        return NextResponse.json({
          success: result.success,
          recorded: result.recorded,
          error: result.error
        })
        
      case 'invoice_generate':
        result = await generateInvoices()
        return NextResponse.json({
          success: result.success,
          generated: result.generated,
          skipped: result.skipped,
          error: result.error
        })
        
      case 'invoice_reminder':
        // Pass force=true to bypass time check for manual trigger
        result = await sendInvoiceReminders(true)
        return NextResponse.json({
          success: result.success,
          sent: result.sent,
          skipped: result.skipped,
          error: result.error
        })
        
      case 'invoice_status_update':
        const { updateInvoiceStatus } = await import('@/lib/cron/invoice-status-updater')
        result = await updateInvoiceStatus()
        return NextResponse.json({
          success: result.success,
          updated: result.updated,
          error: result.error
        })
        
      case 'notification_check':
        const { NotificationService } = await import('@/lib/notifications')
        result = await NotificationService.runNotificationCheck()
        return NextResponse.json(result)
        
      case 'auto_isolir_users':
        const { autoIsolateExpiredUsers } = await import('@/lib/cron/voucher-sync')
        result = await autoIsolateExpiredUsers()
        return NextResponse.json({
          success: result.success,
          isolated: result.isolated,
          error: result.error
        })
        
      case 'telegram_backup':
        const { autoBackupToTelegram } = await import('@/lib/cron/telegram-cron')
        result = await autoBackupToTelegram()
        return NextResponse.json({
          success: result.success,
          error: result.error
        })
        
      case 'telegram_health':
        const { sendHealthCheckToTelegram } = await import('@/lib/cron/telegram-cron')
        result = await sendHealthCheckToTelegram()
        return NextResponse.json({
          success: result.success,
          error: result.error
        })
        
      case 'disconnect_sessions':
        result = await disconnectExpiredVoucherSessions()
        return NextResponse.json({
          success: result.success,
          disconnected: result.disconnected,
          error: result.error
        })
        
      case 'activity_log_cleanup':
        const { cleanOldActivities } = await import('@/lib/activity-log')
        result = await cleanOldActivities(30)
        return NextResponse.json({
          success: result.success,
          deleted: result.deleted,
          error: result.error
        })
        
      case 'auto_renewal':
        const { processAutoRenewal } = await import('@/lib/cron/auto-renewal')
        result = await processAutoRenewal()
        return NextResponse.json({
          success: true,
          processed: result.processed,
          paid: result.success,
          failed: result.failed,
          message: `Processed ${result.processed} users, paid ${result.success}, failed ${result.failed}`
        })
        
      case 'webhook_log_cleanup':
        const { prisma } = await import('@/lib/prisma')
        const { nanoid } = await import('nanoid')
        
        const startedAt = new Date()
        
        // Create history record
        const history = await prisma.cronHistory.create({
          data: {
            id: nanoid(),
            jobType: 'webhook_log_cleanup',
            status: 'running',
            startedAt,
          },
        })
        
        try {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - 30)
          
          const deleteResult = await prisma.webhookLog.deleteMany({
            where: {
              createdAt: { lt: cutoffDate }
            }
          })
          
          const completedAt = new Date()
          const duration = completedAt.getTime() - startedAt.getTime()
          
          // Update history with success
          await prisma.cronHistory.update({
            where: { id: history.id },
            data: {
              status: 'success',
              completedAt,
              duration,
              result: `Deleted ${deleteResult.count} webhook logs older than 30 days`,
            },
          })
          
          return NextResponse.json({
            success: true,
            deleted: deleteResult.count,
            cutoffDate: cutoffDate.toISOString(),
            message: `Deleted ${deleteResult.count} webhook logs older than 30 days`
          })
        } catch (cleanupError: any) {
          // Update history with error
          await prisma.cronHistory.update({
            where: { id: history.id },
            data: {
              status: 'error',
              completedAt: new Date(),
              error: cleanupError.message,
            },
          })
          
          return NextResponse.json({
            success: false,
            deleted: 0,
            error: cleanupError.message
          })
        }
        
      case 'session_monitor':
        const { SessionMonitor } = await import('@/lib/session-monitor')
        result = await SessionMonitor.runAllChecks()
        return NextResponse.json({
          success: result.success,
          error: result.error
        })
        
      case 'freeradius_health':
        const { freeradiusHealthCheck } = await import('@/lib/cron/freeradius-health')
        result = await freeradiusHealthCheck(true) // auto-restart enabled
        return NextResponse.json({
          success: result.success,
          status: result.status,
          action: result.action,
          error: result.error,
          message: result.action === 'restarted' 
            ? 'FreeRADIUS was down and has been restarted'
            : result.action === 'restart_failed'
            ? 'FreeRADIUS restart failed - manual intervention required'
            : 'FreeRADIUS is healthy'
        })
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid job type'
        }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
