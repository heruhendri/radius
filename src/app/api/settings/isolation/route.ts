import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get isolation settings
export async function GET(request: NextRequest) {
  try {
    console.log('[Isolation API] GET request received');
    
    const company = await prisma.company.findFirst({
      select: {
        isolationEnabled: true,
        isolationIpPool: true,
        isolationRateLimit: true,
        isolationRedirectUrl: true,
        isolationMessage: true,
        isolationAllowDns: true,
        isolationAllowPayment: true,
        isolationNotifyWhatsapp: true,
        isolationNotifyEmail: true,
        gracePeriodDays: true,
        baseUrl: true,
      }
    });

    console.log('[Isolation API] Company found:', company ? 'Yes' : 'No');

    if (!company) {
      return NextResponse.json({
        success: false,
        error: 'Company settings not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: company
    });
  } catch (error: any) {
    console.error('[Isolation API] Get isolation settings error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// PUT - Update isolation settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      isolationEnabled,
      isolationIpPool,
      isolationRateLimit,
      isolationRedirectUrl,
      isolationMessage,
      isolationAllowDns,
      isolationAllowPayment,
      isolationNotifyWhatsapp,
      isolationNotifyEmail,
      gracePeriodDays
    } = body;

    // Validate IP pool format (basic validation)
    if (isolationIpPool && !isolationIpPool.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid IP pool format. Use CIDR notation (e.g., 192.168.200.0/24)'
      }, { status: 400 });
    }

    // Validate rate limit format
    if (isolationRateLimit && !isolationRateLimit.match(/^\d+[kmg]?\/\d+[kmg]?$/i)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid rate limit format. Use format like: 64k/64k, 1M/1M'
      }, { status: 400 });
    }

    const company = await prisma.company.findFirst();
    
    if (!company) {
      return NextResponse.json({
        success: false,
        error: 'Company not found'
      }, { status: 404 });
    }

    const updated = await prisma.company.update({
      where: { id: company.id },
      data: {
        isolationEnabled: isolationEnabled ?? company.isolationEnabled,
        isolationIpPool: isolationIpPool ?? company.isolationIpPool,
        isolationRateLimit: isolationRateLimit ?? company.isolationRateLimit,
        isolationRedirectUrl: isolationRedirectUrl ?? company.isolationRedirectUrl,
        isolationMessage: isolationMessage ?? company.isolationMessage,
        isolationAllowDns: isolationAllowDns ?? company.isolationAllowDns,
        isolationAllowPayment: isolationAllowPayment ?? company.isolationAllowPayment,
        isolationNotifyWhatsapp: isolationNotifyWhatsapp ?? company.isolationNotifyWhatsapp,
        isolationNotifyEmail: isolationNotifyEmail ?? company.isolationNotifyEmail,
        gracePeriodDays: gracePeriodDays ?? company.gracePeriodDays,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Isolation settings updated successfully',
      data: updated
    });
  } catch (error: any) {
    console.error('Update isolation settings error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
