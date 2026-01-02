import { initCrypto, generateSeed, deriveAccountKeys, sign, toBase64Url } from '@askbox/crypto';
import jwt from '@fastify/jwt';
import Fastify from 'fastify';
import { describe, it, expect, beforeAll, vi } from 'vitest';

import { config } from '../config.js';
import { authRoutes } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { createErrorHandler } from '../utils/errorHandler.js';

// Mock rate limiting (must be before importing auth routes)
vi.mock('../utils/rateLimit.js', () => {
  const mockRateLimiter = vi.fn().mockImplementation(async () => {});
  return {
    createRateLimiter: vi.fn().mockReturnValue(mockRateLimiter),
    questionRateLimit: mockRateLimiter,
    answerRetrievalRateLimit: mockRateLimiter,
    authRateLimit: mockRateLimiter,
    boxCreationRateLimit: mockRateLimiter,
    answerCreationRateLimit: mockRateLimiter,
    getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
    checkRateLimit: vi
      .fn()
      .mockResolvedValue({ limited: false, remaining: 100, resetAt: Date.now() + 60000 }),
  };
});

// Mock security logger
vi.mock('../utils/securityLogger.js', () => ({
  securityLogger: {
    log: vi.fn(),
    authSuccess: vi.fn(),
    authFailed: vi.fn(),
    rateLimited: vi.fn(),
    suspiciousActivity: vi.fn(),
    dataAccess: vi.fn(),
    error: vi.fn(),
  },
  SecurityEventType: {
    AUTH_CHALLENGE_EXPIRED: 'AUTH_CHALLENGE_EXPIRED',
    AUTH_FAILED: 'AUTH_FAILED',
    AUTH_SUCCESS: 'AUTH_SUCCESS',
  },
  SecuritySeverity: {
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    CRITICAL: 'CRITICAL',
  },
}));

// Mock Prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    authChallenge: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('Auth Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    await initCrypto();

    app = Fastify({ logger: false });
    app.setErrorHandler(createErrorHandler());
    await app.register(jwt, { secret: config.jwtSecret });
    await app.register(authRoutes, { prefix: '/v1/auth' });
    await app.ready();
  });

  describe('POST /v1/auth/challenge', () => {
    it('should create a challenge for valid public key', async () => {
      const seed = generateSeed();
      const keys = deriveAccountKeys(seed);
      const pubSignKey = toBase64Url(keys.signKeyPair.publicKey);

      const mockChallenge = {
        id: 'challenge-id-123',
        nonce: Buffer.alloc(32),
        pubSignKey: Buffer.from(keys.signKeyPair.publicKey),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        usedAt: null,
      };

      vi.mocked(prisma.authChallenge.create).mockResolvedValue(mockChallenge);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/challenge',
        payload: { pub_sign_key: pubSignKey },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('nonce');
      expect(body).toHaveProperty('challenge_id');
      expect(body).toHaveProperty('expires_at');
    });

    it('should reject invalid public key format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/challenge',
        payload: { pub_sign_key: '' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /v1/auth/verify', () => {
    it('should verify valid signature and return token', async () => {
      const seed = generateSeed();
      const keys = deriveAccountKeys(seed);
      const nonce = new Uint8Array(32);
      crypto.getRandomValues(nonce);

      const signature = sign(nonce, keys.signKeyPair.privateKey);
      const challengeId = '22222222-2222-2222-2222-222222222222';

      const mockChallenge = {
        id: challengeId,
        nonce: Buffer.from(nonce),
        pubSignKey: Buffer.from(keys.signKeyPair.publicKey),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        usedAt: null,
      };

      const mockUser = {
        id: 'user-id-789',
        pubSignKey: Buffer.from(keys.signKeyPair.publicKey),
        pubEncKey: Buffer.alloc(32),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue(mockChallenge);
      vi.mocked(prisma.authChallenge.update).mockResolvedValue({
        ...mockChallenge,
        usedAt: new Date(),
      });
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/verify',
        payload: {
          challenge_id: challengeId,
          signature: toBase64Url(signature),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('user_id');
    });

    it('should reject non-existent challenge', async () => {
      vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/verify',
        payload: {
          challenge_id: '00000000-0000-0000-0000-000000000000',
          signature: toBase64Url(new Uint8Array(64)),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CHALLENGE_NOT_FOUND');
    });

    it('should reject expired challenge', async () => {
      const challengeId = '11111111-1111-1111-1111-111111111111';
      const mockChallenge = {
        id: challengeId,
        nonce: Buffer.alloc(32),
        pubSignKey: Buffer.alloc(32),
        createdAt: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() - 1000), // Already expired
        usedAt: null,
      };

      vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue(mockChallenge);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/verify',
        payload: {
          challenge_id: challengeId,
          signature: toBase64Url(new Uint8Array(64)),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CHALLENGE_EXPIRED');
    });
  });
});
