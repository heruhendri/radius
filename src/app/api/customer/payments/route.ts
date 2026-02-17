import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Customer Payments API
 * GET /api/customer/payments - Get payment history
 * POST /api/customer/payments - Create payment
 */

// Helper to verify customer token
async function verifyCustomerToken(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return null;

    const session = await prisma.customerSession.findFirst({
      where: {
        token,
        verified: true,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) return null;

    return await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// GET - Get customer payment history
export async function GET(request: NextRequest) {
  try {
    const user = await verifyCustomerToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Get payments (manual payments created by customer)
    const payments = await prisma.manualPayment.findMany({
      where: { 
        userId: user.id,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        invoiceId: true,
        amount: true,
        bankName: true,
        accountName: true,
        status: true,
        notes: true,
        receiptImage: true,
        createdAt: true,
        approvedAt: true,
        invoice: {
          select: {
            invoiceNumber: true,
            dueDate: true,
          },
        },
      },
    });

    const total = await prisma.manualPayment.count({
      where: { userId: user.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        payments: payments.map(p => ({
          id: p.id,
          invoiceId: p.invoiceId,
          invoiceNumber: p.invoice?.invoiceNumber || 'N/A',
          amount: Number(p.amount),
          method: p.bankName || 'bank_transfer',
          status: p.status.toLowerCase(),
          notes: p.notes,
          proofUrl: p.receiptImage,
          createdAt: p.createdAt.toISOString(),
          confirmedAt: p.approvedAt?.toISOString() || null,
          rejectedAt: null,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('Get payments error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan', error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create payment
export async function POST(request: NextRequest) {
  try {
    const user = await verifyCustomerToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { invoiceId, amount, method, notes } = await request.json();

    if (!invoiceId || !amount || !method) {
      return NextResponse.json(
        { success: false, message: 'Invoice ID, amount, dan metode pembayaran harus diisi' },
        { status: 400 }
      );
    }

    // Verify invoice belongs to user
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        userId: user.id,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: 'Invoice tidak ditemukan' },
        { status: 404 }
      );
    }

    // Create manual payment
    const payment = await prisma.manualPayment.create({
      data: {
        userId: user.id,
        invoiceId,
        amount: parseFloat(amount),
        bankName: method || 'Bank Transfer',
        accountName: user.name || 'Customer',
        paymentDate: new Date(),
        status: 'PENDING',
        notes: notes || null,
      },
      select: {
        id: true,
        invoiceId: true,
        amount: true,
        bankName: true,
        status: true,
        notes: true,
        createdAt: true,
        invoice: {
          select: {
            invoiceNumber: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Pembayaran berhasil dibuat. Menunggu konfirmasi admin.',
      data: {
        id: payment.id,
        invoiceId: payment.invoiceId,
        invoiceNumber: payment.invoice?.invoiceNumber || 'N/A',
        amount: Number(payment.amount),
        method: payment.bankName,
        status: payment.status.toLowerCase(),
        notes: payment.notes,
        createdAt: payment.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Create payment error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan', error: error.message },
      { status: 500 }
    );
  }
}
