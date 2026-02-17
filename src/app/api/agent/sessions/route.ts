import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });
    }

    // Get all vouchers for this agent
    const vouchers = await prisma.hotspotVoucher.findMany({
      where: {
        agentId,
        status: 'ACTIVE'
      },
      select: {
        code: true,
        profile: {
          select: {
            name: true
          }
        }
      }
    });

    const voucherCodes = vouchers.map(v => v.code);

    if (voucherCodes.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    // Get active sessions for these vouchers
    const sessions = await prisma.radacct.findMany({
      where: {
        username: {
          in: voucherCodes
        },
        acctstoptime: null
      },
      orderBy: {
        acctstarttime: 'desc'
      },
      select: {
        radacctid: true,
        username: true,
        nasipaddress: true,
        nasportid: true,
        framedipaddress: true,
        callingstationid: true,
        calledstationid: true,
        acctsessionid: true,
        acctstarttime: true,
        acctinputoctets: true,
        acctoutputoctets: true,
        acctsessiontime: true,
      }
    });

    // Map sessions with profile info
    const sessionsWithProfile = sessions.map((session: any) => {
      const voucher = vouchers.find(v => v.code === session.username);
      return {
        id: session.radacctid.toString(),
        username: session.username,
        nasIpAddress: session.nasipaddress,
        nasPortId: session.nasportid,
        framedIpAddress: session.framedipaddress,
        callingStationId: session.callingstationid,
        calledStationId: session.calledstationid,
        acctSessionId: session.acctsessionid,
        acctStartTime: session.acctstarttime,
        acctInputOctets: session.acctinputoctets || 0,
        acctOutputOctets: session.acctoutputoctets || 0,
        acctSessionTime: session.acctsessiontime || 0,
        profileName: voucher?.profile?.name || null,
      };
    });

    return NextResponse.json({ sessions: sessionsWithProfile });
  } catch (error) {
    console.error('Get agent sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
