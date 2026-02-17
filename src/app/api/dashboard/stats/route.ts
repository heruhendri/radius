import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRecentActivities } from "@/lib/activity-log";

// Disable caching for this route - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow all authenticated admin users (they use AdminRole: SUPER_ADMIN, FINANCE, etc.)
    // No additional role check needed - if they can login to admin, they can see dashboard
    const userRole = (session.user as any).role;
    console.log('Dashboard stats accessed by role:', userRole);
    
    // Current time for database queries
    const now = new Date();
    
    // Database stores dates in UTC, but we want to query by WIB (UTC+7) month boundaries
    // When JavaScript creates new Date(2025, 11, 1) on a WIB server, it already creates
    // "Dec 1 00:00 WIB" which is internally "Nov 30 17:00 UTC" - this is correct!
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    // Start of this month (creates "Month 1, 00:00 local time" which auto-converts to UTC)
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    
    // Start of next month (for upper bound)
    const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    
    // Start of last month
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
    
    // End of last month (which is start of current month)
    const endOfLastMonth = new Date(startOfMonth.getTime() - 1); // 1ms before current month
    
    console.log('[Dashboard] Date ranges:', {
      now: now.toISOString(),
      currentMonth: currentMonth + 1,
      startOfMonth: startOfMonth.toISOString(),
      startOfNextMonth: startOfNextMonth.toISOString(),
      startOfLastMonth: startOfLastMonth.toISOString(),
      endOfLastMonth: endOfLastMonth.toISOString(),
    });

    // Total users - PPPoE Users + All Hotspot Vouchers (terpisah)
    let pppoeUserCount = 0;
    let hotspotUserCount = 0; // ALL vouchers
    let hotspotActiveUserCount = 0; // Only used vouchers
    
    try {
      pppoeUserCount = await prisma.pppoeUser.count();
    } catch (e) {
      console.error('[Dashboard] Error counting pppoeUser:', e);
    }
    
    try {
      const now = new Date();
      
      // Count ALL non-expired vouchers (exclude EXPIRED status)
      hotspotUserCount = await prisma.hotspotVoucher.count({
        where: {
          status: { not: 'EXPIRED' }, // Exclude expired vouchers
          OR: [
            { expiresAt: null }, // No expiry
            { expiresAt: { gte: now } } // Not yet expired
          ]
        }
      });
      
      // Count vouchers that have been activated (first login happened) and not expired
      hotspotActiveUserCount = await prisma.hotspotVoucher.count({
        where: {
          status: { not: 'EXPIRED' }, // Exclude expired vouchers
          firstLoginAt: { not: null },
          OR: [
            { expiresAt: null }, // No expiry
            { expiresAt: { gte: now } } // Not yet expired
          ]
        },
      });
    } catch (e) {
      console.error('[Dashboard] Error counting hotspotVoucher:', e);
    }
    
    const totalUsers = pppoeUserCount + hotspotUserCount;
    
    // Last month users for growth calculation
    let lastMonthPppoeUsers = 0;
    let lastMonthHotspotUsers = 0;
    
    try {
      lastMonthPppoeUsers = await prisma.pppoeUser.count({
        where: {
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      });
    } catch (e) {
      console.error('[Dashboard] Error counting lastMonthPppoeUsers:', e);
    }
    
    try {
      lastMonthHotspotUsers = await prisma.hotspotVoucher.count({
        where: {
          status: { not: 'EXPIRED' }, // Exclude expired vouchers
          firstLoginAt: { not: null },
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      });
    } catch (e) {
      console.error('[Dashboard] Error counting lastMonthHotspotUsers:', e);
    }
    const lastMonthUsers = lastMonthPppoeUsers + lastMonthHotspotUsers;
    
    const usersGrowth =
      lastMonthUsers > 0
        ? ((totalUsers - lastMonthUsers) / lastMonthUsers) * 100
        : 0;
    
    console.log('[Dashboard] User counts:', {
      pppoeUserCount,
      hotspotUserCount,
      totalUsers,
      lastMonthUsers,
    });

    // Active sessions - PISAHKAN PPPoE dan Hotspot
    // OPTIMIZED: Use batch query instead of N+1 queries
    let activeSessionsPPPoE = 0;
    let activeSessionsHotspot = 0;
    let activeSessions = 0;
    
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Get active sessions from radacct with same logic as sessions API
      const activeRadacctSessions = await prisma.radacct.findMany({
        where: {
          acctstoptime: null,
          OR: [
            // PPPoE sessions: must have recent interim update (< 10 min)
            { acctupdatetime: { gte: tenMinutesAgo } },
            // Hotspot vouchers: might not have interim updates, so use longer window
            { 
              AND: [
                { acctupdatetime: null },
                { acctstarttime: { gte: oneDayAgo } },
              ],
            },
          ],
        },
        select: { username: true },
      });
      
      // Get unique usernames
      const uniqueUsernames = [...new Set(
        activeRadacctSessions.map(s => s.username).filter(Boolean)
      )] as string[];
      
      activeSessions = uniqueUsernames.length;
      
      // Batch fetch PPPoE users to determine session types
      if (uniqueUsernames.length > 0) {
        const pppoeUsers = await prisma.pppoeUser.findMany({
          where: { username: { in: uniqueUsernames } },
          select: { username: true },
        });
        
        const pppoeUsernameSet = new Set(pppoeUsers.map(u => u.username));
        
        for (const username of uniqueUsernames) {
          if (pppoeUsernameSet.has(username)) {
            activeSessionsPPPoE++;
          } else {
            activeSessionsHotspot++;
          }
        }
      }
      
      console.log('[Dashboard] Active sessions:', {
        total: activeSessions,
        pppoe: activeSessionsPPPoE,
        hotspot: activeSessionsHotspot,
      });
      
    } catch (e) {
      console.error('[Dashboard] Error counting active sessions:', e);
    }

    // Pending invoices
    const pendingInvoices = await prisma.invoice.count({
      where: {
        status: "PENDING",
      },
    });

    // Overdue invoices count for last month comparison
    const lastMonthPendingInvoices = await prisma.invoice.count({
      where: {
        status: "PENDING",
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });
    const invoicesChange =
      lastMonthPendingInvoices > 0
        ? ((pendingInvoices - lastMonthPendingInvoices) /
            lastMonthPendingInvoices) *
          100
        : 0;

    // Revenue this month (Keuangan - Transactions INCOME)
    let revenueThisMonth = 0;
    let revenueLastMonth = 0;
    let transactionCount = 0;
    
    try {
      // Query using current month date range
      const incomeThisMonth = await prisma.transaction.aggregate({
        where: {
          type: 'INCOME',
          date: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
        _sum: {
          amount: true,
        },
      });
      revenueThisMonth = Number(incomeThisMonth._sum.amount) || 0;
      
      // Count transactions for debugging
      transactionCount = await prisma.transaction.count({
        where: {
          type: 'INCOME',
          date: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
      });
    } catch (e) {
      console.error('[Dashboard] Error getting income this month:', e);
    }
    
    try {
      // Revenue last month - use Prisma aggregate
      const incomeLastMonth = await prisma.transaction.aggregate({
        where: {
          type: 'INCOME',
          date: {
            gte: startOfLastMonth,
            lt: startOfMonth,
          },
        },
        _sum: {
          amount: true,
        },
      });
      revenueLastMonth = Number(incomeLastMonth._sum.amount) || 0;
    } catch (e) {
      console.error('[Dashboard] Error getting income last month:', e);
    }
    
    console.log('[Dashboard] Revenue debug:', {
      startOfMonth: startOfMonth.toISOString(),
      startOfNextMonth: startOfNextMonth.toISOString(),
      now: now.toISOString(),
      transactionCount,
      revenueThisMonth,
      revenueLastMonth,
    });
    
    const revenueGrowth =
      revenueLastMonth > 0
        ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
        : 0;

    // Format revenue to IDR
    const formatRevenue = (amount: number) => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    // Network stats - use actual active sessions from radacct
    // Previously this used pppoeUser.count(status=active) and hotspotVoucher.count(status=ACTIVE)
    // But that's not actual "sessions" - it's just user/voucher status in database
    // Now we use the actual session counts from radacct for consistency
    const pppoeSessionCount = activeSessionsPPPoE; // Use already calculated value
    const hotspotSessionCount = activeSessionsHotspot; // Use already calculated value

    // Bandwidth usage from radacct (all time)
    let totalBytes = 0;
    try {
      const bandwidthData = await prisma.radacct.aggregate({
        _sum: {
          acctinputoctets: true,
          acctoutputoctets: true,
        },
      });

      const totalBytesIn = bandwidthData._sum.acctinputoctets ? Number(bandwidthData._sum.acctinputoctets) : 0;
      const totalBytesOut = bandwidthData._sum.acctoutputoctets ? Number(bandwidthData._sum.acctoutputoctets) : 0;
      totalBytes = totalBytesIn + totalBytesOut;
    } catch (e) {
      console.error('[Dashboard] Error calculating bandwidth:', e);
    }

    // Format bytes to readable format
    const formatBandwidth = (bytes: number) => {
      const tb = bytes / 1024 ** 4;
      const gb = bytes / 1024 ** 3;

      if (tb >= 1) {
        return `${tb.toFixed(2)} TB`;
      } else if (gb >= 1) {
        return `${gb.toFixed(2)} GB`;
      } else {
        return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
      }
    };

    // Recent activities - get from activity log
    const activities = await getRecentActivities(10);

    // System status checks
    let radiusStatus = false;
    let databaseStatus = true; // If we got here, database is connected
    let apiStatus = true; // If we got here, API is running

    // Check RADIUS by checking if radacct table has recent records
    try {
      const recentRadacct = await prisma.radacct.findFirst({
        where: {
          acctstarttime: {
            gte: new Date(Date.now() - 3600000), // Last 1 hour
          },
        },
      });
      radiusStatus = !!recentRadacct;
    } catch (error) {
      radiusStatus = false;
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: {
          value: totalUsers,
          change: `${usersGrowth > 0 ? "+" : ""}${usersGrowth.toFixed(1)}%`,
        },
        pppoeUsers: {
          value: pppoeUserCount,
          change: null,
        },
        hotspotVouchers: {
          value: hotspotUserCount, // ALL vouchers
          active: hotspotActiveUserCount, // Only used vouchers
          change: null,
        },
        activeSessions: {
          value: activeSessions,
          pppoe: activeSessionsPPPoE,
          hotspot: activeSessionsHotspot,
          change: null,
        },
        pendingInvoices: {
          value: pendingInvoices,
          change: `${invoicesChange > 0 ? "+" : ""}${invoicesChange.toFixed(1)}%`,
        },
        revenue: {
          value: formatRevenue(revenueThisMonth),
          change: `${revenueGrowth > 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%`,
        },
      },
      network: {
        pppoeUsers: pppoeSessionCount,
        hotspotSessions: hotspotSessionCount,
        bandwidth: formatBandwidth(totalBytes),
      },
      activities,
      systemStatus: {
        radius: radiusStatus,
        database: databaseStatus,
        api: apiStatus,
      },
    });
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
