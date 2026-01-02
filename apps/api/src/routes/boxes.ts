import { toBase64Url } from '@askbox/crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { boxCreationRateLimit } from '../utils/rateLimit.js';

// Schemas
const createBoxSchema = z.object({
  slug: z.string()
    .min(config.sizeLimits.slugMinLength)
    .max(config.sizeLimits.slugMaxLength)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  settings: z.object({
    allow_anonymous: z.boolean().default(true),
    require_captcha: z.boolean().default(false),
  }).default({}),
});

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

export async function boxRoutes(app: FastifyInstance) {
  // POST /v1/boxes - Create a new box
  app.post('/boxes', {
    preHandler: [authenticate, boxCreationRateLimit],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createBoxSchema.parse(request.body);
    const userId = (request.user as { user_id: string }).user_id;

    // Get user's public encryption key
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.status(404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Generate slug if not provided
    const slug = body.slug || generateSlug();

    // Check if slug is available
    const existingBox = await prisma.box.findUnique({
      where: { slug },
    });

    if (existingBox) {
      return reply.status(409).send({
        error: {
          code: 'SLUG_TAKEN',
          message: 'This slug is already in use',
        },
      });
    }

    // Create box
    const box = await prisma.box.create({
      data: {
        slug,
        ownerUserId: userId,
        settings: body.settings,
      },
    });

    return reply.status(201).send({
      box_id: box.id,
      slug: box.slug,
      owner_pub_enc_key: toBase64Url(new Uint8Array(user.pubEncKey)),
      created_at: box.createdAt.toISOString(),
    });
  });

  // GET /v1/boxes/:slug - Get box info
  app.get('/boxes/:slug', async (request: FastifyRequest<{
    Params: { slug: string }
  }>, reply: FastifyReply) => {
    const { slug } = request.params;

    const box = await prisma.box.findUnique({
      where: { slug },
      include: { owner: true },
    });

    if (!box) {
      return reply.status(404).send({
        error: {
          code: 'BOX_NOT_FOUND',
          message: 'Box not found',
        },
      });
    }

    return reply.send({
      box_id: box.id,
      slug: box.slug,
      settings: box.settings,
      owner_pub_enc_key: toBase64Url(new Uint8Array(box.owner.pubEncKey)),
    });
  });

  // GET /v1/owner/boxes - List boxes owned by current user
  app.get('/owner/boxes', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.user as { user_id: string }).user_id;

    const boxes = await prisma.box.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'desc' },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    return reply.send({
      boxes: boxes.map(box => ({
        box_id: box.id,
        slug: box.slug,
        settings: box.settings,
        owner_pub_enc_key: toBase64Url(new Uint8Array(user!.pubEncKey)),
        created_at: box.createdAt.toISOString(),
      })),
    });
  });
}

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}
