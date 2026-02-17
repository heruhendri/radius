import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { disconnectExpiredSessions, disconnectPPPoEUser, sendCoADisconnect } from '@/lib/services/coaService'
import { nanoid } from 'nanoid'
import { randomBytes } from 'crypto'
import { startBackupCron, startHealthCron } from './telegram-cron'
import { nowWIB, formatWIB, startOfDayWIBtoUTC, endOfDayWIBtoUTC } from '@/lib/timezone'

let isRunning = false
let isAutoIsolirRunning = false

/**
 * Sync voucher status from RADIUS authentication logs
 */
export async function syncVoucherFromRadius(): Promise<{ success: boolean; synced: number; error?: string }> {
  if (isRunning) {
    return { success: false, synced: 0, error: 'Already running' }
  }

  isRunning = true
  const startedAt = new Date()

  // Create history record in database
  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'voucher_sync',
      status: 'running',
      startedAt,
    },
  })

  try {
    let syncedCount = 0

    // Sync voucher status from radacct (WAITING -> ACTIVE)
    // Get WAITING vouchers that have active sessions in radacct
    const waitingVouchers = await prisma.hotspotVoucher.findMany({
      where: {
        status: 'WAITING',
      },
      select: {
        id: true,
        code: true,
        profile: true,
      },
    })

    for (const voucher of waitingVouchers) {
      // Check if voucher has an active session (first login)
      const activeSession = await prisma.radacct.findFirst({
        where: {
          username: voucher.code,
          acctstarttime: { not: null },
        },
        orderBy: {
          acctstarttime: 'asc', // Get first login
        },
      })

      if (activeSession && activeSession.acctstarttime) {
        // FreeRADIUS acctstarttime from radacct - already in server local time (WIB)
        // Store as-is, no conversion needed
        const firstLoginAt = activeSession.acctstarttime instanceof Date
          ? activeSession.acctstarttime
          : new Date(activeSession.acctstarttime)

        let expiresAtMs = firstLoginAt.getTime()        // Add validity time in milliseconds
        if (voucher.profile.validityUnit === 'MINUTES') {
          expiresAtMs += voucher.profile.validityValue * 60 * 1000
        } else if (voucher.profile.validityUnit === 'HOURS') {
          expiresAtMs += voucher.profile.validityValue * 60 * 60 * 1000
        } else if (voucher.profile.validityUnit === 'DAYS') {
          expiresAtMs += voucher.profile.validityValue * 24 * 60 * 60 * 1000
        } else if (voucher.profile.validityUnit === 'MONTHS') {
          // For months, use Date manipulation to handle month boundaries
          const expiresAt = new Date(firstLoginAt)
          expiresAt.setMonth(expiresAt.getMonth() + voucher.profile.validityValue)
          expiresAtMs = expiresAt.getTime()
        }

        const expiresAt = new Date(expiresAtMs)

        // Update voucher to ACTIVE with server local time (WIB)
        const updatedVoucher = await prisma.hotspotVoucher.update({
          where: { id: voucher.id },
          data: {
            status: 'ACTIVE',
            firstLoginAt: firstLoginAt,
            expiresAt: expiresAt,
          },
          include: {
            profile: true,
            order: true,
            agent: true,
          },
        })

        console.log(`[CRON] Voucher ${voucher.code} activated: firstLogin=${firstLoginAt.toISOString()}, expires=${expiresAt.toISOString()}`)

        // Auto-sync to Keuangan (only for manually generated vouchers, not e-voucher orders)
        if (!updatedVoucher.orderId) {
          try {
            const hotspotCategory = await prisma.transactionCategory.findFirst({
              where: { name: 'Pembayaran Hotspot', type: 'INCOME' },
            })

            if (hotspotCategory) {
              // Check if transaction already exists
              const existingTransaction = await prisma.transaction.findFirst({
                where: { reference: `VOUCHER-${updatedVoucher.code}` },
              })

              if (!existingTransaction) {
                // Check if this is an agent voucher
                const isAgentVoucher = updatedVoucher.agentId !== null;
                const hasResellerFee = updatedVoucher.profile.resellerFee > 0;

                // Income = sellingPrice (harga jual ke customer)
                const incomeAmount = updatedVoucher.profile.sellingPrice;

                await prisma.transaction.create({
                  data: {
                    id: nanoid(),
                    categoryId: hotspotCategory.id,
                    type: 'INCOME',
                    amount: incomeAmount,
                    description: `Voucher ${updatedVoucher.profile.name} - ${updatedVoucher.code}${isAgentVoucher ? ' (Agent)' : ''}`,
                    date: firstLoginAt,
                    reference: `VOUCHER-${updatedVoucher.code}`,
                    notes: `Pendapatan voucher hotspot (Harga Jual: Rp ${incomeAmount}, Harga Modal: Rp ${updatedVoucher.profile.costPrice})`,
                  },
                })
                console.log(`[CRON] Keuangan synced for voucher ${voucher.code} - Income Rp ${incomeAmount}`)

                // If agent voucher, also record commission expense
                // Net profit = sellingPrice - resellerFee
                if (isAgentVoucher && hasResellerFee) {
                  const agentCategory = await prisma.transactionCategory.findFirst({
                    where: { name: 'Komisi Agent', type: 'EXPENSE' },
                  })

                  if (agentCategory) {
                    const existingCommission = await prisma.transaction.findFirst({
                      where: { reference: `COMMISSION-${updatedVoucher.code}` },
                    })

                    if (!existingCommission) {
                      // Get agent name from included relation
                      const agentName = updatedVoucher.agent?.name || 'Unknown';
                      const commissionAmount = updatedVoucher.profile.resellerFee;
                      const netProfit = incomeAmount - commissionAmount;

                      await prisma.transaction.create({
                        data: {
                          id: nanoid(),
                          categoryId: agentCategory.id,
                          type: 'EXPENSE',
                          amount: commissionAmount,
                          description: `Komisi Agent ${agentName} - Voucher ${updatedVoucher.code}`,
                          date: firstLoginAt,
                          reference: `COMMISSION-${updatedVoucher.code}`,
                          notes: `Komisi agent untuk voucher ${updatedVoucher.profile.name} (Net Profit: Rp ${netProfit})`,
                        },
                      })
                      console.log(`[CRON] Agent commission synced for voucher ${voucher.code} - Rp ${commissionAmount} (Net: Rp ${netProfit})`)
                    }
                  }
                }
              }
            }
          } catch (keuanganError) {
            console.error(`[CRON] Keuangan sync error for ${voucher.code}:`, keuanganError)
          }
        }

        syncedCount++
      }
    }

    // Check and mark expired vouchers (by validity time OR usage duration)
    // IMPORTANT: Use raw SQL for performance
    // Database stores datetime in UTC, NOW() returns UTC (MySQL timezone is UTC)

    // FIRST: Disconnect any active sessions for vouchers that are ALREADY EXPIRED
    // This catches vouchers that were marked EXPIRED in previous runs but session wasn't disconnected
    console.log('[CRON] Checking for active sessions with expired vouchers...')
    const alreadyExpiredWithSession = await prisma.radacct.findMany({
      where: {
        acctstoptime: null, // Active session
      },
      select: {
        username: true,
        acctsessionid: true,
        framedipaddress: true,
        nasipaddress: true,
      },
    })

    let alreadyDisconnectedCount = 0
    for (const session of alreadyExpiredWithSession) {
      // Check if this is a voucher and if it's EXPIRED
      const voucher = await prisma.hotspotVoucher.findUnique({
        where: { code: session.username },
        include: { router: true }, // IMPORTANT: Include router from voucher
      })

      if (!voucher) continue // Not a voucher (might be PPPoE)

      if (voucher.status === 'EXPIRED') {
        console.log(`[CRON] Found active session for EXPIRED voucher ${session.username} - disconnecting`)

        // PRIORITY 1: Use router from voucher (routerId relation)
        let nas = voucher.router

        // FALLBACK: Try to find router by session NAS IP (if voucher has no router)
        if (!nas) {
          nas = await prisma.router.findFirst({
            where: {
              OR: [
                { nasname: session.nasipaddress },
                { ipAddress: session.nasipaddress },
              ]
            },
          })
        }

        // LAST RESORT: Use first active router
        if (!nas) {
          nas = await prisma.router.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
          })
        }

        if (nas) {
          // Prefer ipAddress over nasname for CoA target
          const coaTargetIp = nas.ipAddress || nas.nasname

          const coaResult = await sendCoADisconnect(
            session.username,
            coaTargetIp,
            nas.secret,
            session.acctsessionid,
            session.framedipaddress
          )

          if (coaResult.success) {
            alreadyDisconnectedCount++
            console.log(`[CRON] ✓ Disconnected already-expired ${session.username} from ${nas.name} (${coaTargetIp})`)
          } else {
            console.error(`[CRON] ✗ Failed to disconnect ${session.username}:`, coaResult.error)
          }
        } else {
          console.error(`[CRON] ✗ No router found for voucher ${session.username}`)
        }
      }
    }

    if (alreadyDisconnectedCount > 0) {
      console.log(`[CRON] Disconnected ${alreadyDisconnectedCount} sessions for already-expired vouchers`)
    }

    // Method 1: Expired by validity time (expiresAt < NOW)
    // IMPORTANT: Use NOW() not UTC_TIMESTAMP() because expiresAt is stored in server local time (WIB)
    // firstLoginAt comes from FreeRADIUS radacct which uses server local time
    const expiredByValidity = await prisma.$queryRaw<Array<{ code: string; id: string }>>`
      SELECT code, id FROM hotspot_vouchers
      WHERE status = 'ACTIVE'
        AND expiresAt < NOW()
    `

    // Method 2: Expired by usage duration (total acctsessiontime >= usageDuration)
    // Get ACTIVE vouchers with usageDuration limit
    const activeVouchersWithDuration = await prisma.hotspotVoucher.findMany({
      where: {
        status: 'ACTIVE',
        profile: {
          usageDuration: { not: null }
        }
      },
      select: {
        id: true,
        code: true,
        profile: {
          select: {
            usageDuration: true
          }
        }
      }
    })

    const expiredByDuration: Array<{ code: string; id: string }> = []

    // Check each voucher's total session time
    for (const voucher of activeVouchersWithDuration) {
      if (!voucher.profile.usageDuration) continue

      // Convert duration to seconds (assuming HOURS as default unit)
      let maxDurationSeconds = 0

      // usageDuration is stored in hours in the database
      maxDurationSeconds = voucher.profile.usageDuration * 60 * 60

      // Sum all session times for this voucher (including closed sessions)
      const totalUsage = await prisma.radacct.aggregate({
        where: {
          username: voucher.code
        },
        _sum: {
          acctsessiontime: true
        }
      })

      const usedSeconds = totalUsage._sum.acctsessiontime || 0

      if (usedSeconds >= maxDurationSeconds) {
        expiredByDuration.push({
          code: voucher.code,
          id: voucher.id
        })
        console.log(`[CRON] Voucher ${voucher.code} expired by duration: ${usedSeconds}s / ${maxDurationSeconds}s`)
      }
    }

    // Combine both expiry methods (remove duplicates)
    const allExpiredVouchers = [
      ...expiredByValidity,
      ...expiredByDuration.filter(d => !expiredByValidity.find(v => v.id === d.id))
    ]

    console.log(`[CRON] Found ${allExpiredVouchers.length} expired vouchers (${expiredByValidity.length} by validity, ${expiredByDuration.length} by duration)`)

    // Mark expired vouchers, remove from RADIUS, and disconnect active sessions
    let expiredCount = 0
    let disconnectedCount = 0

    for (const voucher of allExpiredVouchers) {
      try {
        // Get full voucher data with router relation
        const fullVoucher = await prisma.hotspotVoucher.findUnique({
          where: { id: voucher.id },
          include: { router: true },
        })

        if (!fullVoucher) continue

        // 1. Update status to EXPIRED (NO DELETE - keep in database for history)
        await prisma.hotspotVoucher.update({
          where: { id: voucher.id },
          data: { status: 'EXPIRED' }
        })

        // 2. Remove from RADIUS authentication tables (prevent re-login)
        await prisma.radcheck.deleteMany({
          where: { username: voucher.code }
        })
        await prisma.radusergroup.deleteMany({
          where: { username: voucher.code }
        })

        // 3. Check if has active session and disconnect immediately
        const activeSession = await prisma.radacct.findFirst({
          where: {
            username: voucher.code,
            acctstoptime: null,
          },
          select: {
            acctsessionid: true,
            framedipaddress: true,
            nasipaddress: true,
          }
        })

        if (activeSession) {
          console.log(`[CRON] Voucher ${voucher.code} has active session - disconnecting via CoA`)

          // PRIORITY 1: Use router from voucher (routerId relation)
          let nas = fullVoucher.router

          // FALLBACK: Try to find router by session NAS IP
          if (!nas) {
            nas = await prisma.router.findFirst({
              where: {
                OR: [
                  { nasname: activeSession.nasipaddress },
                  { ipAddress: activeSession.nasipaddress },
                ]
              },
            })
          }

          // LAST RESORT: Use first active router
          if (!nas) {
            nas = await prisma.router.findFirst({
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
            })
          }

          if (nas) {
            // Prefer ipAddress over nasname for CoA target
            const coaTargetIp = nas.ipAddress || nas.nasname

            // Send CoA Disconnect
            const coaResult = await sendCoADisconnect(
              voucher.code,
              coaTargetIp,
              nas.secret,
              activeSession.acctsessionid,
              activeSession.framedipaddress
            )

            if (coaResult.success) {
              disconnectedCount++
              console.log(`[CRON] ✓ Disconnected ${voucher.code} from ${nas.name} (${coaTargetIp})`)
            } else {
              console.error(`[CRON] ✗ Failed to disconnect ${voucher.code}:`, coaResult.error)
            }
          } else {
            console.error(`[CRON] ✗ No router found for voucher ${voucher.code}`)
          }
        }

        expiredCount++
        console.log(`[CRON] Voucher ${voucher.code} marked as EXPIRED and removed from RADIUS`)
      } catch (err) {
        console.error(`[CRON] Error processing expired voucher ${voucher.code}:`, err)
      }
    }

    // Update history in database
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Synced ${syncedCount} vouchers, expired ${expiredCount} vouchers (${expiredByValidity.length} by validity, ${expiredByDuration.length} by duration), disconnected ${disconnectedCount} newly-expired + ${alreadyDisconnectedCount} already-expired sessions`,
      },
    })

    console.log(`[CRON] Voucher sync completed: synced=${syncedCount}, expired=${expiredCount} (validity=${expiredByValidity.length}, duration=${expiredByDuration.length}), disconnected=${disconnectedCount} new + ${alreadyDisconnectedCount} already-expired`)

    // Create notification for bulk session disconnects
    const totalDisconnected = disconnectedCount + alreadyDisconnectedCount
    if (totalDisconnected > 0) {
      try {
        const { NotificationService } = await import('../notifications')
        await NotificationService.notifyBulkSessionDisconnect(totalDisconnected)
      } catch (notifError: any) {
        console.error('[Voucher Sync] Failed to create session disconnect notification:', notifError.message)
      }
    }

    return { success: true, synced: syncedCount }

  } catch (error: any) {
    console.error('Voucher sync error:', error)

    // Update history with error
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    })

    return { success: false, synced: 0, error: error.message }
  } finally {
    isRunning = false
  }
}

/**
 * Record agent sales for active vouchers
 */
export async function recordAgentSales(): Promise<{ success: boolean; recorded: number; error?: string }> {
  const startedAt = new Date()

  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'agent_sales',
      status: 'running',
      startedAt,
    },
  })

  try {
    // Get all ACTIVE vouchers that have agent batch codes (contains hyphen pattern)
    const activeVouchers = await prisma.hotspotVoucher.findMany({
      where: {
        status: 'ACTIVE',
        batchCode: {
          not: null,
        },
        firstLoginAt: {
          not: null,
        },
      },
      include: {
        profile: true,
      },
    })

    let recordedCount = 0

    for (const voucher of activeVouchers) {
      // Skip if batch code doesn't look like agent format (no hyphen)
      if (!voucher.batchCode?.includes('-')) {
        continue
      }

      // Check if sale already recorded
      const existingSale = await prisma.agentSale.findFirst({
        where: {
          voucherCode: voucher.code,
        },
      })

      if (existingSale) {
        continue // Already recorded
      }

      // Extract agent name from batch code (format: AGENTNAME-TIMESTAMP)
      const agentNamePattern = voucher.batchCode.split('-')[0]

      // Find agent by matching name pattern (case-insensitive for MySQL)
      const agent = await prisma.agent.findFirst({
        where: {
          name: {
            equals: agentNamePattern,
          },
        },
      })

      if (!agent) {
        continue // Skip if agent not found
      }

      try {
        // Record sale with resellerFee as agent profit
        await prisma.agentSale.create({
          data: {
            id: crypto.randomUUID(),
            agentId: agent.id,
            voucherCode: voucher.code,
            profileName: voucher.profile.name,
            amount: voucher.profile.resellerFee,
            createdAt: voucher.firstLoginAt!,
          },
        })

        recordedCount++
      } catch (error: any) {
        console.error(`Failed to record sale for ${voucher.code}:`, error.message)
      }
    }

    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Recorded ${recordedCount} agent sales`,
      },
    })

    return { success: true, recorded: recordedCount }
  } catch (error: any) {
    console.error('Agent sales recording error:', error)

    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    })

    return { success: false, recorded: 0, error: error.message }
  }
}

