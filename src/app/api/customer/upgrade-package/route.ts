import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

// Helper to verify customer token using CustomerSession
async function verifyCustomerToken(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return null;
    }

    // Find session by token
    const session = await prisma.customerSession.findFirst({
      where: {
        token,
        verified: true,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) {
      return null;
    }

    const user = await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
      include: { profile: true }
    });

    return user;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// POST - Create invoice for package upgrade
export async function POST(request: NextRequest) {
  try {
    const user = await verifyCustomerToken(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { packageId } = body;

    if (!packageId) {
      return NextResponse.json(
        { success: false, error: 'Package ID is required' },
        { status: 400 }
      );
    }

    // Get package details
    const package_data = await prisma.pppoeProfile.findUnique({
      where: { id: packageId }
    });

    if (!package_data) {
      return NextResponse.json(
        { success: false, error: 'Package not found' },
        { status: 404 }
      );
    }

    // Check if user already on this package
    if (user.profileId === packageId) {
      return NextResponse.json(
        { success: false, error: 'You are already on this package' },
        { status: 400 }
      );
    }

    // Get company settings for payment gateway
    const company = await prisma.company.findFirst();

    // Generate invoice number
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: `INV/${year}/${month}/${day}/`
        }
      },
      orderBy: {
        invoiceNumber: 'desc'
      }
    });

    let sequence = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('/');
      sequence = parseInt(parts[parts.length - 1]) + 1;
    }

    const invoiceNumber = `INV/${year}/${month}/${day}/${String(sequence).padStart(4, '0')}`;

    // Calculate due date (7 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    // Generate payment token for Tripay webhook compatibility
    const paymentTokenString = `${invoiceNumber}-${Date.now()}`;
    const paymentToken = crypto.createHash('sha256').update(paymentTokenString).digest('hex');

    // Create invoice with package upgrade metadata
    const invoice = await prisma.invoice.create({
      data: {
        id: nanoid(),
        invoiceNumber,
        userId: user.id,
        amount: package_data.price,
        status: 'PENDING',
        dueDate,
        customerName: user.name,
        customerPhone: user.phone,
        customerEmail: user.email,
        customerUsername: user.username,
        invoiceType: 'ADDON',
        baseAmount: package_data.price,
        paymentToken,
        additionalFees: {
          items: [
            {
              description: `Upgrade Paket ke ${package_data.name}`,
              quantity: 1,
              unitPrice: package_data.price,
              amount: package_data.price,
              metadata: {
                type: 'package_upgrade',
                newPackageId: packageId,
                newPackageName: package_data.name,
                oldPackageId: user.profileId,
                oldPackageName: user.profile?.name
              }
            }
          ]
        }
      }
    });

    // Generate payment link - use VPS production format
    const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const paymentLink = `${baseUrl}/pay/${paymentToken}`;

    // Update invoice with payment link
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { paymentLink }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        username: user.username,
        module: 'customer_upgrade',
        action: 'package_upgrade_request',
        description: `Customer requested package upgrade to ${package_data.name}`,
        metadata: JSON.stringify({ 
          invoiceId: invoice.id, 
          packageId, 
          packageName: package_data.name,
          amount: package_data.price
        }),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        paymentLink
      },
      paymentLink
    });

  } catch (error: any) {
    console.error('Package upgrade error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
