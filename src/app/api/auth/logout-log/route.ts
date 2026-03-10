import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/server/services/activity-log.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, username, role } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    await logActivity({
      userId,
      username,
      userRole: role,
      action: 'LOGOUT',
      description: `User logged out: ${username} (${role})`,
      module: 'auth',
      status: 'success',
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout log error:', error);
    return NextResponse.json({ error: 'Failed to log' }, { status: 500 });
  }
}
