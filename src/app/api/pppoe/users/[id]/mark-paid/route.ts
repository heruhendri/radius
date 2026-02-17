import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateTransactionId, generateCategoryId } from '@/lib/invoice-generator';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Get unpaid invoices for user
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        userId: id,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (unpaidInvoices.length === 0) {
      return NextResponse.json(
        { error: 'No unpaid invoices found' },
        { status: 404 }
      );
    }

    const now = new Date();
    const markedCount = unpaidInvoices.length;
    const totalAmount = unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    // Mark all unpaid invoices as paid
    await prisma.invoice.updateMany({
      where: {
        userId: id,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      data: {
        status: 'PAID',
        paidAt: now,
      },
    });

    // Find or create transaction category for subscription
    let category = await prisma.transactionCategory.findFirst({
      where: { name: 'Subscription', type: 'INCOME' },
    });
    
    if (!category) {
      category = await prisma.transactionCategory.create({
        data: {
          id: generateCategoryId(),
          name: 'Subscription',
          type: 'INCOME',
        },
      });
    }

    // Create transaction records
    for (const invoice of unpaidInvoices) {
      await prisma.transaction.create({
        data: {
          id: await generateTransactionId(),
          categoryId: category.id,
          type: 'INCOME',
          amount: invoice.amount,
          description: `Pembayaran tagihan ${invoice.invoiceNumber}`,
          reference: invoice.invoiceNumber,
          date: now,
        },
      });
    }

    // Update user status to active
    await prisma.pppoeUser.update({
      where: { id },
      data: { status: 'active' },
    });

    return NextResponse.json({
      success: true,
      markedCount,
      totalAmount,
      message: `${markedCount} tagihan telah dibayar (Total: Rp ${totalAmount.toLocaleString('id-ID')})`,
    });
  } catch (error) {
    console.error('Mark paid error:', error);
    return NextResponse.json(
      { error: 'Failed to mark invoices as paid' },
      { status: 500 }
    );
  }
}
