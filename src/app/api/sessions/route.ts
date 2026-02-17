import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Present RADIUS session traffic in a compact human readable form
function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(2)} ${units[exponent]}`;
}

// Render uptime in a simple h/m/s string for the UI
function formatDuration(seconds: number): string {
  if (!seconds) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // pppoe | hotspot | null
    const routerId = searchParams.get('routerId');
    const search = searchParams.get('search');
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '0', 10); // 0 = no pagination

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      AND: [
        { acctstoptime: null },
        {
          OR: [
            { acctupdatetime: { gte: tenMinutesAgo } },
            {
              AND: [
                { acctupdatetime: null },
                { acctstarttime: { gte: oneDayAgo } },
              ],
            },
          ],
        },
      ],
    };

    if (search) {
      (where.AND as unknown[]).push({
        OR: [
          { username: { contains: search } },
          { framedipaddress: { contains: search } },
        ],
      });
    }

    if (routerId) {
      const router = await prisma.router.findUnique({
        where: { id: routerId },
        select: { nasname: true, ipAddress: true },
      });
      const routerNasValues = [router?.nasname, router?.ipAddress].filter(Boolean) as string[];
      if (routerNasValues.length > 0) {
        (where.AND as unknown[]).push({
          OR: routerNasValues.map((value) => ({ nasipaddress: value })),
        });
      }
    }

    const radacctSessions = await prisma.radacct.findMany({
      where,
      orderBy: { acctstarttime: 'desc' },
    });

    const latestByUser = new Map<string, (typeof radacctSessions)[number]>();
    for (const session of radacctSessions) {
      if (!session.username) continue;
      const existing = latestByUser.get(session.username);
      if (!existing) {
        latestByUser.set(session.username, session);
        continue;
      }
      const existingTime = existing.acctupdatetime ?? existing.acctstarttime ?? new Date(0);
      const currentTime = session.acctupdatetime ?? session.acctstarttime ?? new Date(0);
      if (currentTime > existingTime) {
        latestByUser.set(session.username, session);
      }
    }

    const deduplicatedSessions = Array.from(latestByUser.values());
    const usernames = [...new Set(deduplicatedSessions.map((session) => session.username!))];

    const [pppoeUsers, hotspotVouchers, routers] = await Promise.all([
      prisma.pppoeUser.findMany({
        where: { username: { in: usernames } },
        select: {
          id: true,
          username: true,
          name: true,
          phone: true,
          profile: { select: { name: true } },
        },
      }),
      prisma.hotspotVoucher.findMany({
        where: { code: { in: usernames } },
        select: {
          id: true,
          code: true,
          status: true,
          batchCode: true,
          agent: { select: { id: true, name: true } },
          profile: { select: { name: true } },
          router: { select: { id: true, name: true, nasname: true, ipAddress: true } },
        },
      }),
      prisma.router.findMany({
        where: { isActive: true },
        select: { id: true, name: true, nasname: true, ipAddress: true },
      }),
    ]);

    const pppoeByUsername = new Map(pppoeUsers.map((user: any) => [user.username, user]));
    const voucherByCode = new Map(hotspotVouchers.map((voucher: any) => [voucher.code, voucher]));
    const routerByNasname = new Map(routers.map((router: any) => [router.nasname, router]));
    const routerByIp = new Map(
      routers.filter((router: any) => Boolean(router.ipAddress)).map((router: any) => [router.ipAddress!, router]),
    );

    const sessions = deduplicatedSessions
      .map((session) => {
        const username = session.username;
        if (!username) return null;

        const pppoeUser = pppoeByUsername.get(username);
        const voucher = voucherByCode.get(username);
        const sessionType = pppoeUser ? 'pppoe' : 'hotspot';

        if (type && type !== sessionType) return null;

        let router = voucher?.router ?? null;
        if (!router && session.nasipaddress) {
          router = routerByNasname.get(session.nasipaddress) ?? routerByIp.get(session.nasipaddress) ?? null;
        }

        const start = session.acctstarttime ?? new Date();
        const durationSeconds = session.acctsessiontime && session.acctsessiontime > 0
          ? session.acctsessiontime
          : Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));

        const uploadBytes = Number(session.acctinputoctets ?? 0);
        const downloadBytes = Number(session.acctoutputoctets ?? 0);
        const totalBytes = uploadBytes + downloadBytes;

        return {
          id: String(session.radacctid),
          username,
          sessionId: session.acctsessionid,
          type: sessionType,
          nasIpAddress: session.nasipaddress,
          framedIpAddress: session.framedipaddress,
          macAddress: session.callingstationid ?? '-',
          calledStationId: session.calledstationid ?? '-',
          startTime: session.acctstarttime ? session.acctstarttime.toISOString().replace('Z', '') : null,
          lastUpdate: session.acctupdatetime ? session.acctupdatetime.toISOString().replace('Z', '') : null,
          duration: durationSeconds,
          durationFormatted: formatDuration(durationSeconds),
          uploadBytes,
          downloadBytes,
          totalBytes,
          uploadFormatted: formatBytes(uploadBytes),
          downloadFormatted: formatBytes(downloadBytes),
          totalFormatted: formatBytes(totalBytes),
          router: router ? { id: router.id, name: router.name } : null,
          user: sessionType === 'pppoe' && pppoeUser
            ? {
                id: pppoeUser.id,
                name: pppoeUser.name,
                phone: pppoeUser.phone,
                profile: pppoeUser.profile?.name ?? null,
              }
            : null,
          voucher: sessionType === 'hotspot' && voucher
            ? {
                id: voucher.id,
                status: voucher.status,
                profile: voucher.profile?.name ?? null,
                batchCode: voucher.batchCode,
                agent: voucher.agent ? { id: voucher.agent.id, name: voucher.agent.name } : null,
              }
            : null,
        };
      })
      .filter((session): session is NonNullable<typeof session> => Boolean(session));

    const stats = {
      total: sessions.length,
      pppoe: sessions.filter((session) => session.type === 'pppoe').length,
      hotspot: sessions.filter((session) => session.type === 'hotspot').length,
      totalUpload: sessions.reduce((sum, session) => sum + session.uploadBytes, 0),
      totalDownload: sessions.reduce((sum, session) => sum + session.downloadBytes, 0),
    };

    const totalBandwidth = stats.totalUpload + stats.totalDownload;
    const paginatedSessions = limit > 0
      ? sessions.slice((page - 1) * limit, (page - 1) * limit + limit)
      : sessions;

    const allTimeStats = await prisma.radacct.aggregate({
      _sum: {
        acctinputoctets: true,
        acctoutputoctets: true,
        acctsessiontime: true,
      },
      _count: { radacctid: true },
    });

    const totalAllTimeBytes = Number(allTimeStats._sum.acctinputoctets ?? 0) + Number(allTimeStats._sum.acctoutputoctets ?? 0);

    return NextResponse.json({
      sessions: paginatedSessions,
      stats: {
        ...stats,
        totalBandwidth,
        totalUploadFormatted: formatBytes(stats.totalUpload),
        totalDownloadFormatted: formatBytes(stats.totalDownload),
        totalBandwidthFormatted: formatBytes(totalBandwidth),
      },
      allTimeStats: {
        totalSessions: allTimeStats._count.radacctid ?? 0,
        totalBandwidth: totalAllTimeBytes,
        totalBandwidthFormatted: formatBytes(totalAllTimeBytes),
        totalDuration: allTimeStats._sum.acctsessiontime ?? 0,
        totalDurationFormatted: formatDuration(allTimeStats._sum.acctsessiontime ?? 0),
      },
      pagination: {
        page,
        limit: limit > 0 ? limit : sessions.length,
        total: sessions.length,
        totalPages: limit > 0 ? Math.max(1, Math.ceil(sessions.length / limit)) : 1,
      },
      mode: 'radius',
    });
  } catch (error) {
    console.error('[Sessions API] Failed to list active sessions', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
