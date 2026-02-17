import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { nowWIB, formatWIB, startOfDayWIBtoUTC, endOfDayWIBtoUTC } from '@/lib/timezone';

/**
 * POST /api/cron/test-reminder - Force test invoice reminder (skip time check)
 */
export async function POST(request: NextRequest) {
  try {
    const startedAt = new Date();
    
    // Get reminder settings
    const settings = await prisma.whatsapp_reminder_settings.findFirst();
    
    console.log('[Test Reminder] Settings:', settings);
    
    if (!settings) {
      return NextResponse.json({
        success: false,
        error: 'No reminder settings found. Please configure in WhatsApp Notifications.'
      });
    }
    
    if (!settings.enabled) {
      return NextResponse.json({
        success: false,
        error: 'Reminder is disabled. Enable it in WhatsApp Notifications settings.'
      });
    }
    
    const reminderDays: number[] = JSON.parse(settings.reminderDays);
    
    // Also add overdue reminders: days after due date (positive values = days after due)
    // Comprehensive coverage: 1-10, 14, 21, 28 days overdue
    const overdueDays = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 21, 28];
    const allReminderDays = [...reminderDays, ...overdueDays];
    
    let sentCount = 0;
    let skippedCount = 0;
    const results: any[] = [];
    
    console.log(`[Test Reminder] Processing ${allReminderDays.length} reminder schedules...`);
    console.log(`[Test Reminder] Reminder days configured:`, reminderDays);
    console.log(`[Test Reminder] Overdue reminder days:`, overdueDays);
    
    // For each reminder day, find invoices that match
    for (const reminderDay of allReminderDays) {
      // Calculate target due date in WIB
      const nowInWIB = nowWIB();
      const targetDateWIB = new Date(nowInWIB);
      targetDateWIB.setDate(targetDateWIB.getDate() - reminderDay);
      targetDateWIB.setHours(0, 0, 0, 0);
      
      // Convert WIB date boundaries to UTC for database query
      const targetDateUTC = startOfDayWIBtoUTC(targetDateWIB);
      const nextDayUTC = endOfDayWIBtoUTC(targetDateWIB);
      
      console.log(`[Test Reminder] Checking H${reminderDay}: Looking for invoices due on ${formatWIB(targetDateWIB, 'yyyy-MM-dd')} WIB`);
      console.log(`[Test Reminder] UTC range: ${targetDateUTC.toISOString()} to ${nextDayUTC.toISOString()}`);
      
      // Find unpaid invoices (PENDING or OVERDUE) with dueDate matching target
      const invoices = await prisma.invoice.findMany({
        where: {
          status: {
            in: ['PENDING', 'OVERDUE']
          },
          dueDate: {
            gte: targetDateUTC,
            lt: nextDayUTC
          }
        },
        include: {
          user: {
            include: {
              profile: true,
              area: true
            }
          }
        }
      });
      
      console.log(`[Test Reminder] Found ${invoices.length} invoices for H${reminderDay}`);
      
      if (invoices.length === 0) {
        results.push({
          reminderDay,
          targetDate: formatWIB(targetDateWIB, 'yyyy-MM-dd'),
          found: 0,
          sent: 0,
          skipped: 0
        });
        continue;
      }
      
      // Get company info
      const company = await prisma.company.findFirst();
      
      if (!company) {
        console.log(`[Test Reminder] No company info found`);
        skippedCount += invoices.length;
        results.push({
          reminderDay,
          targetDate: formatWIB(targetDateWIB, 'yyyy-MM-dd'),
          found: invoices.length,
          sent: 0,
          skipped: invoices.length,
          error: 'No company info'
        });
        continue;
      }
      
      // Prepare messages
      const messagesToSend: Array<{
        phone: string;
        message: string;
        data: {
          invoice: typeof invoices[0];
          reminderDay: number;
        };
      }> = [];
      
      for (const invoice of invoices) {
        // Check if already sent for this reminder day
        const sentReminders = invoice.sentReminders 
          ? JSON.parse(invoice.sentReminders) 
          : [];
        
        if (sentReminders.includes(reminderDay)) {
          console.log(`[Test Reminder] Skipped ${invoice.invoiceNumber}: H${reminderDay} already sent`);
          skippedCount++;
          continue;
        }
        
        if (!invoice.customerPhone) {
          console.log(`[Test Reminder] Skipped ${invoice.invoiceNumber}: No customer phone`);
          skippedCount++;
          continue;
        }
        
        messagesToSend.push({
          phone: invoice.customerPhone,
          message: '', // Message will be generated in sendFunction
          data: { invoice, reminderDay }
        });
      }
      
      // Send messages with rate limiting
      if (messagesToSend.length > 0) {
        console.log(`[Test Reminder] Sending ${messagesToSend.length} reminders...`);
        
        const { sendWithRateLimit } = await import('@/lib/utils/rateLimiter');
        const { sendInvoiceReminder } = await import('@/lib/whatsapp-notifications');
        
        const result = await sendWithRateLimit(
          messagesToSend,
          async (msg) => {
            const { invoice, reminderDay } = msg.data;
            
            // Determine if overdue (reminderDay > 0 means days after due date)
            const isOverdue = reminderDay > 0;
            
            // Get customer name with proper fallback
            const customerName = invoice.customerName || invoice.user?.name || 'Pelanggan';
            
            // Send WhatsApp reminder with appropriate template
            await sendInvoiceReminder({
              phone: invoice.customerPhone!,
              customerName: customerName,
              customerUsername: invoice.customerUsername || invoice.user?.username,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              dueDate: invoice.dueDate,
              paymentLink: invoice.paymentLink || '',
              companyName: company.name,
              companyPhone: company.phone || '',
              isOverdue: isOverdue,
              profileName: (invoice.user as any)?.profile?.name,
              area: (invoice.user as any)?.area?.name
            });

            // Also send email reminder if email is available
            const customerEmail = invoice.customerEmail || invoice.user?.email;
            if (customerEmail) {
              try {
                const { EmailService } = await import('@/lib/email');
                await EmailService.sendInvoiceReminder({
                  email: customerEmail,
                  customerName: customerName,
                  customerUsername: invoice.customerUsername || invoice.user?.username,
                  invoiceNumber: invoice.invoiceNumber,
                  amount: invoice.amount,
                  dueDate: invoice.dueDate,
                  paymentLink: invoice.paymentLink || '',
                  companyName: company.name,
                  companyPhone: company.phone || '',
                  isOverdue: isOverdue,
                  daysOverdue: isOverdue ? reminderDay : undefined,
                  profileName: (invoice.user as any)?.profile?.name,
                  area: (invoice.user as any)?.area?.name
                });
                console.log(`[Test Reminder] Email sent for ${invoice.invoiceNumber} to ${customerEmail}`);
              } catch (emailError) {
                console.error(`[Test Reminder] Email error for ${invoice.invoiceNumber}:`, emailError);
                // Don't fail the whole process if email fails
              }
            }
            
            // Mark as sent
            const sentReminders = invoice.sentReminders 
              ? JSON.parse(invoice.sentReminders) 
              : [];
            sentReminders.push(reminderDay);
            
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                sentReminders: JSON.stringify(sentReminders)
              }
            });
          }
        );
        
        sentCount += result.sent;
        skippedCount += result.failed;
        
        results.push({
          reminderDay,
          targetDate: formatWIB(targetDateWIB, 'yyyy-MM-dd'),
          found: invoices.length,
          sent: result.sent,
          failed: result.failed
        });
        
        console.log(`[Test Reminder] H${reminderDay} completed: ${result.sent} sent, ${result.failed} failed`);
      } else {
        results.push({
          reminderDay,
          targetDate: formatWIB(targetDateWIB, 'yyyy-MM-dd'),
          found: invoices.length,
          sent: 0,
          skipped: invoices.length
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      sent: sentCount,
      skipped: skippedCount,
      results,
      settings: {
        enabled: settings.enabled,
        reminderDays: reminderDays,
        reminderTime: settings.reminderTime
      }
    });
    
  } catch (error: any) {
    console.error('[Test Reminder] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
