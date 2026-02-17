import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Debug endpoint to check voucher router assignment and session details
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code') || 'UELRMF'
  
  try {
    // 1. Get voucher with router details
    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { code },
      include: {
        router: true,
        profile: true,
      },
    })
    
    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    }
    
    // 2. Get active session for this voucher
    const session = await prisma.radacct.findFirst({
      where: {
        username: code,
        acctstoptime: null,
      },
      orderBy: {
        acctstarttime: 'desc',
      },
    })
    
    // 3. Get all routers for comparison
    const allRouters = await prisma.router.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nasname: true,
        ipAddress: true,
        secret: true,
      },
    })
    
    // 4. Find router by session NAS IP if session exists
    let sessionRouter = null
    if (session?.nasipaddress) {
      sessionRouter = await prisma.router.findFirst({
        where: {
          OR: [
            { nasname: session.nasipaddress },
            { ipAddress: session.nasipaddress },
          ],
        },
      })
    }
    
    return NextResponse.json({
      voucher: {
        code: voucher.code,
        status: voucher.status,
        routerId: voucher.routerId,
        profileName: voucher.profile.name,
        expiresAt: voucher.expiresAt,
        firstLoginAt: voucher.firstLoginAt,
      },
      assignedRouter: voucher.router ? {
        id: voucher.router.id,
        name: voucher.router.name,
        nasname: voucher.router.nasname,
        ipAddress: voucher.router.ipAddress,
        secret: voucher.router.secret,
      } : null,
      activeSession: session ? {
        username: session.username,
        nasipaddress: session.nasipaddress,
        framedipaddress: session.framedipaddress,
        acctsessionid: session.acctsessionid,
        acctstarttime: session.acctstarttime,
        acctsessiontime: session.acctsessiontime,
      } : null,
      sessionRouter: sessionRouter ? {
        id: sessionRouter.id,
        name: sessionRouter.name,
        nasname: sessionRouter.nasname,
        ipAddress: sessionRouter.ipAddress,
        secret: sessionRouter.secret,
      } : null,
      allRouters: allRouters,
      analysis: {
        routerMatch: voucher.router?.id === sessionRouter?.id,
        shouldDisconnectTo: voucher.router ? {
          targetIp: voucher.router.ipAddress || voucher.router.nasname,
          secret: voucher.router.secret,
        } : null,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
