import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateInvoiceNumber, generateInvoiceId, generateTransactionId, generateCategoryId } from '@/lib/invoice-generator';
import crypto from 'crypto';

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
    const { profileId } = await request.json();

    // Get user data
    const user = await prisma.pppoeUser.findUnique({
      where: { id },
      include: { profile: true, area: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get new profile
    const newProfile = await prisma.pppoeProfile.findUnique({
      where: { id: profileId },
    });

    if (!newProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profileChanged = user.profileId !== profileId;
    const now = new Date();
    const currentExpired = user.expiredAt ? new Date(user.expiredAt) : now;
    
    // Calculate new expiry date (extend from current expiry or now, whichever is later)
    const baseDate = currentExpired > now ? currentExpired : now;
    const newExpiredAt = new Date(baseDate);
    newExpiredAt.setMonth(newExpiredAt.getMonth() + 1); // Extend by 1 month

    // Update user
    const updatedUser = await prisma.pppoeUser.update({
      where: { id },
      data: {
        profileId,
        expiredAt: newExpiredAt,
        status: 'active',
      },
    });

    // Create invoice record (already PAID)
    const invoiceNumber = await generateInvoiceNumber();
    
    // Generate payment token and link for record keeping
    const company = await prisma.company.findFirst();
    const baseUrl = company?.baseUrl || 'http://localhost:3000';
    const paymentToken = crypto.randomBytes(32).toString('hex');
    const paymentLink = `${baseUrl}/pay/${paymentToken}`;
    
    await prisma.invoice.create({
      data: {
        id: generateInvoiceId(),
        invoiceNumber,
        userId: id,
        amount: newProfile.price,
        status: 'PAID',
        dueDate: newExpiredAt,
        paidAt: now,
        customerName: user.name,
        customerPhone: user.phone,
        customerUsername: user.username,
        paymentToken,
        paymentLink,
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

    // Create transaction record
    await prisma.transaction.create({
      data: {
        id: await generateTransactionId(),
        categoryId: category.id,
        type: 'INCOME',
        amount: newProfile.price,
        description: `Perpanjangan langganan ${user.username} - ${newProfile.name}${profileChanged ? ' (paket diubah)' : ''}`,
        reference: invoiceNumber,
        date: now,
      },
    });

    const extendedDays = Math.ceil((newExpiredAt.getTime() - currentExpired.getTime()) / (1000 * 60 * 60 * 24));
    
    // Format data for template variables
    const formattedExpiredAt = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(newExpiredAt);
    
    const formattedAmount = new Intl.NumberFormat('id-ID').format(newProfile.price);

    // Send WhatsApp notification if phone available
    if (user.phone) {
      try {
        const { WhatsAppService } = await import('@/lib/whatsapp');
        
        // Get template from database (customizable via UI)
        const template = await prisma.whatsapp_templates.findFirst({
          where: { type: 'manual-extension', isActive: true },
        });
        
        if (template) {
          // Replace template variables
          let message = template.message;
          message = message.replace(/\{\{customerName\}\}/g, user.name);
          message = message.replace(/\{\{customerUsername\}\}/g, user.username);
          message = message.replace(/\{\{profileName\}\}/g, newProfile.name);
          message = message.replace(/\{\{area\}\}/g, (user as any).area?.name || '-');
          message = message.replace(/\{\{amount\}\}/g, formattedAmount);
          message = message.replace(/\{\{newExpiredAt\}\}/g, formattedExpiredAt);
          message = message.replace(/\{\{invoiceNumber\}\}/g, invoiceNumber);
          message = message.replace(/\{\{companyName\}\}/g, company?.name || 'Billing System');
          message = message.replace(/\{\{companyPhone\}\}/g, company?.phone || '');
          
          // Handle conditional profileChanged
          if (profileChanged) {
            message = message.replace(/\{\{#profileChanged\}\}([\s\S]*?)\{\{\/profileChanged\}\}/g, '$1');
          } else {
            message = message.replace(/\{\{#profileChanged\}\}[\s\S]*?\{\{\/profileChanged\}\}/g, '');
          }
          
          await WhatsAppService.sendMessage({ phone: user.phone, message });
          console.log(`[Extend] WhatsApp notification sent to ${user.phone}`);
        }
      } catch (waError) {
        console.error('[Extend] WhatsApp notification failed:', waError);
        // Don't fail the whole request if notification fails
      }
    }

    // Send Email notification if email available
    if (user.email) {
      try {
        const { EmailService } = await import('@/lib/email');
        
        // Get template from database (customizable via UI)
        const template = await prisma.emailTemplate.findFirst({
          where: { type: 'manual-extension', isActive: true },
        });
        
        if (template) {
          // Replace template variables
          let htmlContent = template.htmlBody;
          htmlContent = htmlContent.replace(/\{\{customerName\}\}/g, user.name);
          htmlContent = htmlContent.replace(/\{\{customerUsername\}\}/g, user.username);
          htmlContent = htmlContent.replace(/\{\{profileName\}\}/g, newProfile.name);
          htmlContent = htmlContent.replace(/\{\{area\}\}/g, (user as any).area?.name || '-');
          htmlContent = htmlContent.replace(/\{\{amount\}\}/g, formattedAmount);
          htmlContent = htmlContent.replace(/\{\{newExpiredAt\}\}/g, formattedExpiredAt);
          htmlContent = htmlContent.replace(/\{\{invoiceNumber\}\}/g, invoiceNumber);
          htmlContent = htmlContent.replace(/\{\{companyName\}\}/g, company?.name || 'Billing System');
          htmlContent = htmlContent.replace(/\{\{companyPhone\}\}/g, company?.phone || '');
          
          // Handle conditional profileChanged
          if (profileChanged) {
            htmlContent = htmlContent.replace(/\{\{#profileChanged\}\}([\s\S]*?)\{\{\/profileChanged\}\}/g, '$1');
          } else {
            htmlContent = htmlContent.replace(/\{\{#profileChanged\}\}[\s\S]*?\{\{\/profileChanged\}\}/g, '');
          }
          
          let subject = template.subject;
          subject = subject.replace(/\{\{companyName\}\}/g, company?.name || 'Billing System');
          
          await EmailService.send({
            to: user.email,
            subject,
            html: htmlContent,
          });
          console.log(`[Extend] Email notification sent to ${user.email}`);
        }
      } catch (emailError) {
        console.error('[Extend] Email notification failed:', emailError);
        // Don't fail the whole request if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      extended: `${extendedDays} hari`,
      amount: newProfile.price,
      profileChanged,
      newExpiredAt: newExpiredAt.toISOString(),
      notificationSent: {
        whatsapp: !!user.phone,
        email: !!user.email,
      },
    });
  } catch (error) {
    console.error('Extend error:', error);
    return NextResponse.json(
      { error: 'Failed to extend subscription' },
      { status: 500 }
    );
  }
}
