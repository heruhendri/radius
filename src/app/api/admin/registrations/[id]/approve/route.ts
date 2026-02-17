import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { genCustomerId } from '@/lib/utils';
import { sendRegistrationApproval } from '@/lib/whatsapp-notifications';
import crypto from 'crypto';

// Helper to generate username from name and phone
function generateUsername(name: string, phone: string): string {
  const namePart = name
    .split(' ')[0]
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  return `${namePart}-${phone}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { installationFee = 0, subscriptionType = 'POSTPAID', billingDay = 1 } = body;

    // Installation fee is optional, default to 0
    const fee = installationFee || 0;
    
    // Validate subscriptionType
    if (!['POSTPAID', 'PREPAID'].includes(subscriptionType)) {
      return NextResponse.json(
        { error: 'Invalid subscription type' },
        { status: 400 }
      );
    }
    
    // Validate billingDay (1-31)
    const validBillingDay = Math.min(Math.max(parseInt(billingDay) || 1, 1), 31);

    // Get registration
    const registration = await prisma.registrationRequest.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    if (registration.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Registration is not pending' },
        { status: 400 }
      );
    }

    // Generate username and password
    const username = generateUsername(registration.name, registration.phone);
    const password = username;

    // Check if username already exists
    const existingUser = await prisma.pppoeUser.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists. Please contact admin.' },
        { status: 400 }
      );
    }

    // Generate unique customerId
    async function generateUniqueCustomerId() {
      for (let i = 0; i < 10; i++) {
        const candidate = genCustomerId();
        const exists = await prisma.pppoeUser.findFirst({ where: { customerId: candidate } as any });
        if (!exists) return candidate;
      }
      while (true) {
        const candidate = genCustomerId();
        const exists = await prisma.pppoeUser.findFirst({ where: { customerId: candidate } as any });
        if (!exists) return candidate;
      }
    }

    const customerId = await generateUniqueCustomerId();

    // Calculate expiredAt based on subscription type
    let expiredAt: Date;
    const now = new Date();
    
    if (subscriptionType === 'POSTPAID') {
      // POSTPAID: expiredAt = billingDay bulan berikutnya
      expiredAt = new Date(now);
      expiredAt.setMonth(expiredAt.getMonth() + 1); // Next month
      expiredAt.setDate(validBillingDay); // Set to billing day
      expiredAt.setHours(23, 59, 59, 999);
    } else {
      // PREPAID: expiredAt = now + validity dari profile
      expiredAt = new Date(now);
      if (registration.profile.validityUnit === 'MONTHS') {
        expiredAt.setMonth(expiredAt.getMonth() + registration.profile.validityValue);
      } else {
        expiredAt.setDate(expiredAt.getDate() + registration.profile.validityValue);
      }
      expiredAt.setHours(23, 59, 59, 999);
    }

    // Create PPPoE user
    const pppoeUser = await prisma.pppoeUser.create({
      data: {
        id: crypto.randomUUID(),
        username,
        customerId,
        password,
        name: registration.name,
        phone: registration.phone,
        email: registration.email,
        address: registration.address,
        profileId: registration.profileId,
        status: 'active', // Create as active first
        syncedToRadius: false,
        subscriptionType: subscriptionType as 'POSTPAID' | 'PREPAID',
        billingDay: validBillingDay,
        expiredAt: expiredAt,
      } as any,
    });

    // Sync to RADIUS (radcheck + radusergroup)
    // Password
    await prisma.radcheck.upsert({
      where: {
        username_attribute: {
          username,
          attribute: 'Cleartext-Password',
        },
      },
      create: {
        username,
        attribute: 'Cleartext-Password',
        op: ':=',
        value: password,
      },
      update: {
        value: password,
      },
    });

    // Add to group
    await prisma.radusergroup.upsert({
      where: {
        username_groupname: {
          username,
          groupname: registration.profile.groupName,
        },
      },
      create: {
        username,
        groupname: registration.profile.groupName,
        priority: 1,
      },
      update: {
        groupname: registration.profile.groupName,
      },
    });

    // Mark as synced
    await prisma.pppoeUser.update({
      where: { id: pppoeUser.id },
      data: { syncedToRadius: true },
    });

    // Now set to isolated
    await prisma.pppoeUser.update({
      where: { id: pppoeUser.id },
      data: { status: 'isolated' },
    });

    // Add isolated attribute to RADIUS (limit speed or access)
    // This can be customized based on your RADIUS setup
    await prisma.radreply.create({
      data: {
        username,
        attribute: 'Reply-Message',
        op: ':=',
        value: 'Account pending payment. Please pay installation invoice.',
      },
    });

    // Generate invoice number: INV-YYYYMM-XXXX
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;
    
    const count = await prisma.invoice.count({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
    });
    
    const invoiceNumber = `${prefix}${String(count + 1).padStart(4, '0')}`;

    // Calculate invoice amounts based on subscription type
    let totalAmount: number;
    let invoiceType: string;
    
    if (subscriptionType === 'PREPAID') {
      // PREPAID: installation + first month subscription
      totalAmount = Math.round(Number(fee)) + registration.profile.price;
      invoiceType = 'INSTALLATION';
    } else {
      // POSTPAID: installation only
      totalAmount = Math.round(Number(fee));
      invoiceType = 'INSTALLATION';
    }

    // Get company baseUrl from database
    const company = await prisma.company.findFirst();
    const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Generate payment token and link
    const paymentToken = crypto.randomBytes(32).toString('hex');
    const paymentLink = `${baseUrl}/pay/${paymentToken}`;

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        id: crypto.randomUUID(),
        invoiceNumber,
        userId: pppoeUser.id,
        amount: totalAmount,
        baseAmount: totalAmount, // Set base amount same as total for now
        status: 'PENDING',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        customerName: registration.name,
        customerPhone: registration.phone,
        customerUsername: pppoeUser.username,
        paymentToken,
        paymentLink,
        invoiceType: invoiceType as any,
      },
    });

    // Update registration
    await prisma.registrationRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        installationFee: fee,
        pppoeUserId: pppoeUser.id,
        invoiceId: invoice.id,
      },
    });

    // Send WhatsApp notification
    await sendRegistrationApproval({
      customerName: registration.name,
      customerPhone: registration.phone,
      username: pppoeUser.username,
      password: pppoeUser.password,
      profileName: registration.profile.name,
      installationFee: Math.round(Number(fee)),
    });

    // Send Email notification
    if (registration.email) {
      try {
        const { EmailService } = await import('@/lib/email');
        await EmailService.sendRegistrationApprovalEmail({
          toEmail: registration.email,
          toName: registration.name,
          username: pppoeUser.username,
          password: pppoeUser.password,
          profile: registration.profile.name,
          installationFee: Math.round(Number(fee)),
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: totalAmount,
          dueDate: invoice.dueDate,
          paymentLink: paymentLink,
          paymentToken: paymentToken,
          subscriptionType: subscriptionType as 'POSTPAID' | 'PREPAID',
        });
        console.log('[Email] Registration approval sent to:', registration.email);
      } catch (emailError) {
        console.error('[Email] Failed to send registration approval:', emailError);
        // Don't fail the whole approval if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Registration approved and PPPoE user created',
      pppoeUser: {
        id: pppoeUser.id,
        username: pppoeUser.username,
        password: pppoeUser.password,
        status: pppoeUser.status,
        subscriptionType: subscriptionType,
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: totalAmount,
        paymentLink,
      },
    });
  } catch (error: any) {
    console.error('Approve registration error:', error);
    return NextResponse.json(
      { error: 'Failed to approve registration' },
      { status: 500 }
    );
  }
}
