import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { prisma } from '@/lib/prisma'

const execAsync = promisify(exec)

/**
 * Mark session as stopped in radacct database
 * This is the primary disconnect method - ensures UI reflects session end
 */
async function markSessionStopped(sessionId: string, username: string, terminateCause: string = 'Admin-Reset'): Promise<boolean> {
  try {
    const session = await prisma.radacct.findFirst({
      where: { acctsessionid: sessionId, acctstoptime: null }
    })
    
    if (!session || !session.acctstarttime) {
      console.log(`[CoA] No active session found for ${username} (${sessionId})`)
      return false
    }
    
    const startTime = session.acctstarttime instanceof Date ? session.acctstarttime : new Date(session.acctstarttime)
    const sessionDuration = Math.floor((Date.now() - startTime.getTime()) / 1000)
    
    await prisma.radacct.update({
      where: { radacctid: session.radacctid },
      data: {
        acctstoptime: new Date(),
        acctterminatecause: terminateCause,
        acctsessiontime: sessionDuration
      }
    })
    
    console.log(`[CoA] ✓ Session ${username} marked as stopped in database (${sessionDuration}s)`)
    return true
  } catch (dbError: any) {
    console.error(`[CoA] Database update error for ${username}:`, dbError.message)
    return false
  }
}

/**
 * Send CoA Disconnect to NAS to force logout a user
 * Requires radclient to be installed: apt-get install freeradius-utils
 * 
 * Priority approach:
 * 1. ALWAYS mark session in database FIRST (guaranteed to work)
 * 2. Try CoA Disconnect (bonus if Mikrotik responds)
 * 3. Session Timeout in radgroupreply (backup protection)
 */
export async function sendCoADisconnect(
  username: string, 
  nasIpAddress: string, 
  nasSecret: string,
  sessionId?: string,
  framedIp?: string
) {
  let dbSuccess = false
  let coaSuccess = false
  
  // STEP 1: ALWAYS mark session in database FIRST
  // This ensures UI shows session as terminated regardless of CoA result
  if (sessionId) {
    dbSuccess = await markSessionStopped(sessionId, username, 'Admin-Reset')
  }
  
  // STEP 2: Try CoA Disconnect (optional - if Mikrotik is configured correctly)
  try {
    // Create CoA disconnect packet attributes for MikroTik
    // MikroTik requires specific attributes to match the session
    let coaAttributes = []
    
    // REQUIRED: NAS-IP-Address - identifies which NAS to disconnect from
    coaAttributes.push(`NAS-IP-Address=${nasIpAddress}`)
    
    // PRIMARY identifier: Framed-IP-Address (most reliable for MikroTik)
    if (framedIp) {
      coaAttributes.push(`Framed-IP-Address=${framedIp}`)
    }
    
    // SECONDARY identifier: User-Name
    coaAttributes.push(`User-Name=${username}`)
    
    // TERTIARY identifier: Acct-Session-Id
    if (sessionId) {
      coaAttributes.push(`Acct-Session-Id=${sessionId}`)
    }
    
    // OPTIONAL: Calling-Station-Id (MAC address) - helps some Mikrotik versions
    // Try to get MAC address from active session
    if (sessionId) {
      try {
        const session = await prisma.radacct.findFirst({
          where: { acctsessionid: sessionId },
          select: { callingstationid: true }
        })
        
        if (session?.callingstationid) {
          coaAttributes.push(`Calling-Station-Id=${session.callingstationid}`)
        }
      } catch (e) {
        // MAC not critical, continue without it
      }
    }
    
    // Create temp file with attributes (avoids shell quoting issues)
    const tmpFile = `/tmp/coa-${Date.now()}.txt`
    const coaPacket = coaAttributes.join('\n') + '\n'
    
    try {
      await writeFile(tmpFile, coaPacket)
    } catch (fsError: any) {
      console.error(`[CoA] Failed to write temp file:`, fsError.message)
      // Return success if DB update worked
      return { 
        success: dbSuccess, 
        message: dbSuccess ? 'Session marked in database' : 'Failed',
        error: `Filesystem error: ${fsError.message}` 
      }
    }
    
    // Send CoA Disconnect-Request using radclient
    // Port 3799 is CoA/DM port (RFC 5176)
    // -t 2 = timeout 2 seconds, -r 1 = retry 1 time (faster, we have DB fallback)
    const command = `radclient -t 2 -r 1 -x ${nasIpAddress}:3799 disconnect ${nasSecret} < ${tmpFile} 2>&1`
    
    console.log(`[CoA] Sending to ${nasIpAddress}:3799...`)
    
    const { stdout, stderr } = await execAsync(command, { timeout: 8000 })
    
    // Cleanup temp file
    try { 
      await unlink(tmpFile) 
    } catch (e) {
      // Ignore cleanup errors
    }
    
    // Check if response indicates success
    // MikroTik sends "Received Disconnect-ACK" or "Received response ID"
    coaSuccess = stdout.includes('Disconnect-ACK') || 
                 stdout.includes('Received') || 
                 stdout.includes('Ack') ||
                 stdout.includes('code 40') || // CoA-ACK code
                 stdout.includes('code 44')    // Disconnect-ACK code
    
    if (coaSuccess) {
      console.log(`[CoA] ✓ Mikrotik ACK received for ${username}`)
    } else {
      console.log(`[CoA] ⚠ No ACK from Mikrotik (session already marked in DB)`)
    }
    
    // Return success if EITHER DB or CoA worked
    return { 
      success: dbSuccess || coaSuccess, 
      message: coaSuccess 
        ? `Mikrotik disconnected ${username}` 
        : dbSuccess 
          ? `Session marked in database (Mikrotik will timeout)` 
          : 'Failed',
      coaSuccess,
      dbSuccess
    }
  } catch (error: any) {
    console.error(`[CoA] Error sending CoA for ${username}:`, error.message)
    
    // Return success if DB update worked (which we did first)
    return { 
      success: dbSuccess, 
      message: dbSuccess ? 'Session marked in database (CoA failed)' : 'Failed',
      error: error.message,
      dbSuccess
    }
  }
}

