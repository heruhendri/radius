import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const ip = searchParams.get('ip');

    // Need either username or IP
    if (!username && !ip) {
      return NextResponse.json({
        success: false,
        error: 'Username or IP is required'
      }, { status: 400 });
    }

    let user;

    // If IP provided, try to find user from active session
    if (ip && !username) {
      console.log('[CHECK-ISOLATION] Looking up user by IP:', ip);
      
      // Find active session with this IP
      const session = await prisma.radacct.findFirst({
        where: {
          framedipaddress: ip,
          acctstoptime: null, // Still active
        },
        select: {
          username: true,
        },
        orderBy: {
          acctstarttime: 'desc',
        },
      });

      if (session?.username) {
        console.log('[CHECK-ISOLATION] Found username from IP:', session.username);
        
        // Now find the user
        user = await prisma.pppoeUser.findUnique({
          where: { username: session.username },
          select: {
            id: true,
            username: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            expiredAt: true,
            profile: {
              select: {
                name: true,
                price: true,
              }
            }
          }
        });
      }
    } else if (username) {
      // Find user by username
      user = await prisma.pppoeUser.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          expiredAt: true,
          profile: {
            select: {
              name: true,
              price: true,
            }
          }
        }
      });
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Check if user is isolated
    if (user.status !== 'isolated') {
      return NextResponse.json({
        success: true,
        isolated: false,
        message: 'User is not isolated'
      });
    }

    // Get unpaid invoices
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
        status: {
          in: ['PENDING', 'OVERDUE']
        }
      },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        dueDate: true,
        paymentLink: true,
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      isolated: true,
      data: {
        username: user.username,
        name: user.name,
        phone: user.phone,
        email: user.email,
        expiredAt: user.expiredAt,
        profileName: user.profile?.name,
        unpaidInvoices: unpaidInvoices
      }
    });
  } catch (error: any) {
    console.error('Check isolation error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