/**
 * Get cron history from database
 */
export async function getCronHistory(limit: number = 50) {
  return await prisma.cronHistory.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
  })
}

/**
 * Initialize cron jobs
 */
export function initCronJobs() {
  // Import the new hotspot voucher cron
  import('./hotspot-voucher-cron').then(({ runHotspotVoucherCron }) => {
    // Run hotspot voucher lifecycle cron every minute
    // This handles: WAITING→USED (first login), USED→EXPIRED, cleanup stale sessions
    cron.schedule('* * * * *', async () => {
      console.log('[CRON] Running hotspot voucher lifecycle...')
      const result = await runHotspotVoucherCron()
      console.log('[CRON] Hotspot voucher lifecycle completed:', result)
    })
    console.log('[CRON] Hotspot voucher lifecycle cron initialized (every minute)')
  }).catch(err => {
    console.error('[CRON] Failed to import hotspot-voucher-cron, falling back to legacy:', err)
    // Fallback to legacy voucher sync
    cron.schedule('* * * * *', async () => {
      console.log('[CRON] Running voucher sync (legacy)...')
      const result = await syncVoucherFromRadius()
      console.log('[CRON] Voucher sync completed:', result)
    })
  })

  // Run agent sales recording every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Running agent sales recording...')
    const result = await recordAgentSales()
    console.log('[CRON] Agent sales recording completed:', result)
  })

  // Run invoice generation daily at 7 AM
  cron.schedule('0 7 * * *', async () => {
    console.log('[CRON] Running invoice generation...')
    const result = await generateInvoices()
    console.log('[CRON] Invoice generation completed:', result)
  })

  // Run invoice reminder every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running invoice reminder check...')
    const result = await sendInvoiceReminders()
    console.log('[CRON] Invoice reminder completed:', result)
  })

  // Run invoice status update every hour (update PENDING → OVERDUE)
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running invoice status update...')
    const { updateInvoiceStatus } = await import('./invoice-status-updater')
    const result = await updateInvoiceStatus()
    console.log('[CRON] Invoice status update completed:', result)
  })

  // Run auto-isolir expired users every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running auto-isolir for expired users...')
    const result = await autoIsolateExpiredUsers()
    console.log('[CRON] Auto-isolir completed:', result)
  })

  // Initialize Telegram backup & health check crons
  startBackupCron().catch(err => console.error('[CRON] Failed to start Telegram backup:', err))
  startHealthCron().catch(err => console.error('[CRON] Failed to start Telegram health:', err))

  // Run FreeRADIUS health check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Running FreeRADIUS health check...')
    try {
      const { freeradiusHealthCheck } = await import('./freeradius-health')
      const result = await freeradiusHealthCheck(true) // auto-restart enabled
      console.log('[CRON] FreeRADIUS health check completed:', result)
    } catch (error) {
      console.error('[CRON] FreeRADIUS health check failed:', error)
    }
  })

  console.log('[CRON] Jobs initialized: Voucher sync (every minute), Agent sales (every 5 minutes), Invoice generation (daily at 7 AM), Invoice reminders (hourly), Invoice status update (hourly), Auto-isolir (hourly), FreeRADIUS health check (every 5 minutes), Telegram backup & health check')
}