/**
 * Disconnect all expired sessions
 * This should run periodically (every minute via cron)
 */
export async function disconnectExpiredSessions() {
  try {
    console.log('[CoA] Checking for expired active sessions...')
    
    // Get all active sessions from radacct where user has no stop time
    const activeSessions = await prisma.radacct.findMany({
      where: {
        acctstoptime: null,
      },
      select: {
        username: true,
        nasipaddress: true,
        acctsessionid: true,
        framedipaddress: true,
      },
    })
    
    if (activeSessions.length === 0) {
      return { disconnected: 0 }
    }
    
    let disconnectedCount = 0
    const now = new Date()
    
    for (const session of activeSessions) {
      try {
        // Check if voucher exists and is expired (by status OR by expiresAt)
        const voucher = await prisma.hotspotVoucher.findUnique({
          where: { code: session.username },
        })
        
        // Skip if not a voucher user (might be PPPoE)
        if (!voucher) {
          continue
        }
        
        // Check if voucher is expired: either status is EXPIRED or expiresAt has passed
        const isExpired = voucher.status === 'EXPIRED' || 
          (voucher.expiresAt && new Date(voucher.expiresAt) < now)
        
        if (!isExpired) {
          continue // Not expired, skip
        }
        
        console.log(`[CoA] Voucher ${session.username} is expired (status: ${voucher.status}, expiresAt: ${voucher.expiresAt})`)
        
        // Get NAS - try exact match first, then any NAS with matching secret
        let nas = await prisma.router.findFirst({
          where: { nasname: session.nasipaddress },
        })
        
        // If not found by nasipaddress, try to find by looking up radacct's calledstationid
        // or use the first available NAS (for cases where MikroTik sends local IP)
        if (!nas) {
          // Try to find any active NAS router
          nas = await prisma.router.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
          })
          
          if (!nas) {
            console.log(`[CoA] No NAS found for ${session.nasipaddress}`)
            continue
          }
          console.log(`[CoA] Using NAS ${nas.nasname} for session from ${session.nasipaddress}`)
        }
        
        // Determine target IP for CoA - use ipAddress (public IP) if different from nasname
        // This handles cases where radacct has local IP but we need to send CoA to public IP
        const coaTargetIp = nas.ipAddress && nas.ipAddress !== nas.nasname 
          ? nas.ipAddress 
          : nas.nasname
        
        // Send CoA Disconnect with session ID and IP
        const result = await sendCoADisconnect(
          session.username, 
          coaTargetIp, 
          nas.secret,
          session.acctsessionid,
          session.framedipaddress
        )
        
        if (result.success) {
          disconnectedCount++
          console.log(`[CoA] Disconnected expired session: ${session.username}`)
          
          // Also update voucher status to EXPIRED if not already
          if (voucher.status !== 'EXPIRED') {
            await prisma.hotspotVoucher.update({
              where: { id: voucher.id },
              data: { status: 'EXPIRED' },
            })
            console.log(`[CoA] Updated voucher ${session.username} status to EXPIRED`)
          }
        }
      } catch (err: any) {
        console.error(`[CoA] Error processing session ${session.username}:`, err.message)
      }
    }
    
    console.log(`[CoA] Disconnected ${disconnectedCount} expired sessions`)
    
    return { disconnected: disconnectedCount }
  } catch (err) {
    console.error('[CoA] Disconnect error:', err)
    throw err
  }
}

