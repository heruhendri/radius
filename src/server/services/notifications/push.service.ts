/**
 * Firebase Admin SDK initialization
 * Menggunakan service account untuk kirim FCM langsung (tanpa Expo relay)
 */
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';

let messagingInstance: admin.messaging.Messaging | null = null;

export function getFCMMessaging(): admin.messaging.Messaging {
  if (messagingInstance) return messagingInstance;

  if (admin.apps.length === 0) {
    const serviceAccountPath = path.join(process.cwd(), 'src', 'lib', 'firebase-service-account.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  messagingInstance = admin.apps[0]!.messaging();
  return messagingInstance;
}

/**
 * Kirim FCM notification ke satu atau banyak native FCM token
 * Returns success/failed counts AND list of invalid tokens for cleanup
 */
export async function sendFCMNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: number; failed: number; invalidTokens: string[] }> {
  if (tokens.length === 0) return { success: 0, failed: 0, invalidTokens: [] };

  const messaging = getFCMMessaging();
  let success = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  // FCM multicast max 500 per batch
  const CHUNK_SIZE = 500;
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        data: data || {},
      });

      success += response.successCount;
      failed += response.failureCount;

      response.responses.forEach((r, idx) => {
        if (!r.success) {
          const tokenPreview = chunk[idx]?.substring(0, 20);
          console.error(`FCM failed for token ${tokenPreview}...:`, r.error?.message);
          // Collect invalid/unregistered tokens for cleanup
          const errCode = r.error?.code;
          if (
            errCode === 'messaging/registration-token-not-registered' ||
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/invalid-argument'
          ) {
            if (chunk[idx]) invalidTokens.push(chunk[idx]);
          }
        }
      });
    } catch (error) {
      console.error('FCM batch send error:', error);
      failed += chunk.length;
    }
  }

  return { success, failed, invalidTokens };
}
