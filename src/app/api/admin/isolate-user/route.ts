import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isolateUser } from '@/lib/cron/auto-isolation';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication (SUPER_ADMIN only)
    await requireAdmin(request);

    const body = await request.json();
    const { username, reason } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    const result = await isolateUser(username, reason);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Manual isolation error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
