import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { sendCoADisconnect } from '@/lib/services/coaService'

let isHotspotSyncRunning = false

/**
 * Hotspot Voucher Sync with RADIUS
 * 
 * This cron job:
 * 1. Scans radacct for new sessions from WAITING vouchers
 * 2. Updates usedAt and expiredAt based on first login (WAITING → USED)
 * 3. Checks for expired vouchers and updates status to EXPIRED
 * 4. Cleans up EXPIRED vouchers from FreeRADIUS tables
 * 
 * Runs every minute
 */
export async function syncHotspotWithRadius(): Promise<{
  success: boolean
  activated: number
  expired: number
  message?: string
  error?: string
}> {
  // Prevent concurrent execution
  if (isHotspotSyncRunning) {
    console.log('[Hotspot Sync] Already running, skipping...')
    return { success: false, activated: 0, expired: 0, error: 'Already running' }
  }

  isHotspotSyncRunning = true
  const startedAt = new Date()
  
  // Create history record
  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'hotspot_sync',
      status: 'running',
      startedAt,
    },
  })

  try {
    console.log('[Hotspot Sync] Starting hotspot voucher sync...')

    // ========================================
    // PART 1: Check for first login (WAITING → ACTIVE)
    // ========================================
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

    console.log(`[Hotspot Sync] Found ${waitingVouchers.length} WAITING vouchers to check`)

    let activatedCount = 0

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
        const firstLoginAt =
          activeSession.acctstarttime instanceof Date
            ? activeSession.acctstarttime
            : new Date(activeSession.acctstarttime)

        let expiresAtMs = firstLoginAt.getTime()

        // Add validity time based on profile
        if (voucher.profile.validityUnit === 'MINUTES') {
          expiresAtMs += voucher.profile.validityValue * 60 * 1000
        } else if (voucher.profile.validityUnit === 'HOURS') {
          expiresAtMs += voucher.profile.validityValue * 60 * 60 * 1000
        } else if (voucher.profile.validityUnit === 'DAYS') {
          expiresAtMs += voucher.profile.validityValue * 24 * 60 * 60 * 1000
        } else if (voucher.profile.validityUnit === 'MONTHS') {
          const expiresAt = new Date(firstLoginAt)
          expiresAt.setMonth(expiresAt.getMonth() + voucher.profile.validityValue)
          expiresAtMs = expiresAt.getTime()
        }

        const expiresAt = new Date(expiresAtMs)

        // Update voucher to ACTIVE
        const updatedVoucher = await prisma.hotspotVoucher.update({
          where: { id: voucher.id },
          data: {
            status: 'ACTIVE',
            firstLoginAt: firstLoginAt,
            expiresAt: expiresAt,
          },
        })

        // Send notification to agent if voucher belongs to agent
        if (updatedVoucher.agentId) {
          try {
            await prisma.agentNotification.create({
              data: {
                id: Math.random().toString(36).substring(2, 15),
                agentId: updatedVoucher.agentId,
                type: 'voucher_activated',
                title: 'Voucher Digunakan',
                message: `Voucher ${voucher.code} (${voucher.profile.name}) telah digunakan oleh pelanggan. Masa aktif hingga ${expiresAt.toLocaleDateString('id-ID', { dateStyle: 'medium' })}.`,
                link: null,
              },
            })
          } catch (notifError) {
            console.error(`⚠️ Failed to create notification for agent:`, notifError)
          }
        }

        activatedCount++
        console.log(
          `✅ [Hotspot Sync] ${voucher.code} activated (first login: ${firstLoginAt.toISOString()}, expires: ${expiresAt.toISOString()})`
        )
      }
    }

    // ========================================
    // PART 2: Check for expired vouchers (ACTIVE → EXPIRED)
    // ========================================
    // Get current time from database server to match timezone
    const dbTime = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`
    const nowServer = dbTime[0].now
    
    console.log(`[Hotspot Sync] Server time: ${nowServer.toISOString()}`)
    
    const expiredVouchers = await prisma.hotspotVoucher.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          lte: nowServer,
        },
      },
      select: {
        id: true,
        code: true,
        expiresAt: true,
      },
    })

    console.log(`[Hotspot Sync] Found ${expiredVouchers.length} expired vouchers to process`)

    let expiredCount = 0

    for (const voucher of expiredVouchers) {
      try {
        // Update voucher status to EXPIRED
        const updatedVoucher = await prisma.hotspotVoucher.update({
          where: { id: voucher.id },
          data: {
            status: 'EXPIRED',
          },
          include: {
            profile: { select: { name: true } },
          },
        })

        // Send notification to agent if voucher belongs to agent
        if (updatedVoucher.agentId) {
          try {
            await prisma.agentNotification.create({
              data: {
                id: Math.random().toString(36).substring(2, 15),
                agentId: updatedVoucher.agentId,
                type: 'voucher_expired',
                title: 'Voucher Kadaluarsa',
                message: `Voucher ${voucher.code} (${updatedVoucher.profile.name}) telah melewati masa aktif dan otomatis diputus.`,
                link: null,
              },
            })
          } catch (notifError) {
            console.error(`⚠️ Failed to create notification for agent:`, notifError)
          }
        }

        // Disconnect active session if exists
        try {
          const activeSession = await prisma.radacct.findFirst({
            where: {
              username: voucher.code,
              acctstoptime: null, // Still active
            },
            select: {
              nasipaddress: true,
              acctsessionid: true,
              framedipaddress: true,
            },
          })

          if (activeSession) {
            // Get NAS configuration
            let nas = await prisma.router.findFirst({
              where: { nasname: activeSession.nasipaddress },
            })

            // Fallback to first active NAS if exact match not found
            if (!nas) {
              nas = await prisma.router.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
              })
            }

            if (nas) {
              const coaTargetIp = nas.ipAddress && nas.ipAddress !== nas.nasname 
                ? nas.ipAddress 
                : nas.nasname

              const coaResult = await sendCoADisconnect(
                voucher.code,
                coaTargetIp,
                nas.secret,
                activeSession.acctsessionid,
                activeSession.framedipaddress
              )

              if (coaResult.success) {
                console.log(`🔌 [Hotspot Sync] Disconnected expired session: ${voucher.code}`)
              } else {
                console.log(`⚠️ [Hotspot Sync] Failed to disconnect ${voucher.code}: ${coaResult.error || 'Unknown error'}`)
              }
            } else {
              console.log(`⚠️ [Hotspot Sync] No NAS found to disconnect ${voucher.code}`)
            }
          }
        } catch (coaError: any) {
          console.error(`⚠️ [Hotspot Sync] CoA error for ${voucher.code}:`, coaError.message)
        }

        // Cleanup from FreeRADIUS tables
        // For expired vouchers, we need to:
        // 1. Set password to EXPIRED in radcheck (prevents login)
        // 2. Add Reply-Message to radreply (shows custom message in MikroTik log)
        // 3. Remove from radusergroup (removes bandwidth limits)
        try {
          const userGroup = await prisma.radusergroup.findFirst({
            where: { username: voucher.code },
            select: { groupname: true },
          })

          // Update password to EXPIRED (invalid) instead of deleting
          await prisma.radcheck.updateMany({
            where: { 
              username: voucher.code,
              attribute: 'Cleartext-Password'
            },
            data: {
              value: 'EXPIRED',
            },
          })

          // Add Reply-Message to radreply table (this is sent in Access-Reject)
          // MikroTik hotspot will display this message in logs
          const existingReply = await prisma.radreply.findFirst({
            where: {
              username: voucher.code,
              attribute: 'Reply-Message'
            }
          })

          if (!existingReply) {
            await prisma.radreply.create({
              data: {
                username: voucher.code,
                attribute: 'Reply-Message',
                op: '=',
                value: 'Kode Voucher Kadaluarsa',
              },
            })
          } else {
            await prisma.radreply.update({
              where: { id: existingReply.id },
              data: { value: 'Kode Voucher Kadaluarsa' }
            })
          }

          // Remove from group (removes bandwidth limits)
          await prisma.radusergroup.deleteMany({
            where: { username: voucher.code },
          })

          // Remove group reply attributes
          if (userGroup?.groupname) {
            await prisma.radgroupreply.deleteMany({
              where: { groupname: userGroup.groupname },
            })
          }

          console.log(`🧹 [Hotspot Sync] ${voucher.code} marked as EXPIRED with Reply-Message in radreply`)
        } catch (cleanupError: any) {
          console.error(`⚠️ [Hotspot Sync] Failed to cleanup ${voucher.code}:`, cleanupError.message)
        }

        expiredCount++
        console.log(`✅ [Hotspot Sync] ${voucher.code} marked as EXPIRED`)
      } catch (error: any) {
        console.error(`❌ [Hotspot Sync] Failed to expire ${voucher.code}:`, error.message)
      }
    }

    // ========================================
    // Complete
    // ========================================
    const duration = new Date().getTime() - startedAt.getTime()
    const message = `Activated: ${activatedCount}, Expired: ${expiredCount}`
    
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        result: message,
        duration,
        completedAt: new Date(),
      },
    })

    console.log(`[Hotspot Sync] ✅ Completed in ${duration}ms: ${message}`)

    return {
      success: true,
      activated: activatedCount,
      expired: expiredCount,
      message,
    }
  } catch (error: any) {
    console.error('[Hotspot Sync] ❌ Error:', error)

    const duration = new Date().getTime() - startedAt.getTime()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'failed',
        result: `Error: ${error.message}`,
        duration,
        completedAt: new Date(),
      },
    })

    return {
      success: false,
      activated: 0,
      expired: 0,
      error: error.message,
    }
  } finally {
    isHotspotSyncRunning = false
  }
}
