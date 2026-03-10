/**
 * Online Users Tracker — Salfanet Radius
 *
 * Menggunakan Redis Set untuk tracking pelanggan yang sedang online.
 * Jauh lebih cepat dari query radacct + join pppoeUser tiap request.
 *
 * Cara kerja:
 * - FreeRADIUS Accounting-Start → markUserOnline()
 * - FreeRADIUS Accounting-Stop  → markUserOffline()
 * - Dashboard / widget          → getOnlineCount() atau getOnlineUsers()
 *
 * Fallback:
 * Jika Redis tidak tersedia, semua fungsi fallback ke query MySQL via Prisma.
 * Data di Redis otomatis expire setelah 2 jam (safety net jika Accounting-Stop tidak terkirim)
 */

import { prisma } from '@/server/db/client';
import {
  redisSAdd,
  redisSRem,
  redisSMembers,
  redisSCard,
  redisHSet,
  redisHGetAll,
  redisDel,
  isRedisAvailable,
  RedisKeys,
  getRedisClient,
} from '@/server/cache/redis';

const ONLINE_USER_TTL = 7200; // 2 jam safety TTL per user detail
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // Sync ulang dari DB tiap 5 menit

export interface OnlineUserDetail {
  username: string;
  nasIp: string;
  framedIp: string;
  sessionId: string;
  startTime: string;
  type: 'pppoe' | 'hotspot' | 'unknown';
}

// ==================== MARK ONLINE ====================

/**
 * Tandai user sebagai online.
 * Dipanggil dari RADIUS Accounting (Acct-Status-Type = Start)
 */
export async function markUserOnline(detail: OnlineUserDetail): Promise<void> {
  const key = RedisKeys.onlineUsers();
  const detailKey = RedisKeys.onlineUserDetail(detail.username);

  // Update Redis (non-blocking)
  await Promise.allSettled([
    redisSAdd(key, detail.username),
    redisHSet(detailKey, {
      nasIp: detail.nasIp ?? '',
      framedIp: detail.framedIp ?? '',
      sessionId: detail.sessionId ?? '',
      startTime: detail.startTime ?? new Date().toISOString(),
      type: detail.type ?? 'unknown',
    }),
    // Beri TTL pada key detail (safety net)
    (async () => {
      const client = getRedisClient();
      if (client && isRedisAvailable()) {
        await client.expire(detailKey, ONLINE_USER_TTL);
      }
    })(),
  ]);
}

// ==================== MARK OFFLINE ====================

/**
 * Tandai user sebagai offline.
 * Dipanggil dari RADIUS Accounting (Acct-Status-Type = Stop)
 */
export async function markUserOffline(username: string): Promise<void> {
  await Promise.allSettled([
    redisSRem(RedisKeys.onlineUsers(), username),
    redisDel(RedisKeys.onlineUserDetail(username)),
  ]);
}

// ==================== GET COUNT ====================

/**
 * Jumlah user online saat ini.
 * Returns -1 jika Redis tidak tersedia (UI bisa fallback ke query DB).
 */
export async function getOnlineCount(): Promise<number> {
  const count = await redisSCard(RedisKeys.onlineUsers());
  if (count >= 0) return count; // Redis tersedia

  // Redis tidak tersedia — fallback ke MySQL
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    return await prisma.radacct.count({
      where: {
        acctstoptime: null,
        acctupdatetime: { gte: tenMinutesAgo },
      },
    });
  } catch {
    return 0;
  }
}

// ==================== GET ONLINE USERS ====================

/**
 * Daftar username yang sedang online.
 */
export async function getOnlineUsernames(): Promise<string[]> {
  if (isRedisAvailable()) {
    return redisSMembers(RedisKeys.onlineUsers());
  }

  // Fallback ke DB
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const sessions = await prisma.radacct.findMany({
      where: {
        acctstoptime: null,
        acctupdatetime: { gte: tenMinutesAgo },
      },
      select: { username: true },
      distinct: ['username'],
    });
    return sessions.map(s => s.username).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

/**
 * Detail user online tertentu.
 */
export async function getOnlineUserDetail(username: string): Promise<OnlineUserDetail | null> {
  const data = await redisHGetAll(RedisKeys.onlineUserDetail(username));
  if (!data) return null;
  return {
    username,
    nasIp: data.nasIp ?? '',
    framedIp: data.framedIp ?? '',
    sessionId: data.sessionId ?? '',
    startTime: data.startTime ?? '',
    type: (data.type as OnlineUserDetail['type']) ?? 'unknown',
  };
}

// ==================== IS USER ONLINE ====================

/**
 * Cek apakah username tertentu sedang online.
 */
export async function isUserOnline(username: string): Promise<boolean> {
  if (isRedisAvailable()) {
    const client = getRedisClient();
    if (client) {
      try {
        return (await client.sismember(RedisKeys.onlineUsers(), username)) === 1;
      } catch {
        // fallback
      }
    }
  }

  // Fallback ke DB
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const session = await prisma.radacct.findFirst({
      where: {
        username,
        acctstoptime: null,
        acctupdatetime: { gte: tenMinutesAgo },
      },
      select: { radacctid: true },
    });
    return session !== null;
  } catch {
    return false;
  }
}

// ==================== SYNC FROM DB ====================

/**
 * Sync state Redis dari data radacct yang masih aktif di MySQL.
 * Berguna saat:
 * - Redis restart (data hilang)
 * - Pertama kali setup
 *
 * Dipanggil oleh cron setiap beberapa menit.
 */
export async function syncOnlineUsersFromDB(): Promise<{ synced: number; removed: number }> {
  if (!isRedisAvailable()) return { synced: 0, removed: 0 };

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Ambil semua sesi aktif dari DB
    const activeSessions = await prisma.radacct.findMany({
      where: {
        acctstoptime: null,
        OR: [
          { acctupdatetime: { gte: tenMinutesAgo } },
          { AND: [{ acctupdatetime: null }, { acctstarttime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }] },
        ],
      },
      select: {
        username: true,
        nasipaddress: true,
        framedipaddress: true,
        acctsessionid: true,
        acctstarttime: true,
      },
    });

    const activeUsernames = new Set(
      activeSessions.map(s => s.username).filter(Boolean) as string[]
    );

    // Tambahkan yang aktif ke Redis Set
    let synced = 0;
    for (const session of activeSessions) {
      if (!session.username) continue;
      await markUserOnline({
        username: session.username,
        nasIp: session.nasipaddress ?? '',
        framedIp: session.framedipaddress ?? '',
        sessionId: session.acctsessionid ?? '',
        startTime: session.acctstarttime?.toISOString() ?? new Date().toISOString(),
        type: 'unknown', // akan di-resolve jika perlu
      });
      synced++;
    }

    // Hapus yang sudah tidak aktif dari Redis
    const currentOnline = await redisSMembers(RedisKeys.onlineUsers());
    let removed = 0;
    for (const username of currentOnline) {
      if (!activeUsernames.has(username)) {
        await markUserOffline(username);
        removed++;
      }
    }

    return { synced, removed };
  } catch (err) {
    console.error('[OnlineUsers] Sync error:', err);
    return { synced: 0, removed: 0 };
  }
}
