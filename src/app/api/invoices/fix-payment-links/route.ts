import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Helper function to generate payment token
function generatePaymentToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/invoices/fix-payment-links
 * Generate payment tokens and links for invoices that don't have them
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get company base URL
    const company = await prisma.company.findFirst();
    const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Find invoices without payment token or payment link
    const invoicesWithoutToken = await prisma.invoice.findMany({
      where: {
        OR: [
          { paymentToken: null },
          { paymentLink: null },
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        paymentToken: true,
        paymentLink: true,
      },
    });

    console.log(`Found ${invoicesWithoutToken.length} invoices without payment tokens/links`);

    let updated = 0;
    const errors: string[] = [];

    for (const invoice of invoicesWithoutToken) {
      try {
        // Generate payment token if missing
        const paymentToken = invoice.paymentToken || generatePaymentToken();
        const paymentLink = `${baseUrl}/pay/${paymentToken}`;

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            paymentToken,
            paymentLink,
          },
        });

        updated++;
        console.log(`✅ Updated invoice ${invoice.invoiceNumber} with payment link: ${paymentLink}`);
      } catch (error: any) {
        errors.push(`${invoice.invoiceNumber}: ${error.message}`);
        console.error(`❌ Error updating invoice ${invoice.invoiceNumber}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} invoices with payment links`,
      updated,
      total: invoicesWithoutToken.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('Fix payment links error:', error);
    return NextResponse.json(
      { error: 'Failed to fix payment links', details: error.message },
      { status: 500 }
    );
  }
}
