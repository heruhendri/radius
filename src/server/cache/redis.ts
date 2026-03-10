/**
 * Redis Client — Salfanet Radius
 *
 * Singleton ioredis client dengan graceful fallback.
 * Semua fitur Redis bersifat OPSIONAL — jika Redis tidak tersedia,
 * aplikasi tetap berjalan normal menggunakan fallback in-memory / MySQL.
 *
 * Setup:
 *  - Tambahkan REDIS_URL di .env: redis://localhost:6379
 *  - Install Redis di VPS: apt-get install -y redis-server
 *  - Redis berjalan otomatis, tidak butuh konfigurasi tambahan
 */

import Redis from 'ioredis';

// ==================== SINGLETON ====================

let redisClient: Redis | null = null;
let redisAvailable = false;
let lastConnectionAttempt = 0;
const RECONNECT_INTERVAL = 30_000; // coba reconnect tiap 30 detik

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      commandTimeout: 2000,
      lazyConnect: true,
      retryStrategy: (times) => {
        // Berhenti retry setelah 3x, coba lagi setelah RECONNECT_INTERVAL
        if (times >= 3) return null;
        return Math.min(times * 500, 2000);
      },
    });

    client.on('connect', () => {
      redisAvailable = true;
      console.log('[Redis] Connected to', url.replace(/:\/\/.*@/, '://***@'));
    });

    client.on('ready', () => {
      redisAvailable = true;
    });

    client.on('error', (err) => {
      if (redisAvailable) {
        console.warn('[Redis] Connection error — falling back to non-Redis mode:', err.message);
      }
      redisAvailable = false;
    });

    client.on('close', () => {
      redisAvailable = false;
    });

    return client;
  } catch (err) {
    console.warn('[Redis] Failed to initialize client:', err);
    return null;
  }
}

export function getRedisClient(): Redis | null {
  // Jika REDIS_URL tidak dikonfigurasi, skip
  if (!process.env.REDIS_URL) return null;

  // Jika client belum ada, buat baru
  if (!redisClient) {
    redisClient = createRedisClient();
    if (redisClient) {
      // connect non-blocking
      redisClient.connect().catch(() => {
        redisAvailable = false;
      });
    }
    return redisClient;
  }

  // Jika client ada tapi disconnected, coba reconnect periodik
  if (!redisAvailable) {
    const now = Date.now();
    if (now - lastConnectionAttempt > RECONNECT_INTERVAL) {
      lastConnectionAttempt = now;
      redisClient.connect().catch(() => {});
    }
  }

  return redisClient;
}

export function isRedisAvailable(): boolean {
  return redisAvailable && redisClient !== null;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * GET dengan fallback — tidak throw jika Redis mati
 */
export async function redisGet(key: string): Promise<string | null> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return null;
  try {
    return await client.get(key);
  } catch {
    redisAvailable = false;
    return null;
  }
}

/**
 * SET dengan TTL (detik) — tidak throw jika Redis mati
 */
export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return false;
  try {
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, value);
    } else {
      await client.set(key, value);
    }
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
}

/**
 * DEL satu atau lebih key
 */
export async function redisDel(...keys: string[]): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return false;
  try {
    await client.del(...keys);
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
}

/**
 * INCR dengan TTL — untuk rate limiting
 */
export async function redisIncr(key: string, ttlSeconds: number): Promise<number> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return 0;
  try {
    const pipeline = client.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttlSeconds);
    const results = await pipeline.exec();
    return (results?.[0]?.[1] as number) ?? 0;
  } catch {
    redisAvailable = false;
    return 0;
  }
}

/**
 * SET NX (SET if Not eXists) — untuk distributed lock
 * Returns true jika berhasil acquire lock
 */
export async function redisSetNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return true; // fallback: anggap tidak ada lock
  try {
    const result = await client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    redisAvailable = false;
    return true; // fallback: allow execution
  }
}

/**
 * SADD + SMEMBERS — untuk Set (online users tracking)
 */
export async function redisSAdd(key: string, ...members: string[]): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return false;
  try {
    await client.sadd(key, ...members);
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
}

export async function redisSRem(key: string, ...members: string[]): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return false;
  try {
    await client.srem(key, ...members);
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
}

export async function redisSMembers(key: string): Promise<string[]> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return [];
  try {
    return await client.smembers(key);
  } catch {
    redisAvailable = false;
    return [];
  }
}

export async function redisSCard(key: string): Promise<number> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return -1; // -1 = Redis tidak tersedia
  try {
    return await client.scard(key);
  } catch {
    redisAvailable = false;
    return -1;
  }
}

/**
 * HSET / HGET / HGETALL — untuk Hash (detail online user)
 */
export async function redisHSet(key: string, fields: Record<string, string>): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return false;
  try {
    await client.hset(key, fields);
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
}

export async function redisHGetAll(key: string): Promise<Record<string, string> | null> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return null;
  try {
    const result = await client.hgetall(key);
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    redisAvailable = false;
    return null;
  }
}

/**
 * TTL check
 */
export async function redisTTL(key: string): Promise<number> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return -2;
  try {
    return await client.ttl(key);
  } catch {
    return -2;
  }
}

// ==================== CACHE HELPERS ====================

/**
 * Cache-aside pattern — getOrSet
 * Fetch from Redis, jika miss call fetcher() dan simpan hasilnya
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Coba ambil dari cache
  const cached = await redisGet(key);
  if (cached !== null) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // JSON parse error — fetch fresh
    }
  }

  // Cache miss — jalankan fetcher
  const result = await fetcher();

  // Simpan ke cache (non-blocking, jangan block response)
  redisSet(key, JSON.stringify(result), ttlSeconds).catch(() => {});

  return result;
}

// ==================== KEY NAMESPACING ====================

export const RedisKeys = {
  // RADIUS authorize cache
  radiusAuth: (username: string) => `radius:auth:${username}`,

  // Online users set
  onlineUsers: () => `online:users`,

  // Online user detail hash
  onlineUserDetail: (username: string) => `online:user:${username}`,

  // Dashboard cache
  dashboardStats: () => `cache:dashboard:stats`,
  dashboardTraffic: () => `cache:dashboard:traffic`,

  // Rate limiting
  rateLimit: (clientId: string) => `rl:${clientId}`,

  // Distributed lock
  cronLock: (jobType: string) => `lock:cron:${jobType}`,

  // Notification dedup
  notifSent: (type: string, targetId: string) => `notif:sent:${type}:${targetId}`,

  // NAS / Router cache
  nasCache: (nasIp: string) => `cache:nas:${nasIp}`,

  // Customer portal cache (keyed by userId for correctness)
  customerDashboard: (userId: number | string) => `cache:customer:dashboard:${userId}`,
  customerMe: (userId: number | string) => `cache:customer:me:${userId}`,
  customerInvoices: (userId: number | string) => `cache:customer:invoices:${userId}`,
};
