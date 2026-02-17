import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Register FCM Token for Push Notifications
 * POST /api/customer/fcm/register
 */

// Helper to verify customer token
async function verifyCustomerToken(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return null;

    const session = await prisma.customerSession.findFirst({
      where: {
        token,
        verified: true,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) return null;

    return await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyCustomerToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { token: fcmToken, deviceId, platform } = await request.json();

    if (!fcmToken) {
      return NextResponse.json(
        { success: false, message: 'FCM token is required' },
        { status: 400 }
      );
    }

    // Store FCM token in user's fcmTokens field (JSON)
    // Note: You might want to create a separate fcm_tokens table for better structure
    const currentUser = await prisma.pppoeUser.findUnique({
      where: { id: user.id },
      select: { fcmTokens: true },
    });

    let fcmTokens: any[] = [];
    if (currentUser?.fcmTokens) {
      try {
        fcmTokens = JSON.parse(currentUser.fcmTokens as string);
      } catch (e) {
        fcmTokens = [];
      }
    }

    // Remove old token with same deviceId (if exists)
    if (deviceId) {
      fcmTokens = fcmTokens.filter((t: any) => t.deviceId !== deviceId);
    }

    // Add new token
    fcmTokens.push({
      token: fcmToken,
      deviceId: deviceId || null,
      platform: platform || 'unknown',
      registeredAt: new Date().toISOString(),
    });

    // Keep only last 5 tokens
    if (fcmTokens.length > 5) {
      fcmTokens = fcmTokens.slice(-5);
    }

    // Update user with new FCM tokens
    await prisma.pppoeUser.update({
      where: { id: user.id },
      data: {
        fcmTokens: JSON.stringify(fcmTokens),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'FCM token registered successfully',
    });
  } catch (error: any) {
    console.error('Register FCM token error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan', error: error.message },
      { status: 500 }
    );
  }
}