/**
 * Disconnect PPPoE user session by username
 * Finds active session from radacct and sends CoA disconnect
 */
export async function disconnectPPPoEUser(username: string) {
  try {
    console.log(`[CoA] Disconnecting PPPoE user: ${username}`)
    
    // Find active session for this user
    const activeSession = await prisma.radacct.findFirst({
      where: {
        username: username,
        acctstoptime: null, // Still active
      },
      orderBy: {
        acctstarttime: 'desc', // Get most recent session
      },
    })
    
    if (!activeSession) {
      console.log(`[CoA] No active session found for ${username}`)
      return { success: true, message: 'No active session' }
    }
    
    // Get NAS configuration - try exact match first
    let nas = await prisma.router.findFirst({
      where: { 
        nasname: activeSession.nasipaddress 
      },
    })
    
    // If not found, try first active NAS
    if (!nas) {
      nas = await prisma.router.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      })
    }
    
    if (!nas) {
      console.log(`[CoA] NAS not found for ${activeSession.nasipaddress}`)
      return { success: false, error: 'NAS not configured' }
    }
    
    // Determine target IP for CoA
    const coaTargetIp = nas.ipAddress && nas.ipAddress !== nas.nasname 
      ? nas.ipAddress 
      : nas.nasname
    
    // Send CoA disconnect
    const result = await sendCoADisconnect(
      activeSession.username,
      coaTargetIp,
      nas.secret,
      activeSession.acctsessionid,
      activeSession.framedipaddress
    )
    
    if (result.success) {
      console.log(`[CoA] Successfully disconnected ${username}`)
    }
    
    return result
  } catch (error: any) {
    console.error(`[CoA] Error disconnecting PPPoE user ${username}:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Disconnect multiple PPPoE users
 */
export async function disconnectMultiplePPPoEUsers(usernames: string[]) {
  const results = await Promise.allSettled(
    usernames.map(username => disconnectPPPoEUser(username))
  )
  
  const disconnected = results.filter(r => r.status === 'fulfilled').length
  
  return {
    total: usernames.length,
    disconnected,
    failed: usernames.length - disconnected,
  }
}

export default {
  sendCoADisconnect,
  disconnectExpiredSessions,
  disconnectPPPoEUser,
  disconnectMultiplePPPoEUsers,
}
