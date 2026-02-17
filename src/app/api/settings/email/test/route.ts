import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '@/lib/email';
import { requirePermission } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requirePermission('settings.edit');
    if (!authCheck.authorized) return authCheck.response;

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    // Send test email
    const result = await EmailService.sendTest(email);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
