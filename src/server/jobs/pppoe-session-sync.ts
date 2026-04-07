/**
 * PPPoE Session Sync — Keeps radacct in sync with MikroTik active sessions.
 *
 * Runs periodically (e.g. every 5 min) and:
 *  1. Queries every active router via MikroTik API for /ppp/active sessions
 *  2. Compares with radacct (acctstoptime IS NULL)
 *  3. INSERTS missing sessions (Accounting-Start was lost)
 *  4. CLOSES stale radacct entries whose session no longer exists on MikroTik
 *
 * This guarantees the PPPoE Sessions page always reflects reality,
 * even when RADIUS accounting packets are lost (restart, network issue, etc).
 */

import { prisma } from '@/server/db/client';
import { RouterOSAPI } from 'node-routeros';
import { nanoid } from 'nanoid';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Parse MikroTik uptime string (e.g. "1d2h32m4s", "32m4s", "5s") → seconds */
function parseUptime(uptime: string): number {
  let total = 0;
  const weeks = uptime.match(/(\d+)w/);
  const days = uptime.match(/(\d+)d/);
  const hours = uptime.match(/(\d+)h/);
  const mins = uptime.match(/(\d+)m/);
  const secs = uptime.match(/(\d+)s/);
  if (weeks) total += parseInt(weeks[1], 10) * 604800;
  if (days) total += parseInt(days[1], 10) * 86400;
  if (hours) total += parseInt(hours[1], 10) * 3600;
  if (mins) total += parseInt(mins[1], 10) * 60;
  if (secs) total += parseInt(secs[1], 10);
  return total;
}

/** Normalise MikroTik session-id to lowercase hex without 0x prefix */
function normaliseSessionId(sid: string): string {
  return sid.replace(/^0x/i, '').toLowerCase();
}

// ── Types ───────────────────────────────────────────────────────────────────

interface MikroTikSession {
  name: string;           // PPPoE username
  address: string;        // Framed-IP
  'caller-id': string;    // MAC
  'session-id': string;   // Acct-Session-Id
  uptime: string;         // e.g. "32m4s"
  service: string;        // "pppoe"
  radius: string;         // "true" | "false"
}

interface SyncResult {
  success: boolean;
  inserted: number;
  closed: number;
  routers: number;
  routerErrors: number;
  error?: string;
}

// ── Lock ────────────────────────────────────────────────────────────────────

let isSyncRunning = false;

// ── Main sync ───────────────────────────────────────────────────────────────

