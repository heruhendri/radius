import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { createBackup } from '@/server/services/backup.service';
import { sendTelegramFile } from '@/server/services/notifications/telegram.service';
import { formatInTimeZone } from 'date-fns-tz';
import { prisma } from '@/server/db/client';

// POST - Test auto backup by creating a real backup and sending it to Telegram
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load Telegram settings from database
    const settings = await prisma.telegramBackupSettings.findFirst();
    if (!settings || !settings.botToken || !settings.chatId) {
      return NextResponse.json(
        { error: 'Telegram bot token and chat ID must be saved first' },
        { status: 400 }
      );
    }

    const { botToken, chatId, backupTopicId } = settings;
    const now = formatInTimeZone(new Date(), 'Asia/Jakarta', 'dd MMM yyyy HH:mm');

    // Step 1: Create actual backup
    const backupResult = await createBackup('manual');
    const { filepath, backup } = backupResult;

    if (!filepath) {
      return NextResponse.json({ error: 'Backup failed: no file path returned' }, { status: 500 });
    }

    // Step 2: Send backup file to Telegram
    const caption = `💾 <b>SALFANET RADIUS - Test Backup</b>\n\n📁 File: <code>${backup.filename}</code>\n📦 Size: ${formatFileSize(Number(backup.filesize))}\n📅 ${now} WIB\n\n✅ Manual test backup — sent from Telegram Settings`;

    const sendResult = await sendTelegramFile(
      {
        botToken,
        chatId,
        topicId: backupTopicId || undefined,
      },
      filepath,
      caption
    );

    if (!sendResult.success) {
      return NextResponse.json(
        { error: `Backup created but failed to send to Telegram: ${sendResult.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Backup file sent to Telegram successfully!`,
      filename: backup.filename,
      filesize: Number(backup.filesize),
    });
  } catch (error: any) {
    console.error('[Telegram Test Backup] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create or send backup' },
      { status: 500 }
    );
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
