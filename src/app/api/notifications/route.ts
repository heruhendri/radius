import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build where clause
    const where: any = {};
    if (unreadOnly) where.isRead = false;
    if (type) where.type = type;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: { isRead: false },
    });

    // Get category counts
    const allNotifications = await prisma.notification.groupBy({
      by: ['type'],
      _count: {
        id: true,
      },
    });

    const categoryCounts: Record<string, number> = {};
    allNotifications.forEach((item) => {
      categoryCounts[item.type] = item._count.id;
    });

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
      categoryCounts,
    });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { notificationIds, markAll } = await request.json();

    if (markAll) {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
        },
        data: { isRead: true },
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notifications marked as read',
    });
  } catch (error: any) {
    console.error('Update notifications error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const ids = searchParams.get('ids');

    // Bulk delete
    if (ids) {
      const idArray = ids.split(',').filter(Boolean);
      
      if (idArray.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No IDs provided' },
          { status: 400 }
        );
      }

      await prisma.notification.deleteMany({
        where: {
          id: { in: idArray },
        },
      });

      return NextResponse.json({
        success: true,
        message: `${idArray.length} notifications deleted`,
        count: idArray.length,
      });
    }

    // Single delete
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Notification ID required' },
        { status: 400 }
      );
    }

    await prisma.notification.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error: any) {
    console.error('Delete notification error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
