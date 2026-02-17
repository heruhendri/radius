import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get PPPoE user - try by email first, then by name
    let pppoeUser = await prisma.pppoeUser.findFirst({
      where: {
        OR: [
          { email: user.email },
          { name: user.name }
        ]
      }
    });

    // If still not found, get any pppoeUser (for testing)
    if (!pppoeUser) {
      pppoeUser = await prisma.pppoeUser.findFirst();
    }

    if (!pppoeUser) {
      return NextResponse.json({ error: 'PPPoE user not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const amount = parseInt(formData.get('amount') as string);
    const paymentMethod = formData.get('paymentMethod') as string;
    const note = formData.get('note') as string || '';
    const proofFile = formData.get('proof') as File;
    const timestamp = Date.now();

    if (isNaN(amount) || amount < 10000) {
      return NextResponse.json({ error: 'Minimum top-up adalah Rp 10.000' }, { status: 400 });
    }

    let proofPath: string | null = null;

    // Handle file upload
    if (proofFile && paymentMethod !== 'CASH') {
      const bytes = await proofFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const filename = `topup-${pppoeUser.id}-${timestamp}-${proofFile.name}`;
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'topup-proofs');
      
      // Create directory if not exists
      try {
        const fs = require('fs');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
      } catch (err) {
        console.error('Error creating upload directory:', err);
      }

      const filepath = join(uploadsDir, filename);
      await writeFile(filepath, buffer);
      proofPath = `/uploads/topup-proofs/${filename}`;
    }

    // Get or create INCOME category for deposits
    let depositCategory = await prisma.transactionCategory.findFirst({
      where: { name: 'DEPOSIT_REQUEST', type: 'INCOME' }
    });

    if (!depositCategory) {
      depositCategory = await prisma.transactionCategory.create({
        data: {
          id: `cat-${Date.now()}`,
          name: 'DEPOSIT_REQUEST',
          type: 'INCOME',
          description: 'Customer deposit/top-up requests',
          isActive: true
        }
      });
    }

    // Store request data in notes as JSON
    const requestData = {
      status: 'PENDING',
      pppoeUserId: pppoeUser.id,
      pppoeUsername: pppoeUser.username,
      requestedBy: user.name || pppoeUser.name,
      paymentMethod: paymentMethod,
      note: note,
      proofPath: proofPath,
      requestedAt: new Date().toISOString(),
    };

    // Create transaction request
    const transaction = await prisma.transaction.create({
      data: {
        id: `txn-${Date.now()}`,
        categoryId: depositCategory.id,
        amount: amount,
        type: 'INCOME',
        description: `Top-up request dari ${pppoeUser.name} (@${pppoeUser.username})`,
        reference: `TOPUP-${pppoeUser.id}-${timestamp}`,
        notes: JSON.stringify(requestData),
        createdBy: user.id,
      },
    });

    // TODO: Send notification to admin (WhatsApp/Email)
    // This can be implemented later with notification system

    return NextResponse.json({
      success: true,
      message: 'Permintaan top-up berhasil dikirim',
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        reference: transaction.reference,
        status: 'PENDING',
      },
    });

  } catch (error) {
    console.error('Top-up request error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses permintaan top-up' },
      { status: 500 }
    );
  }
}