/**
 * Send invoice reminder WhatsApp notifications based on settings
 * @param force - If true, bypass time check (for manual trigger from UI)
 */
export async function sendInvoiceReminders(force: boolean = false): Promise<{ success: boolean; sent: number; skipped: number; error?: string }> {
  const startedAt = new Date()

  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'invoice_reminder',
      status: 'running',
      startedAt,
    },
  })

  try {
    // Get reminder settings
    const settings = await prisma.whatsapp_reminder_settings.findFirst()

    console.log('[Invoice Reminder] Settings:', settings)

    if (!settings || !settings.enabled) {
      const message = !settings ? 'No settings found' : 'Reminder disabled'
      console.log(`[Invoice Reminder] ${message}`)
      const completedAt = new Date()
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: `${message}, skipped`,
        },
      })
      return { success: true, sent: 0, skipped: 0 }
    }

    const reminderDays: number[] = JSON.parse(settings.reminderDays)
    const [targetHour, targetMinute] = settings.reminderTime.split(':').map(Number)

    // Get current WIB time (database stores UTC, setting is in WIB)
    const now = nowWIB()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    // Check if current time matches reminder time (skip check if force=true for manual trigger)
    if (!force && currentHour !== targetHour) {
      const completedAt = new Date()
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: `Not time yet (current: ${currentHour}:${currentMinute}, target: ${targetHour}:${targetMinute})`,
        },
      })
      return { success: true, sent: 0, skipped: 0 }
    }

    console.log(`[Invoice Reminder] ${force ? 'Force triggered (manual)' : 'Time matched'}, proceeding...`)

    let sentCount = 0
    let skippedCount = 0

    // Add overdue reminders: days after due date (positive values = days after due)
    // Comprehensive coverage: 1-10, 14, 21, 28 days overdue
    const overdueDays = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 21, 28]
    const allReminderDays = [...reminderDays, ...overdueDays]

    console.log(`[Invoice Reminder] Processing ${allReminderDays.length} reminder schedules...`)
    console.log(`[Invoice Reminder] Before due: ${reminderDays}, After due (overdue): ${overdueDays}`)

    // For each reminder day, find invoices that match
    for (const reminderDay of allReminderDays) {
      // reminderDay is negative or 0: -5 means 5 days before due, 0 means due date
      // Calculate target due date in WIB: if reminderDay is -5, we want invoices due in 5 days from now
      const nowInWIB = nowWIB()
      const targetDateWIB = new Date(nowInWIB)
      targetDateWIB.setDate(targetDateWIB.getDate() - reminderDay) // Minus negative = add
      targetDateWIB.setHours(0, 0, 0, 0)

      // Convert WIB date boundaries to UTC for database query
      const targetDateUTC = startOfDayWIBtoUTC(targetDateWIB)
      const nextDayUTC = endOfDayWIBtoUTC(targetDateWIB)

      console.log(`[Invoice Reminder] Checking H${reminderDay}: Looking for invoices due on ${formatWIB(targetDateWIB, 'yyyy-MM-dd')} WIB`)

      // Find unpaid invoices (PENDING or OVERDUE) with dueDate matching target (database stores UTC)
      const invoices = await prisma.invoice.findMany({
        where: {
          status: {
            in: ['PENDING', 'OVERDUE']
          },
          dueDate: {
            gte: targetDateUTC,
            lt: nextDayUTC
          }
        },
        include: {
          user: {
            include: {
              profile: true,
              area: true
            }
          }
        }
      })

      console.log(`[Invoice Reminder] Found ${invoices.length} invoices for H${reminderDay}`)

      // Get company info once (shared for all invoices)
      const company = await prisma.company.findFirst()

      if (!company) {
        console.log(`[Invoice Reminder] No company info found, skipping ${invoices.length} invoices`)
        skippedCount += invoices.length
        continue
      }

      // Filter and prepare messages for batch sending with rate limiting
      const messagesToSend: Array<{
        phone: string
        message: string
        data: {
          invoice: typeof invoices[0]
          reminderDay: number
        }
      }> = []

      for (const invoice of invoices) {
        // Skip if user has stopped subscription
        if (invoice.user && invoice.user.status === 'stop') {
          console.log(`[Invoice Reminder] Skipped ${invoice.invoiceNumber}: User has stopped subscription`)
          skippedCount++
          continue
        }

        // Check if this reminder day already sent
        const sentReminders = invoice.sentReminders
          ? JSON.parse(invoice.sentReminders)
          : []

        if (sentReminders.includes(reminderDay)) {
          console.log(`[Invoice Reminder] Skipped ${invoice.invoiceNumber}: H${reminderDay} already sent`)
          skippedCount++
          continue
        }

        if (!invoice.customerPhone) {
          console.log(`[Invoice Reminder] Skipped ${invoice.invoiceNumber}: No customer phone`)
          skippedCount++
          continue
        }

        // Add to batch queue (we'll build message later in sendFunction)
        messagesToSend.push({
          phone: invoice.customerPhone,
          message: '', // Will be built in sendFunction
          data: { invoice, reminderDay }
        })
      }

      // Send messages with rate limiting (5 msg per 10 seconds)
      if (messagesToSend.length > 0) {
        console.log(`[Invoice Reminder] Sending ${messagesToSend.length} reminders with rate limiting...`)

        const { sendWithRateLimit, estimateSendTime, formatEstimatedTime } = await import('@/lib/utils/rateLimiter')
        const { sendInvoiceReminder } = await import('@/lib/whatsapp-notifications')

        const estimatedTime = estimateSendTime(messagesToSend.length)
        console.log(`[Invoice Reminder] Estimated time: ${formatEstimatedTime(estimatedTime)}`)

        const result = await sendWithRateLimit(
          messagesToSend,
          async (msg) => {
            const { invoice, reminderDay } = msg.data

            // Determine if overdue (reminderDay > 0 means days after due date)
            const isOverdue = reminderDay > 0

            // Get customer name with proper fallback
            const customerName = invoice.customerName || invoice.user?.name || 'Pelanggan'

            // Send WhatsApp reminder with appropriate template
            await sendInvoiceReminder({
              phone: invoice.customerPhone!,
              customerName: customerName,
              customerUsername: invoice.customerUsername || invoice.user?.username,
              profileName: (invoice.user as any)?.profile?.name,
              area: (invoice.user as any)?.area?.name,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              dueDate: invoice.dueDate,
              paymentLink: invoice.paymentLink || '',
              companyName: company.name,
              companyPhone: company.phone || '',
              isOverdue: isOverdue
            })

            // Also send email reminder if email is available
            const customerEmail = invoice.customerEmail || invoice.user?.email
            if (customerEmail) {
              try {
                const { EmailService } = await import('@/lib/email')
                await EmailService.sendInvoiceReminder({
                  email: customerEmail,
                  profileName: (invoice.user as any)?.profile?.name,
                  area: (invoice.user as any)?.area?.name,
                  customerName: customerName,
                  customerUsername: invoice.customerUsername || invoice.user?.username,
                  invoiceNumber: invoice.invoiceNumber,
                  amount: invoice.amount,
                  dueDate: invoice.dueDate,
                  paymentLink: invoice.paymentLink || '',
                  companyName: company.name,
                  companyPhone: company.phone || '',
                  isOverdue: isOverdue,
                  daysOverdue: isOverdue ? reminderDay : undefined
                })
              } catch (emailError) {
                console.error(`[Invoice Reminder] Email error for ${invoice.invoiceNumber}:`, emailError)
                // Don't fail the whole process if email fails
              }
            }

            // Mark this reminder as sent
            const sentReminders = invoice.sentReminders
              ? JSON.parse(invoice.sentReminders)
              : []
            sentReminders.push(reminderDay)

            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                sentReminders: JSON.stringify(sentReminders)
              }
            })
          },
          {}, // Use default config: 5 msg/10sec
          (progress) => {
            console.log(`[Invoice Reminder] Progress: ${progress.current}/${progress.total} (Batch ${progress.batch}/${progress.totalBatches})`)
          }
        )

        sentCount += result.sent
        skippedCount += result.failed

        console.log(`[Invoice Reminder] Batch H${reminderDay} completed: ${result.sent} sent, ${result.failed} failed`)
      }
    }

    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Sent ${sentCount} reminders, skipped ${skippedCount}`,
      },
    })

    return { success: true, sent: sentCount, skipped: skippedCount }
  } catch (error: any) {
    console.error('Invoice reminder error:', error)

    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    })

    return { success: false, sent: 0, skipped: 0, error: error.message }
  }
}

/**
 * Auto-isolir PPPoE users with expired expiredAt date
 * Runs every 1 hour to check and isolate expired users
 */
export async function autoIsolateExpiredUsers(): Promise<{ success: boolean; isolated: number; error?: string }> {
  if (isAutoIsolirRunning) {
    return { success: false, isolated: 0, error: 'Already running' }
  }

  isAutoIsolirRunning = true
  const startedAt = new Date()

  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'auto_isolir',
      status: 'running',
      startedAt,
    },
  })

  try {
    // IMPORTANT: Use timezone-aware comparison for isolir
    // User sees expiry in WIB, so we isolate at END of that WIB day
    // Example: expired 5 Nov (WIB) → isolate at 6 Nov 00:00 (WIB) = 5 Nov 17:00 (UTC)
    const nowInWIB = nowWIB()
    const startOfTodayWIB = startOfDayWIBtoUTC(nowInWIB)

    console.log(`[Auto Isolir] Checking for expired users...`)
    console.log(`[Auto Isolir] Now (WIB): ${formatWIB(nowInWIB)}`)
    console.log(`[Auto Isolir] Start of today (WIB -> UTC): ${startOfTodayWIB.toISOString()}`)

    // Find users to isolate:
    // 1. PREPAID: expired (expiredAt < today) AND no successful auto-renewal
    // 2. POSTPAID: expired (expiredAt < today) AND has OVERDUE invoice

    // A. Find PREPAID users that are expired
    // Exclude users with successful auto-renewal (check if they have recent paid invoice)
    const expiredPrepaidUsers = await prisma.pppoeUser.findMany({
      where: {
        status: 'active',
        subscriptionType: 'PREPAID',
        expiredAt: {
          lt: startOfTodayWIB, // expired before start of today (WIB)
        },
      },
      include: {
        profile: true,
        invoices: {
          where: {
            status: { in: ['PENDING', 'OVERDUE'] }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
    })

    // Filter: Only isolate if has unpaid invoice (auto-renewal failed or disabled)
    const prepaidToIsolate = expiredPrepaidUsers.filter(user => {
      // If has unpaid invoice, isolate
      if (user.invoices.length > 0) return true;
      // If no invoice and no auto-renewal, isolate
      if (!user.autoRenewal) return true;
      // If auto-renewal enabled but no invoice, means renewal succeeded - don't isolate
      return false;
    });

    // B. Find POSTPAID users that are expired
    // POSTPAID juga punya expiredAt (billing day bulan berikutnya)
    // Isolate jika expired DAN ada invoice OVERDUE
    const expiredPostpaidUsers = await prisma.pppoeUser.findMany({
      where: {
        status: 'active',
        subscriptionType: 'POSTPAID',
        expiredAt: {
          lt: startOfTodayWIB, // expired before start of today (WIB)
        },
      },
      include: {
        profile: true,
        invoices: {
          where: {
            status: { in: ['PENDING', 'OVERDUE'] }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
    });

    // Filter: Only isolate if has OVERDUE invoice
    const postpaidToIsolate = expiredPostpaidUsers.filter(user => {
      return user.invoices.length > 0 && user.invoices[0].status === 'OVERDUE';
    });

    const expiredUsers = [...prepaidToIsolate, ...postpaidToIsolate]

    if (expiredUsers.length === 0) {
      console.log('[Auto Isolir] No expired users found')

      const completedAt = new Date()
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: 'No expired users found',
        },
      })

      return { success: true, isolated: 0 }
    }

    console.log(`[Auto Isolir] Found ${expiredUsers.length} user(s) to isolate (${prepaidToIsolate.length} PREPAID expired, ${postpaidToIsolate.length} POSTPAID expired+overdue)`)

    let isolatedCount = 0
    const errors: string[] = []

    for (const user of expiredUsers) {
      try {
        // Update user status to isolated
        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: { status: 'isolated' },
        })

        // Update RADIUS: move to isolir group
        // 1. Keep password in radcheck
        await prisma.$executeRaw`
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
          ON DUPLICATE KEY UPDATE value = ${user.password}
        `

        // 2. Move to isolir group (maps to MikroTik profile 'isolir')
        await prisma.$executeRaw`
          DELETE FROM radusergroup WHERE username = ${user.username}
        `
        await prisma.$executeRaw`
          INSERT INTO radusergroup (username, groupname, priority)
          VALUES (${user.username}, 'isolir', 1)
        `

        // 3. Remove static IP so user gets IP from MikroTik pool-isolir
        await prisma.$executeRaw`
          DELETE FROM radreply WHERE username = ${user.username} AND attribute = 'Framed-IP-Address'
        `

        // 4. Send CoA disconnect to force re-authentication
        const coaResult = await disconnectPPPoEUser(user.username)
        console.log(`[Auto Isolir] CoA disconnect for ${user.username}:`, coaResult.success ? 'Success' : 'Failed')

        isolatedCount++
        console.log(`✅ [Auto Isolir] User ${user.username} isolated (expired: ${user.expiredAt?.toISOString().split('T')[0]})`)
      } catch (error: any) {
        errors.push(`${user.username}: ${error.message}`)
        console.error(`❌ [Auto Isolir] Failed to isolate ${user.username}:`, error.message)
      }
    }

    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: errors.length === expiredUsers.length ? 'error' : 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Isolated ${isolatedCount}/${expiredUsers.length} expired users`,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      },
    })

    return {
      success: true,
      isolated: isolatedCount
    }
  } catch (error: any) {
    console.error('[Auto Isolir] Error:', error)

    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    })

    return { success: false, isolated: 0, error: error.message }
  } finally {
    isAutoIsolirRunning = false
  }
}

