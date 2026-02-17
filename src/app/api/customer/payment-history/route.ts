import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
      include: { profile: true }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// GET - Get customer payment history (all invoices)
export async function GET(request: NextRequest) {
  try {
    const user = await verifyCustomerToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all invoices for this user
    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        status: true,
        dueDate: true,
        paidAt: true,
        paymentToken: true,
        paymentLink: true,
        createdAt: true,
      }
    });

    return NextResponse.json({
      success: true,
      payments: invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        status: inv.status,
        dueDate: inv.dueDate.toISOString(),
        paidAt: inv.paidAt?.toISOString() || null,
        paymentToken: inv.paymentToken,
        paymentLink: inv.paymentLink,
        createdAt: inv.createdAt.toISOString(),
      }))
    });

  } catch (error: any) {
    console.error('Payment history error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
