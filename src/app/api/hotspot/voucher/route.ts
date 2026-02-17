import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncBatchToRadius, removeVoucherFromRadius, syncVoucherToRadius } from '@/lib/hotspot-radius-sync'
import { logActivity } from '@/lib/activity-log'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { formatInTimeZone } from 'date-fns-tz'
import { WIB_TIMEZONE } from '@/lib/timezone'

// Code type definitions
const CODE_TYPES: Record<string, { name: string; chars: string }> = {
  'alpha-upper': { name: 'ABCDEFGHJKLMN', chars: 'ABCDEFGHJKLMNPQRSTUVWXYZ' },
  'alpha-lower': { name: 'abcdefghjklmnp', chars: 'abcdefghjklmnpqrstuvwxyz' },
  'alpha-mixed': { name: 'AbCdEfGhJKLMN', chars: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz' },
  'alpha-camel': { name: 'aBcDeFgHjKmn', chars: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz' },
  'numeric': { name: '123456789563343', chars: '123456789' },
  'alphanumeric-lower': { name: '123456abcdefgkh', chars: 'abcdefghjklmnpqrstuvwxyz123456789' },
  'alphanumeric-upper': { name: '456789ABCDEFGHJ', chars: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789' },
  'alphanumeric-mixed': { name: '56789aBcDefgiJKlm', chars: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz123456789' },
}

// Helper to generate random voucher code
function generateVoucherCode(length: number, prefix: string = '', codeType: string = 'alpha-upper'): string {
  const chars = CODE_TYPES[codeType]?.chars || CODE_TYPES['alpha-upper'].chars
  let code = prefix
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Helper to generate password (different from username)
function generatePassword(length: number, codeType: string = 'alpha-upper'): string {
  const chars = CODE_TYPES[codeType]?.chars || CODE_TYPES['alpha-upper'].chars
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Helper to generate batch code
function generateBatchCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
  return `BATCH-${year}${month}${day}-${time}`
}

// GET - List vouchers with filters and pagination
export async function GET(request: Request) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')
    const batchCode = searchParams.get('batchCode')
    const status = searchParams.get('status')
    const routerId = searchParams.get('routerId')
    const agentId = searchParams.get('agentId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = {}

    if (profileId && profileId !== 'all') where.profileId = profileId
    if (batchCode && batchCode !== 'all') where.batchCode = batchCode
    if (routerId && routerId !== 'all') where.routerId = routerId
    if (agentId && agentId !== 'all') where.agentId = agentId
    if (status && status !== 'all' && ['WAITING', 'ACTIVE', 'EXPIRED'].includes(status)) {
      where.status = status
    }

    // Get stats for all vouchers (ignore pagination for stats)
    const statsWhere: any = {}
    if (profileId && profileId !== 'all') statsWhere.profileId = profileId
    if (batchCode && batchCode !== 'all') statsWhere.batchCode = batchCode
    if (routerId && routerId !== 'all') statsWhere.routerId = routerId
    if (agentId && agentId !== 'all') statsWhere.agentId = agentId

    const [totalAll, waitingCount, activeCount, expiredCount] = await Promise.all([
      prisma.hotspotVoucher.count({ where: statsWhere }),
      prisma.hotspotVoucher.count({ where: { ...statsWhere, status: 'WAITING' } }),
      prisma.hotspotVoucher.count({ where: { ...statsWhere, status: 'ACTIVE' } }),
      prisma.hotspotVoucher.count({ where: { ...statsWhere, status: 'EXPIRED' } }),
    ])

    // Calculate total value
    const vouchersForValue = await prisma.hotspotVoucher.findMany({
      where: statsWhere,
      include: {
        profile: {
          select: {
            sellingPrice: true,
          },
        },
      },
    })
    const totalValue = vouchersForValue.reduce((sum: number, v: any) => sum + v.profile.sellingPrice, 0)

    // Get total count for pagination (with status filter)
    const total = await prisma.hotspotVoucher.count({ where })
    const totalPages = Math.ceil(total / limit)
    const skip = (page - 1) * limit

    const vouchers = await prisma.hotspotVoucher.findMany({
      where,
      include: {
        profile: {
          select: {
            name: true,
            sellingPrice: true,
            validityValue: true,
            validityUnit: true,
            usageQuota: true,
            usageDuration: true,
          },
        },
        router: {
          select: {
            id: true,
            name: true,
            shortname: true,
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    // Get unique batch codes for filter
    const batches = await prisma.hotspotVoucher.findMany({
      select: {
        batchCode: true,
      },
      distinct: ['batchCode'],
      orderBy: {
        batchCode: 'desc',
      },
    })

    // Get code types for generate form
    const codeTypes = Object.entries(CODE_TYPES).map(([key, value]) => ({
      value: key,
      label: value.name,
    }))

    // Transform DateTime for API response:
    // - createdAt/updatedAt: Convert from UTC (Prisma default) to WIB
    // - firstLoginAt/expiresAt: Already in WIB from FreeRADIUS, send as-is
    // Return as ISO string WITHOUT 'Z' to prevent browser timezone conversion
    const vouchersWithLocalTime = vouchers.map(v => ({
      ...v,
      profile: {
        ...v.profile,
        usageQuota: v.profile.usageQuota ? Number(v.profile.usageQuota) : null,
      },
      createdAt: formatInTimeZone(v.createdAt, WIB_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSS"),
      updatedAt: formatInTimeZone(v.updatedAt, WIB_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSS"),
      firstLoginAt: v.firstLoginAt ? v.firstLoginAt.toISOString().replace('Z', '') : null,
      expiresAt: v.expiresAt ? v.expiresAt.toISOString().replace('Z', '') : null,
    }))

    return NextResponse.json({ 
      vouchers: vouchersWithLocalTime,
      batches: batches.map((b: any) => b.batchCode).filter(Boolean),
      codeTypes,
      total,
      totalPages,
      currentPage: page,
      pageSize: limit,
      stats: {
        total: totalAll,
        waiting: waitingCount,
        active: activeCount,
        expired: expiredCount,
        totalValue,
      },
    })
  } catch (error: any) {
    console.error('Get vouchers error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal server error',
      vouchers: [],
      batches: [],
      codeTypes: [],
      total: 0,
      totalPages: 0,
      currentPage: 1,
      pageSize: 100,
      stats: {
        total: 0,
        waiting: 0,
        active: 0,
        expired: 0,
        totalValue: 0,
      },
    }, { status: 500 })
  }
}

// POST - Generate vouchers in batch
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      quantity,
      profileId,
      routerId,
      agentId,
      codeLength = 6,
      prefix = '',
      voucherType = 'same', // 'same' = username=password, 'different' = separate password
      codeType = 'alpha-upper',
      lockMac = false,
    } = body

    // Validation
    if (!quantity || !profileId) {
      return NextResponse.json(
        { error: 'Quantity and Profile are required' },
        { status: 400 }
      )
    }

    if (quantity > 25000) {
      return NextResponse.json(
        { error: 'Cannot generate more than 25000 vouchers at once' },
        { status: 400 }
      )
    }

    // Check if profile exists
    const profile = await prisma.hotspotProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if router exists (if provided)
    let router = null
    if (routerId) {
      router = await prisma.router.findUnique({
        where: { id: routerId },
      })
      if (!router) {
        return NextResponse.json({ error: 'Router not found' }, { status: 404 })
      }
    }

    // Check if agent exists (if provided)
    let agent = null
    if (agentId) {
      agent = await prisma.agent.findUnique({
        where: { id: agentId },
      })
      if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
      }
    }

    // Generate batch code
    const batchCode = generateBatchCode()

    // Generate vouchers
    const codes = new Set<string>()
    const voucherData = []

    for (let i = 0; i < quantity; i++) {
      let code: string
      let attempts = 0
      
      // Generate unique code (username)
      do {
        code = generateVoucherCode(codeLength, prefix, codeType)
        attempts++
        if (attempts > 100) {
          throw new Error('Failed to generate unique voucher codes. Try different prefix or length.')
        }
      } while (codes.has(code))
      
      codes.add(code)

      // Generate password based on voucher type
      let password: string | null = null
      if (voucherType === 'different') {
        password = generatePassword(codeLength, codeType)
      }
      
      voucherData.push({
        id: crypto.randomUUID(),
        code,
        password,
        profileId,
        routerId: routerId || null,
        agentId: agentId || null,
        voucherType,
        codeType,
        batchCode,
        status: 'WAITING' as const,
      })
    }

    // Bulk create vouchers using Prisma createMany for optimal performance
    const result = await prisma.hotspotVoucher.createMany({
      data: voucherData,
      skipDuplicates: true,
    })
    
    console.log(`Created ${result.count} vouchers in batch ${batchCode}`)

    // Sync to RADIUS with router-specific NAS if provided
    try {
      const syncCount = await syncBatchToRadiusWithOptions(batchCode, {
        routerId,
        lockMac,
        voucherType,
      })
      console.log(`Synced ${syncCount}/${result.count} vouchers to RADIUS`)
    } catch (syncError) {
      console.error('RADIUS sync error:', syncError)
      // Don't fail the request if sync fails
    }

    // Log activity
    try {
      const session = await getServerSession(authOptions)
      await logActivity({
        userId: (session?.user as any)?.id,
        username: (session?.user as any)?.username || 'Admin',
        userRole: (session?.user as any)?.role,
        action: 'GENERATE_VOUCHER',
        description: `Generated ${result.count} vouchers (${profile.name}) - Batch: ${batchCode}`,
        module: 'voucher',
        status: 'success',
        metadata: {
          quantity: result.count,
          profileId,
          profileName: profile.name,
          batchCode,
          routerId,
          agentId,
        },
      })

      // Send notification to agent if vouchers are for agent
      if (agentId && agent) {
        try {
          await prisma.agentNotification.create({
            data: {
              id: Math.random().toString(36).substring(2, 15),
              agentId: agentId,
              type: 'voucher_generated_by_admin',
              title: 'Voucher Ditambahkan',
              message: `Admin telah menambahkan ${result.count} voucher ${profile.name} untuk Anda. Batch: ${batchCode}`,
              link: null,
            },
          })
        } catch (notifError) {
          console.error(`⚠️ Failed to create notification for agent:`, notifError)
        }
      }
    } catch (logError) {
      console.error('Activity log error:', logError)
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      batchCode,
      message: `${result.count} vouchers generated and synced to RADIUS`,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Generate vouchers error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to sync batch to RADIUS with additional options
async function syncBatchToRadiusWithOptions(batchCode: string, options: {
  routerId?: string;
  lockMac?: boolean;
  voucherType?: string;
}) {
  const vouchers = await prisma.hotspotVoucher.findMany({
    where: { batchCode },
    include: {
      profile: true,
    },
  })

  let syncCount = 0
  for (const voucher of vouchers) {
    try {
      // For 'same' type, password is the same as code
      // For 'different' type, use the password field if exists, otherwise use code
      const password = voucher.password || voucher.code

      // Sync to RADIUS
      await syncVoucherToRadius(voucher.code, password, voucher.profile.groupProfile || voucher.profile.name, {
        nasIpAddress: undefined,
        lockMac: options.lockMac,
      })
      syncCount++
    } catch (error) {
      console.error(`Failed to sync voucher ${voucher.code}:`, error)
    }
  }
  return syncCount
}

// DELETE - Delete voucher or batch
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const batchCode = searchParams.get('batchCode')

    if (!id && !batchCode) {
      return NextResponse.json(
        { error: 'Voucher ID or Batch Code required' },
        { status: 400 }
      )
    }

    if (batchCode) {
      // Get voucher codes and agent info before deletion
      const vouchersToDelete = await prisma.hotspotVoucher.findMany({
        where: { batchCode, status: 'WAITING' },
        select: { 
          code: true, 
          agentId: true,
          profile: { select: { name: true } }
        }
      })

      // Delete entire batch (only WAITING vouchers)
      const result = await prisma.hotspotVoucher.deleteMany({
        where: { 
          batchCode, 
          status: 'WAITING' 
        }
      })

      // Send notification to agent if any vouchers belong to agent
      const agentIds = [...new Set(vouchersToDelete.filter(v => v.agentId).map(v => v.agentId))];
      for (const agentId of agentIds) {
        if (agentId) {
          const agentVouchersCount = vouchersToDelete.filter(v => v.agentId === agentId).length;
          const profileName = vouchersToDelete.find(v => v.agentId === agentId)?.profile.name || 'Unknown';
          try {
            await prisma.agentNotification.create({
              data: {
                id: Math.random().toString(36).substring(2, 15),
                agentId: agentId,
                type: 'voucher_deleted',
                title: 'Voucher Dihapus',
                message: `Admin telah menghapus ${agentVouchersCount} voucher ${profileName} dari batch ${batchCode}.`,
                link: null,
              },
            })
          } catch (notifError) {
            console.error(`⚠️ Failed to create notification for agent:`, notifError)
          }
        }
      }

      // Remove from RADIUS
      for (const v of vouchersToDelete) {
        try {
          await removeVoucherFromRadius(v.code)
        } catch (error) {
          console.error(`Failed to remove ${v.code} from RADIUS:`, error)
        }
      }
      
      return NextResponse.json({
        message: `${result.count} unused vouchers deleted from batch`,
        count: result.count,
      })
    } else if (id) {
      // Delete single voucher
      const voucher = await prisma.hotspotVoucher.findUnique({
        where: { id },
      })

      if (!voucher) {
        return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      }

      if (voucher.status !== 'WAITING') {
        return NextResponse.json(
          { error: 'Cannot delete used/active voucher' },
          { status: 400 }
        )
      }

      await prisma.hotspotVoucher.delete({ where: { id } })

      // Send notification to agent if voucher belongs to agent
      if (voucher.agentId) {
        try {
          const voucherWithProfile = await prisma.hotspotVoucher.findFirst({
            where: { code: voucher.code },
            include: { profile: { select: { name: true } } }
          });
          const profileName = voucherWithProfile?.profile.name || 'Unknown';
          
          await prisma.agentNotification.create({
            data: {
              id: Math.random().toString(36).substring(2, 15),
              agentId: voucher.agentId,
              type: 'voucher_deleted',
              title: 'Voucher Dihapus',
              message: `Admin telah menghapus voucher ${voucher.code} (${profileName}).`,
              link: null,
            },
          })
        } catch (notifError) {
          console.error(`⚠️ Failed to create notification for agent:`, notifError)
        }
      }

      // Remove from RADIUS
      try {
        await removeVoucherFromRadius(voucher.code)
      } catch (error) {
        console.error('Failed to remove from RADIUS:', error)
      }
      
      return NextResponse.json({ message: 'Voucher deleted successfully' })
    }
  } catch (error) {
    console.error('Delete voucher error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
