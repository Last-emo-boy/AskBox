import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import {
  getVapidPublicKey,
  subscribeWebPush,
  subscribeFCM,
  unsubscribePush,
} from '../services/pushService.js';

// Auth decorator
async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing authentication token',
      },
    });
  }
}

const webPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

const fcmSubscriptionSchema = z.object({
  fcmToken: z.string().min(1),
});

const unsubscribeSchema = z.object({
  endpoint: z.string(),
});

export async function pushRoutes(app: FastifyInstance) {
  // Get VAPID public key (for Web Push subscription)
  app.get('/vapid-public-key', async (_request, reply) => {
    const key = getVapidPublicKey();
    if (!key) {
      return reply.code(503).send({ error: 'Push notifications not configured' });
    }
    return { vapidPublicKey: key };
  });

  // Subscribe to Web Push
  app.post(
    '/subscribe/web',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const user = request.user as { user_id: string };

      const result = webPushSubscriptionSchema.safeParse(request.body);

      if (!result.success) {
        return reply.code(400).send({ error: 'Invalid subscription data' });
      }

      await subscribeWebPush(user.user_id, result.data);

      return { ok: true };
    }
  );

  // Subscribe to FCM (Android)
  app.post(
    '/subscribe/fcm',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const user = request.user as { user_id: string };

      const result = fcmSubscriptionSchema.safeParse(request.body);

      if (!result.success) {
        return reply.code(400).send({ error: 'Invalid FCM token' });
      }

      await subscribeFCM(user.user_id, result.data.fcmToken);

      return { ok: true };
    }
  );

  // Unsubscribe from push notifications
  app.post(
    '/unsubscribe',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const user = request.user as { user_id: string };

      const result = unsubscribeSchema.safeParse(request.body);

      if (!result.success) {
        return reply.code(400).send({ error: 'Invalid endpoint' });
      }

      await unsubscribePush(user.user_id, result.data.endpoint);

      return { ok: true };
    }
  );
}
