import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { sendFCMNotifications } from '@/server/services/notifications/push.service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

// Expo push API (fallback untuk ExponentPushToken lama)
async function sendExpoPushNotifications(messages: ExpoMessage[]): Promise<{ success: number; failed: number }> {
  const CHUNK_SIZE = 100;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();

      if (result.data) {
        for (const ticket of result.data) {
          if (ticket.status === 'ok') {
            success++;
          } else {
            failed++;
            console.error('Expo ticket error:', ticket.details?.error, ticket.message);
          }
        }
      } else {
        failed += chunk.length;
        console.error('Expo push error:', result);
      }
    } catch (error) {
      console.error('Expo push request failed:', error);
      failed += chunk.length;
    }
  }

  return { success, failed };
}

/**
 * GET /api/admin/push-notifications
 * Get broadcast history + stats
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    const action = searchParams.get('action');

    // Get stats: how many users have push tokens registered
    if (action === 'stats') {
      const totalUsers = await prisma.pppoeUser.count({
        where: { status: 'active' },
      });
      const usersWithTokens = await prisma.pppoeUser.count({
        where: { fcmTokens: { not: null } },
      });
      const areas = await prisma.pppoeArea.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      const totalBroadcasts = await prisma.pushBroadcast.count();

      return NextResponse.json({
        success: true,
        stats: { totalUsers, usersWithTokens, areas, totalBroadcasts },
      });
    }

    const [broadcasts, total] = await Promise.all([
      prisma.pushBroadcast.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pushBroadcast.count(),
    ]);

    return NextResponse.json({
      success: true,
      broadcasts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Push notifications GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/push-notifications
 * Send push notification to customers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      message,
      type = 'broadcast',
      targetType = 'all',
      targetIds = [],
      data = {},
      sentBy = 'admin',
    } = body;

    if (!title || !message) {
      return NextResponse.json({ success: false, error: 'Title and message are required' }, { status: 400 });
    }

    // Build where clause for user query
    let whereClause: any = { fcmTokens: { not: null } };

    if (targetType === 'area' && targetIds.length > 0) {
      whereClause.areaId = { in: targetIds };
    } else if (targetType === 'status' && targetIds.length > 0) {
      whereClause.status = { in: targetIds };
    } else if (targetType === 'selected' && targetIds.length > 0) {
      whereClause.id = { in: targetIds };
    } else if (targetType === 'active') {
      whereClause.status = 'active';
    } else if (targetType === 'expired') {
      whereClause.status = 'expired';
    }

    const users = await prisma.pppoeUser.findMany({
      where: whereClause,
      select: { id: true, username: true, fcmTokens: true },
    });

    if (users.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No users with registered push tokens found for the selected target',
      }, { status: 400 });
    }

    // Build Expo push messages AND collect native FCM tokens
    const expoMessages: ExpoMessage[] = [];
    const nativeFcmTokens: string[] = [];

    for (const user of users) {
      if (!user.fcmTokens) continue;

      let tokens: any[] = [];
      try {
        tokens = JSON.parse(user.fcmTokens);
      } catch {
        continue;
      }

      for (const tokenObj of tokens) {
        const token = typeof tokenObj === 'string' ? tokenObj : tokenObj.token;
        if (!token) continue;

        if (token.startsWith('ExponentPushToken[')) {
          // Expo push token → kirim via Expo API
          expoMessages.push({
            to: token,
            title,
            body: message,
            sound: 'default',
            priority: 'high',
            channelId: 'default',
            data: { type, userId: user.id, ...data },
          });
        } else {
          // Native FCM token → kirim langsung via Firebase Admin SDK
          nativeFcmTokens.push(token);
        }
      }
    }

    if (expoMessages.length === 0 && nativeFcmTokens.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid push tokens found',
      }, { status: 400 });
    }

    // Kirim ke dua jalur secara paralel
    const [expoResult, fcmResult] = await Promise.all([
      expoMessages.length > 0
        ? sendExpoPushNotifications(expoMessages)
        : Promise.resolve({ success: 0, failed: 0 }),
      nativeFcmTokens.length > 0
        ? sendFCMNotifications(nativeFcmTokens, title, message, {
            type,
            ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          })
        : Promise.resolve({ success: 0, failed: 0, invalidTokens: [] }),
    ]);

    const sentCount = expoResult.success + fcmResult.success;
    const failedCount = expoResult.failed + fcmResult.failed;

    // Log broadcast
    const broadcast = await prisma.pushBroadcast.create({
      data: {
        title,
        body: message,
        type,
        targetType,
        targetIds: targetIds.length > 0 ? JSON.stringify(targetIds) : null,
        sentCount,
        failedCount,
        sentBy,
        data: Object.keys(data).length > 0 ? JSON.stringify(data) : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${sentCount} devices (${failedCount} failed)`,
      broadcast,
      stats: { total: expoMessages.length + nativeFcmTokens.length, sent: sentCount, failed: failedCount },
    });
  } catch (error: any) {
    console.error('Push notifications POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