/**
 * Generate invoices for users expiring in 7 days
 * Direct database call instead of HTTP fetch to avoid network issues
 */
export async function generateInvoices(): Promise<{ success: boolean; generated: number; skipped: number; error?: string }> {
  const startedAt = new Date()

  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'invoice_generate',
      status: 'running',
      startedAt,
    },
  })

  try {
    console.log('[Invoice Generate] Starting invoice generation (cron)...')

    const now = new Date();
    let generated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Include isolated/blocked users because they may need invoice to pay and reactivate
    // EXCLUDE 'stop' status - users who have stopped subscription should NOT get new invoices
    const eligibleStatuses = [
      'active',
      'isolated',
      'blocked',
      'suspended',
      'ACTIVE',
      'ISOLATED',
      'BLOCKED',
      'SUSPENDED',
    ]

    // ========================================
    // PREPAID: Users expiring H-7 to H+30 (invoice generation window)
    // ========================================
    const prepaidStartDate = new Date(now);
    prepaidStartDate.setDate(prepaidStartDate.getDate() + 7); // Start from 7 days ahead
    prepaidStartDate.setHours(0, 0, 0, 0);

    const prepaidEndDate = new Date(now);
    prepaidEndDate.setDate(prepaidEndDate.getDate() + 30); // up to 30 days ahead
    prepaidEndDate.setHours(23, 59, 59, 999);

    const prepaidUsers = await prisma.pppoeUser.findMany({
      where: {
        status: { in: eligibleStatuses },
        subscriptionType: 'PREPAID',
        expiredAt: {
          gte: prepaidStartDate,
          lte: prepaidEndDate,
        },
      },
      include: {
        profile: true,
        area: true,
        router: true,
      },
    });

    console.log(`[Invoice Generate] Found ${prepaidUsers.length} PREPAID users (range: H+7 to H+30)`);

    // ========================================
    // POSTPAID: Users expiring H-7 to H+30 (SAMA seperti PREPAID)
    // ========================================
    // POSTPAID selalu punya expiredAt = billingDay bulan berikutnya
    // Invoice generate H-7 sebelum expiredAt (SAMA dengan PREPAID)
    const postpaidUsers = await prisma.pppoeUser.findMany({
      where: {
        status: { in: eligibleStatuses },
        subscriptionType: 'POSTPAID',
        expiredAt: {
          gte: prepaidStartDate,
          lte: prepaidEndDate,
        },
      },
      include: {
        profile: true,
        area: true,
        router: true,
      },
    });

    console.log(`[Invoice Generate] Found ${postpaidUsers.length} POSTPAID users (range: H+7 to H+30)`);

    const users = [...prepaidUsers, ...postpaidUsers];

    if (users.length === 0) {
      const completedAt = new Date();
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: 'No users need invoice generation today',
        },
      });
      return { success: true, generated: 0, skipped: 0 };
    }

    console.log(`[Invoice Generate] Total ${users.length} users to process`);

    // Get current month/year for invoice numbering
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Get existing invoice count for this month
    let invoiceCount = await prisma.invoice.count({
      where: {
        invoiceNumber: {
          startsWith: `INV-${year}${month}-`,
        },
      },
    });

    // Get company base URL for payment links
    const company = await prisma.company.findFirst();
    const baseUrl = company?.baseUrl || 'http://localhost:3000';

    for (const user of users) {
      try {
        // Check if user already has unpaid invoice (any time)
        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            userId: user.id,
            status: {
              in: ['PENDING', 'OVERDUE'],
            },
          },
        });

        if (existingInvoice) {
          skipped++;
          console.log(`⏭️  Skipped ${user.username} - Already has unpaid invoice (${existingInvoice.invoiceNumber})`);
          continue;
        }

        // Get amount from profile
        if (!user.profile) {
          skipped++;
          console.log(`⏭️  Skipped ${user.username} - No profile assigned`);
          continue;
        }

        const amount = user.profile.price;

        // Calculate due date based on subscription type
        let dueDate: Date;
        let invoiceType: string;

        if (user.subscriptionType === 'PREPAID') {
          // PREPAID: Due date = expiredAt (user must pay before expiry)
          if (!user.expiredAt) {
            skipped++;
            console.log(`⏭️  Skipped ${user.username} - PREPAID user has no expiredAt`);
            continue;
          }
          dueDate = user.expiredAt;
          invoiceType = 'RENEWAL';
        } else {
          // POSTPAID: Due date = expiredAt (billingDay bulan berikutnya)
          // POSTPAID SELALU punya expiredAt (auto-calculated saat create/approve)
          if (!user.expiredAt) {
            skipped++;
            console.log(`⏭️  Skipped ${user.username} - POSTPAID user has no expiredAt`);
            continue;
          }
          dueDate = user.expiredAt;
          invoiceType = 'MONTHLY';
        }

        // Generate invoice number
        invoiceCount++;
        const invoiceNumber = `INV-${year}${month}-${String(invoiceCount).padStart(4, '0')}`;

        // Generate payment token and link
        const paymentToken = randomBytes(32).toString('hex');
        const paymentLink = `${baseUrl}/pay/${paymentToken}`;

        // Determine invoice status based on due date
        const isOverdue = dueDate < now;
        const invoiceStatus = isOverdue ? 'OVERDUE' : 'PENDING';

        // Create invoice with customer snapshot (matching manual API)
        await prisma.invoice.create({
          data: {
            id: crypto.randomUUID(),
            invoiceNumber,
            userId: user.id,
            customerName: user.name,
            customerPhone: user.phone,
            customerEmail: user.email,
            customerUsername: user.username,
            amount,
            baseAmount: amount,
            dueDate: dueDate,
            status: invoiceStatus as any,
            paymentToken,
            paymentLink,
            invoiceType: invoiceType as any,
          },
        });

        generated++;
        const expiredAtStr = user.expiredAt ? new Date(user.expiredAt).toLocaleDateString('id-ID') : 'N/A';
        const statusLabel = isOverdue ? '(OVERDUE)' : '(PENDING)';
        console.log(`✅ Generated invoice ${invoiceNumber} for ${user.username} - Rp ${amount.toLocaleString()} (expires: ${expiredAtStr}) ${statusLabel}`);
      } catch (error: any) {
        errors.push(`${user.username}: ${error.message}`);
        console.error(`❌ Error generating invoice for ${user.username}:`, error);
      }
    }

    // Create notification for generated invoices
    if (generated > 0) {
      try {
        await prisma.notification.create({
          data: {
            type: 'invoice_generated',
            title: 'Invoice Otomatis Dibuat',
            message: `${generated} invoice baru telah dibuat otomatis untuk periode billing`,
            link: '/admin/invoices',
          },
        });
      } catch (notifError) {
        console.error('Invoice generation notification error:', notifError);
      }
    }

    // Update cron history
    const completedAt = new Date();
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: errors.length === users.length ? 'error' : 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Generated ${generated} invoices, skipped ${skipped}${errors.length > 0 ? `, errors: ${errors.length}` : ''}`,
      },
    });

    console.log(`[Invoice Generate] Completed: Generated ${generated}, skipped ${skipped}, errors: ${errors.length}`)

    return {
      success: true,
      generated,
      skipped,
      error: errors.length > 0 ? `${errors.length} errors occurred` : undefined
    };

  } catch (error: any) {
    console.error('Invoice generation error:', error)

    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    })

    return { success: false, generated: 0, skipped: 0, error: error.message }
  }
}

/**
 * Disconnect expired voucher sessions via RADIUS CoA
 * 
 * @deprecated This function is now integrated into syncVoucherFromRadius()
 * to avoid duplicate CoA disconnect attempts.
 * The voucher sync already handles:
 * 1. Detecting expired vouchers
 * 2. Marking as EXPIRED
 * 3. Removing from RADIUS
 * 4. Disconnecting active sessions via CoA
 * 
 * Keeping this function will cause TRIPLE disconnect attempts:
 * - Once from syncVoucherFromRadius (already-expired check at start)
 * - Once from syncVoucherFromRadius (newly-expired processing)
 * - Once from this separate function (disconnectExpiredSessions)
 * 
 * DO NOT USE - disabled to prevent conflicts
 */
export async function disconnectExpiredVoucherSessions(): Promise<{ success: boolean; disconnected: number; error?: string }> {
  console.log('[Disconnect Sessions] SKIPPED - disconnect now handled by syncVoucherFromRadius to avoid duplicates')

  // Return success with 0 disconnected since work is done by syncVoucherFromRadius
  return {
    success: true,
    disconnected: 0,
    error: 'Function deprecated - disconnect handled by voucher sync'
  }
}