export async function syncPPPoESessions(): Promise<SyncResult> {
  if (isSyncRunning) {
    return { success: false, inserted: 0, closed: 0, routers: 0, routerErrors: 0, error: 'Already running' };
  }

  isSyncRunning = true;
  const startedAt = Date.now();
  let inserted = 0;
  let closed = 0;
  let routerErrors = 0;

  try {
    // 1. Get all active MikroTik routers (skip gateway/VPS type — not RouterOS devices)
    const routers = await prisma.router.findMany({
      where: { isActive: true, type: { not: 'gateway' } },
      select: {
        id: true,
        name: true,
        nasname: true,
        ipAddress: true,
        username: true,
        password: true,
        port: true,
        apiPort: true,
        vpnClientId: true,
      },
    });

    if (routers.length === 0) {
      console.log('[PPPoE-Sync] No active MikroTik routers');
      return { success: true, inserted: 0, closed: 0, routers: 0, routerErrors: 0 };
    }

    // 2. Get ALL current active radacct sessions (acctstoptime IS NULL)
    const activeAcct = await prisma.radacct.findMany({
      where: { acctstoptime: null },
      select: {
        radacctid: true,
        username: true,
        acctsessionid: true,
        nasipaddress: true,
        framedipaddress: true,
      },
    });

    // Map: nasip → Set<normalised session-id>
    const acctByNas = new Map<string, Map<string, typeof activeAcct[0]>>();
    for (const a of activeAcct) {
      if (!acctByNas.has(a.nasipaddress)) acctByNas.set(a.nasipaddress, new Map());
      acctByNas.get(a.nasipaddress)!.set(normaliseSessionId(a.acctsessionid), a);
    }

    // Collect all live MikroTik sessions keyed by NAS IP
    const liveByNas = new Map<string, Set<string>>();

    for (const router of routers) {
      const nasIp = router.nasname;
      const host = router.ipAddress || router.nasname;
      const primaryPort = router.port || 8728;
      const fallbackPort = router.apiPort || 8729;

      let mikrotikSessions: MikroTikSession[] = [];

      // Try connecting to MikroTik API
      const tryConnect = async (port: number): Promise<MikroTikSession[]> => {
        const api = new RouterOSAPI({ host, port, user: router.username, password: router.password, timeout: 3 });
        try {
          await api.connect();
          const results = await api.write('/ppp/active/print') as MikroTikSession[];
          await api.close();
          return results;
        } catch (e: any) {
          try { await api.close(); } catch {}
          throw e;
        }
      };

      try {
        mikrotikSessions = await tryConnect(primaryPort);
      } catch {
        try {
          mikrotikSessions = await tryConnect(fallbackPort);
        } catch (err: any) {
          console.error(`[PPPoE-Sync] Cannot reach ${router.name} (${host}): ${err.message}`);
          routerErrors++;
          continue; // Skip unreachable router — don't close its sessions
        }
      }

      // Filter PPPoE-only, RADIUS-authenticated sessions
      const pppoeSessions = mikrotikSessions.filter(
        (s) => s.service === 'pppoe' && s.radius === 'true',
      );

      // Record live session IDs for this NAS
      const liveSids = new Set<string>();
      for (const s of pppoeSessions) {
        liveSids.add(normaliseSessionId(s['session-id']));
      }
      liveByNas.set(nasIp, liveSids);

      // 3. Find sessions on MikroTik but MISSING from radacct → INSERT
      const acctForNas = acctByNas.get(nasIp) || new Map();

      for (const session of pppoeSessions) {
        const sid = normaliseSessionId(session['session-id']);

        // Also check by username (in case session-id changed between reconnects)
        const existsBySessionId = acctForNas.has(sid);
        const existsByUsername = Array.from(acctForNas.values()).some(
          (a) => a.username === session.name,
        );

        if (existsBySessionId || existsByUsername) continue;

        // Missing — create radacct entry
        const uptimeSec = parseUptime(session.uptime);

        try {
          // Use MySQL DATE_SUB(NOW(), INTERVAL ...) to avoid Node.js ↔ MySQL
          // timezone mismatch. This ensures acctstarttime is always in the
          // same timezone as the MySQL server (WIB +07:00).
          await prisma.$executeRawUnsafe(
            `INSERT INTO radacct
              (acctsessionid, acctuniqueid, username, nasipaddress, nasportid,
               nasporttype, acctstarttime, acctupdatetime, acctstoptime,
               acctsessiontime, acctauthentic, acctinputoctets, acctoutputoctets,
               calledstationid, callingstationid, acctterminatecause,
               servicetype, framedprotocol, framedipaddress)
             VALUES (?, ?, ?, ?, '', 'Virtual',
                     DATE_SUB(NOW(), INTERVAL ? SECOND), NOW(), NULL,
                     ?, 'RADIUS', 0, 0,
                     'pppoe-server', ?, '',
                     'Framed-User', 'PPP', ?)`,
            sid,
            nanoid(32), // unique acctuniqueid
            session.name,
            nasIp,
            uptimeSec,   // acctstarttime = NOW() - uptime
            uptimeSec,   // acctsessiontime
            session['caller-id'] || '',
            session.address || '',
          );
          inserted++;
          console.log(
            `[PPPoE-Sync] ✅ Inserted missing session: ${session.name} (${session.address}) on ${router.name} — uptime ${session.uptime}`,
          );
        } catch (err: any) {
          console.error(`[PPPoE-Sync] Failed to insert session for ${session.name}: ${err.message}`);
        }
      }
    }

    // 4. Close radacct entries that no longer exist on any MikroTik
    for (const acct of activeAcct) {
      const liveSids = liveByNas.get(acct.nasipaddress);
      if (!liveSids) continue; // Router unreachable — don't close its sessions

      const sid = normaliseSessionId(acct.acctsessionid);
      // Also check by username in live sessions
      const liveOnRouter = liveSids.has(sid);

      if (!liveOnRouter) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE radacct
             SET acctstoptime = NOW(),
                 acctterminatecause = 'Lost-Carrier',
                 acctsessiontime = TIMESTAMPDIFF(SECOND, acctstarttime, NOW())
             WHERE radacctid = ?`,
            acct.radacctid,
          );
          closed++;
          console.log(
            `[PPPoE-Sync] 🔴 Closed stale session: ${acct.username} (radacctid=${acct.radacctid}) — not found on MikroTik`,
          );
        } catch (err: any) {
          console.error(`[PPPoE-Sync] Failed to close session ${acct.radacctid}: ${err.message}`);
        }
      }
    }

    // 5. Log to cronHistory
    const duration = Date.now() - startedAt;
    const message = `Synced ${routers.length} router(s): +${inserted} inserted, -${closed} closed${routerErrors > 0 ? `, ${routerErrors} error(s)` : ''}`;

    await prisma.cronHistory.create({
      data: {
        id: nanoid(),
        jobType: 'pppoe_session_sync',
        status: 'success',
        startedAt: new Date(startedAt),
        completedAt: new Date(),
        duration,
        result: message,
      },
    });

    if (inserted > 0 || closed > 0) {
      console.log(`[PPPoE-Sync] ✅ ${message}`);
    }

    return { success: true, inserted, closed, routers: routers.length, routerErrors };
  } catch (error: any) {
    console.error('[PPPoE-Sync] ❌ Error:', error.message);

    await prisma.cronHistory.create({
      data: {
        id: nanoid(),
        jobType: 'pppoe_session_sync',
        status: 'error',
        startedAt: new Date(startedAt),
        completedAt: new Date(),
        duration: Date.now() - startedAt,
        error: error.message,
      },
    }).catch(() => {});

    return { success: false, inserted, closed, routers: 0, routerErrors, error: error.message };
  } finally {
    isSyncRunning = false;
  }
}
