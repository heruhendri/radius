import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { syncBatchToRadius } from '@/lib/hotspot-radius-sync';
import { logActivity } from '@/lib/activity-log';

const prisma = new PrismaClient();

// POST - Generate voucher by agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, profileId, quantity = 1 } = body;

    if (!agentId || !profileId) {
      return NextResponse.json(
        { error: 'Agent ID and Profile ID are required' },
        { status: 400 }
      );
    }

    // Verify agent and get router info
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        router: {
          select: {
            id: true,
            name: true,
            nasname: true,
          },
        },
      },
    });

    if (!agent || !agent.isActive) {
      return NextResponse.json(
        { error: 'Agent not found or inactive' },
        { status: 403 }
      );
    }

    // Check if agent has router assigned
    if (!agent.routerId) {
      return NextResponse.json(
        { error: 'Agent does not have a router assigned. Please contact admin.' },
        { status: 400 }
      );
    }

    // Verify profile and check agentAccess
    const profile = await prisma.hotspotProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.agentAccess) {
      return NextResponse.json(
        { error: 'This profile is not available for agents' },
        { status: 403 }
      );
    }

    // Calculate total cost (costPrice per voucher)
    const totalCost = profile.costPrice * quantity;

    // Check agent balance
    if (agent.balance < totalCost) {
      return NextResponse.json(
        { 
          error: 'Insufficient balance', 
          required: totalCost,
          current: agent.balance,
          deficit: totalCost - agent.balance
        },
        { status: 400 }
      );
    }

    // Check minimum balance requirement
    if (agent.balance - totalCost < agent.minBalance) {
      return NextResponse.json(
        { 
          error: `Balance cannot go below minimum balance of ${agent.minBalance}`,
          required: totalCost + agent.minBalance,
          current: agent.balance
        },
        { status: 400 }
      );
    }

    // Generate batch code: AGENTNAME-TIMESTAMP
    const batchCode = `${agent.name.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${Date.now()}`;
    
    // Generate vouchers
    const vouchers = [];

    for (let i = 0; i < quantity; i++) {
      // Generate unique code
      const code = generateVoucherCode();

      // Create voucher with batch code, agentId, and routerId
      const voucher = await prisma.hotspotVoucher.create({
        data: {
          id: crypto.randomUUID(),
          code,
          profileId: profile.id,
          routerId: agent.routerId, // Link voucher to agent's router
          agentId: agentId, // Link voucher to agent
          batchCode: batchCode,
          status: 'WAITING',
        },
      });

      vouchers.push(voucher);
    }

    // Deduct balance from agent
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        balance: {
          decrement: totalCost,
        },
      },
    });

    // Record agent sales immediately (agent has paid costPrice)
    // resellerFee is agent's profit margin (sellingPrice - costPrice)
    for (const voucher of vouchers) {
      try {
        await prisma.agentSale.create({
          data: {
            id: crypto.randomUUID(),
            agentId: agentId,
            voucherCode: voucher.code,
            profileName: profile.name,
            amount: profile.resellerFee, // Agent profit per voucher
            createdAt: new Date(),
          },
        });
      } catch (saleError) {
        console.error(`Failed to record sale for ${voucher.code}:`, saleError);
      }
    }

    // Auto-sync to RADIUS (same as admin)
    try {
      const syncResult = await syncBatchToRadius(batchCode);
      console.log(`Agent vouchers synced: ${syncResult.successCount}/${syncResult.total} to RADIUS`);
    } catch (syncError) {
      console.error('RADIUS sync error:', syncError);
      // Don't fail the request if sync fails
    }

    // Get updated agent balance
    const updatedAgent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { balance: true },
    });

    // Create notification for agent
    await prisma.agentNotification.create({
      data: {
        id: Math.random().toString(36).substring(2, 15),
        agentId: agentId,
        type: 'voucher_generated',
        title: 'Voucher Berhasil Dibuat',
        message: `${quantity} voucher ${profile.name} berhasil dibuat. Biaya: Rp ${totalCost.toLocaleString('id-ID')}. Saldo: Rp ${(updatedAgent?.balance || 0).toLocaleString('id-ID')}`,
        link: null,
      },
    });

    // Create notification for admin about agent voucher generation
    await prisma.notification.create({
      data: {
        id: Math.random().toString(36).substring(2, 15),
        type: 'agent_voucher_generated',
        title: 'Agent Generate Voucher',
        message: `${agent.name} generate ${quantity} voucher ${profile.name} (Total: Rp ${totalCost.toLocaleString('id-ID')})`,
        link: '/admin/hotspot/agent',
      },
    });

    // Check if balance is low (below minimum + 20%)
    const lowBalanceThreshold = agent.minBalance * 1.2;
    if ((updatedAgent?.balance || 0) < lowBalanceThreshold) {
      await prisma.agentNotification.create({
        data: {
          id: Math.random().toString(36).substring(2, 15),
          agentId: agentId,
          type: 'low_balance',
          title: 'Saldo Menipis',
          message: `Saldo Anda: Rp ${(updatedAgent?.balance || 0).toLocaleString('id-ID')}. Segera top up untuk terus generate voucher.`,
          link: null,
        },
      });
    }

    // Log activity
    try {
      await logActivity({
        username: agent.name,
        userRole: 'AGENT',
        action: 'AGENT_GENERATE_VOUCHER',
        description: `Agent ${agent.name} generated ${quantity} vouchers (${profile.name})`,
        module: 'agent',
        status: 'success',
        metadata: {
          agentId: agent.id,
          quantity,
          profileName: profile.name,
          costPrice: totalCost,
          newBalance: updatedAgent?.balance || 0,
          batchCode,
        },
      });
    } catch (logError) {
      console.error('Activity log error:', logError);
    }

    return NextResponse.json({
      success: true,
      vouchers,
      batchCode,
      cost: totalCost,
      newBalance: updatedAgent?.balance || 0,
      message: `${vouchers.length} vouchers generated. Balance deducted: ${totalCost}`,
    });
  } catch (error) {
    console.error('Generate voucher error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
