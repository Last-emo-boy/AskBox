import { initCrypto, randomBytes, verify, toBase64Url, fromBase64Url } from '@askbox/crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { authRateLimit } from '../utils/rateLimit.js';
import { securityLogger, SecurityEventType, SecuritySeverity } from '../utils/securityLogger.js';

// Initialize crypto
await initCrypto();

// Schemas
const challengeRequestSchema = z.object({
  pub_sign_key: z.string().min(1),
});

const verifyRequestSchema = z.object({
  challenge_id: z.string().uuid(),
  signature: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /v1/auth/challenge - Request a challenge nonce
  app.post('/challenge', {
    preHandler: authRateLimit,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = challengeRequestSchema.parse(request.body);

    // Generate nonce
    const nonce = randomBytes(32);
    const expiresAt = new Date(Date.now() + config.challengeExpiresInMinutes * 60 * 1000);

    // Store challenge
    const challenge = await prisma.authChallenge.create({
      data: {
        nonce: Buffer.from(nonce),
        pubSignKey: Buffer.from(fromBase64Url(body.pub_sign_key)),
        expiresAt,
      },
    });

    return reply.send({
      nonce: toBase64Url(nonce),
      challenge_id: challenge.id,
      expires_at: expiresAt.toISOString(),
    });
  });

  // POST /v1/auth/verify - Verify signature and get token
  app.post('/verify', {
    preHandler: authRateLimit,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = verifyRequestSchema.parse(request.body);

    // Find challenge
    const challenge = await prisma.authChallenge.findUnique({
      where: { id: body.challenge_id },
    });

    if (!challenge) {
      securityLogger.authFailed(request, 'Challenge not found');
      return reply.status(400).send({
        error: {
          code: 'CHALLENGE_NOT_FOUND',
          message: 'Challenge not found',
        },
      });
    }

    // Check if expired
    if (challenge.expiresAt < new Date()) {
      securityLogger.log(
        SecurityEventType.AUTH_CHALLENGE_EXPIRED,
        SecuritySeverity.WARNING,
        'Challenge expired',
        request,
        { challengeId: challenge.id }
      );
      return reply.status(400).send({
        error: {
          code: 'CHALLENGE_EXPIRED',
          message: 'Challenge has expired',
        },
      });
    }

    // Check if already used
    if (challenge.usedAt) {
      return reply.status(400).send({
        error: {
          code: 'CHALLENGE_USED',
          message: 'Challenge has already been used',
        },
      });
    }

    // Verify signature
    const pubSignKey = new Uint8Array(challenge.pubSignKey);
    const nonce = new Uint8Array(challenge.nonce);
    const signature = fromBase64Url(body.signature);

    const isValid = verify(nonce, signature, pubSignKey);

    if (!isValid) {
      securityLogger.authFailed(request, 'Invalid signature');
      return reply.status(400).send({
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Signature verification failed',
        },
      });
    }

    // Mark challenge as used
    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    });

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { pubSignKey: challenge.pubSignKey },
    });

    if (!user) {
      // New user - we need their encryption public key
      // For now, we'll create with empty enc key and require update
      user = await prisma.user.create({
        data: {
          pubSignKey: challenge.pubSignKey,
          pubEncKey: Buffer.alloc(32), // Placeholder - should be provided
        },
      });
    }

    // Generate JWT
    const token = app.jwt.sign(
      { user_id: user.id },
      { expiresIn: config.jwtExpiresIn }
    );

    securityLogger.authSuccess(request, user.id);

    return reply.send({
      access_token: token,
      expires_in: 3600,
      user_id: user.id,
    });
  });
}
