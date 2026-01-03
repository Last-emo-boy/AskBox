import webpush from 'web-push';

import { prisma } from '../lib/prisma.js';

// Configure web-push with VAPID keys
// Generate keys: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@askbox.w33d.xyz';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * Get VAPID public key for client subscription
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

/**
 * Subscribe user to push notifications (Web Push)
 */
export async function subscribeWebPush(
  userId: string,
  subscription: WebPushSubscription
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId,
        endpoint: subscription.endpoint,
      },
    },
    create: {
      userId,
      platform: 'web',
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    },
    update: {
      keys: subscription.keys,
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Subscribe user to push notifications (FCM for Android)
 */
export async function subscribeFCM(userId: string, fcmToken: string): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId,
        endpoint: fcmToken,
      },
    },
    create: {
      userId,
      platform: 'android',
      endpoint: fcmToken,
    },
    update: {
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribePush(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({
    where: {
      userId,
      endpoint,
    },
  });
}

/**
 * Send push notification to a user
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const sendPromises = subscriptions.map(
    async (sub: { id: string; platform: string; endpoint: string; keys: unknown }) => {
      try {
        if (sub.platform === 'web') {
          // Web Push
          const webPushSub = {
            endpoint: sub.endpoint,
            keys: sub.keys as { p256dh: string; auth: string },
          };

          await webpush.sendNotification(webPushSub, JSON.stringify(payload));

          // Update last used
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { lastUsedAt: new Date() },
          });
        } else if (sub.platform === 'android') {
          // FCM - would need Firebase Admin SDK
          // For now, skip or implement if needed
          console.log(`FCM notification to ${sub.endpoint}: ${payload.title}`);
        }
      } catch (error: unknown) {
        const err = error as { statusCode?: number };
        // Handle expired subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({
            where: { id: sub.id },
          });
        } else {
          console.error(`Push notification failed for ${sub.id}:`, error);
        }
      }
    }
  );

  await Promise.allSettled(sendPromises);
}

/**
 * Send new question notification to box owner
 */
export async function notifyNewQuestion(boxId: string): Promise<void> {
  const box = await prisma.box.findUnique({
    where: { id: boxId },
    select: { ownerUserId: true, slug: true },
  });

  if (!box) {
    return;
  }

  await sendPushToUser(box.ownerUserId, {
    title: '收到新提问 📬',
    body: '有人向你的提问箱发送了新问题',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: `new-question-${boxId}`,
    data: {
      type: 'new_question',
      boxSlug: box.slug,
      url: `/questions?box_id=${boxId}`,
    },
  });
}

/**
 * Send new answer notification to asker (if they have push enabled)
 * Note: This is tricky because askers are anonymous.
 * We can only notify if they've registered for push with their receipt token.
 */
export async function notifyNewAnswer(questionId: string): Promise<void> {
  // This would require storing push subscriptions linked to receipt tokens
  // which is a more complex implementation. For now, we'll skip this.
  console.log(`New answer for question ${questionId} - notification skipped (anonymous asker)`);
}
