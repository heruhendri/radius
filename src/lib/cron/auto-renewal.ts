import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { sendAutoRenewalSuccess } from '@/lib/whatsapp-notifications'
import { sendAutoRenewalEmail } from '@/lib/email'

/**
 * Auto-renewal for PREPAID users with balance
 * Runs daily to check users nearing expiry
 */
export async function processAutoRenewal() {
  console.log('[Auto-Renewal] Starting auto-renewal process...')

  const startedAt = new Date()
  
  // Create cron history record
  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'auto_renewal',
      status: 'running',
      startedAt,
    },
  })

  try {
    // Find prepaid users with:
    // 1. autoRenewal = true
    // 2. expiredAt within next 3 days
    // 3. balance >= package price
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const users = await prisma.pppoeUser.findMany({
      where: {
        status: { in: ['active', 'isolated'] },
        subscriptionType: 'PREPAID',
        autoRenewal: true,
        expiredAt: {
          gte: new Date(), // Not expired yet
          lte: threeDaysFromNow // Expiring within 3 days
        }
      },
      include: {
        profile: true,
        invoices: {
          where: {
            status: { in: ['PENDING', 'OVERDUE'] }
          }
        }
      }
    })

    console.log(`[Auto-Renewal] Found ${users.length} users eligible for auto-renewal`)

    let successCount = 0
    let failedCount = 0

    for (const user of users) {
      try {
        // Check if user has enough balance
        const packagePrice = user.profile.price
        
        if (user.balance < packagePrice) {
          console.log(`[Auto-Renewal] User ${user.username} - Insufficient balance (${user.balance} < ${packagePrice})`)
          failedCount++
          continue
        }

        // Check if there's already a pending invoice for renewal
        const existingRenewalInvoice = user.invoices.find(inv => 
          inv.invoiceType === 'RENEWAL'
        )

        if (existingRenewalInvoice) {
          console.log(`[Auto-Renewal] User ${user.username} - Already has pending renewal invoice`)
          
          // Try to pay from balance
          await payInvoiceFromBalance(user, existingRenewalInvoice)
          successCount++
          continue
        }

        // Create renewal invoice
        const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${nanoid(8).toUpperCase()}`
        
        const invoice = await prisma.invoice.create({
          data: {
            id: nanoid(),
            invoiceNumber,
            userId: user.id,
            amount: packagePrice,
            dueDate: user.expiredAt!,
            status: 'PENDING',
            invoiceType: 'RENEWAL',
            customerName: user.name || user.username,
            customerPhone: user.phone,
            customerUsername: user.username,
            createdAt: new Date()
          }
        })

        console.log(`[Auto-Renewal] Created invoice ${invoiceNumber} for ${user.username}`)

        // Auto-pay from balance
        await payInvoiceFromBalance(user, invoice)
        successCount++

      } catch (error: any) {
        console.error(`[Auto-Renewal] Failed for user ${user.username}:`, error.message)
        failedCount++
      }
    }

    console.log(`[Auto-Renewal] Completed. Success: ${successCount}, Failed: ${failedCount}`)

    // Update cron history with success
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Processed ${users.length} users, paid ${successCount}, failed ${failedCount}`,
      },
    })

    return {
      processed: users.length,
      success: successCount,
      failed: failedCount
    }

  } catch (error: any) {
    console.error('[Auto-Renewal] Error:', error)
    
    // Update cron history with error
    const completedAt = new Date()
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: error.message,
      },
    })
    
    throw error
  }
}

/**
 * Pay invoice from user balance
 */
async function payInvoiceFromBalance(user: any, invoice: any) {
  const packagePrice = invoice.amount

  if (user.balance < packagePrice) {
    console.log(`[Auto-Payment] User ${user.username} - Insufficient balance`)
    return false
  }

  try {
    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Deduct balance
      const updatedUser = await tx.pppoeUser.update({
        where: { id: user.id },
        data: {
          balance: {
            decrement: packagePrice
          }
        }
      })

      // 2. Mark invoice as paid
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      })

      // 3. Extend expiredAt (for prepaid)
      const validity = user.profile.validityValue
      const unit = user.profile.validityUnit
      
      const newExpiredAt = new Date(user.expiredAt || new Date())
      if (unit === 'MONTHS') {
        newExpiredAt.setMonth(newExpiredAt.getMonth() + validity)
      } else if (unit === 'DAYS') {
        newExpiredAt.setDate(newExpiredAt.getDate() + validity)
      }

      await tx.pppoeUser.update({
        where: { id: user.id },
        data: {
          expiredAt: newExpiredAt,
          status: 'active' // Restore if isolated
        }
      })

      // 4. Create transaction record
      // First get or create the SUBSCRIPTION category
      let category = await tx.transactionCategory.findFirst({
        where: { name: 'Pembayaran Langganan' }
      })

      if (!category) {
        category = await tx.transactionCategory.create({
          data: {
            id: nanoid(),
            name: 'Pembayaran Langganan',
            type: 'INCOME',
            description: 'Pembayaran langganan pelanggan'
          }
        })
      }

      await tx.transaction.create({
        data: {
          id: nanoid(),
          categoryId: category.id,
          amount: packagePrice,
          type: 'INCOME',
          description: `Auto-payment dari saldo untuk invoice ${invoice.invoiceNumber}`,
          reference: invoice.invoiceNumber,
          notes: `User: ${user.username}, Balance payment`,
          createdBy: 'system',
          date: new Date(),
          createdAt: new Date(),
        }
      })

      console.log(`[Auto-Payment] ✅ User ${user.username} - Paid ${packagePrice} from balance. New balance: ${updatedUser.balance}. New expiry: ${newExpiredAt.toISOString()}`)

      return { user: updatedUser, newExpiredAt }
    })

    // 5. Restore RADIUS if user was isolated
    if (user.status === 'isolated') {
      try {
        await restoreUserInRADIUS(user.username)
      } catch (radiusError: any) {
        console.error('[Auto-Payment] RADIUS restore failed:', radiusError.message)
      }
    }

    // 6. Send notifications (Email + WhatsApp)
    try {
      // Send WhatsApp notification
      if (user.phone) {
        await sendAutoRenewalSuccess({
          customerName: user.name || user.username,
          customerPhone: user.phone,
          username: user.username,
          profileName: user.profile.name,
          amount: packagePrice,
          newBalance: result.user.balance,
          expiredDate: result.newExpiredAt,
        })
      }

      // Send Email notification (if email available)
      if (user.email) {
        await sendAutoRenewalEmail({
          customerName: user.name || user.username,
          customerEmail: user.email,
          username: user.username,
          profileName: user.profile.name,
          amount: packagePrice,
          newBalance: result.user.balance,
          expiredDate: result.newExpiredAt,
        })
      }

      console.log(`[Auto-Payment] ✅ Notifications sent to ${user.username}`)
    } catch (notifError: any) {
      console.error('[Auto-Payment] Notification error:', notifError.message)
      // Don't fail the transaction - notifications are optional
    }

    return true

  } catch (error: any) {
    console.error(`[Auto-Payment] Failed for user ${user.username}:`, error.message)
    return false
  }
}

/**
 * Restore user in RADIUS database
 */
async function restoreUserInRADIUS(username: string) {
  // Remove from isolir group
  await prisma.radusergroup.deleteMany({
    where: {
      username,
      groupname: 'isolir'
    }
  })

  // Remove isolation reply message
  await prisma.radreply.deleteMany({
    where: {
      username,
      attribute: 'Reply-Message'
    }
  })

  console.log(`[RADIUS] Restored user ${username}`)
}
