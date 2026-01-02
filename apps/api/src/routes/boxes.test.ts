import { initCrypto } from '@askbox/crypto';
import jwt from '@fastify/jwt';
import Fastify from 'fastify';
import { describe, it, expect, beforeAll, vi } from 'vitest';

import { config } from '../config.js';
import { boxRoutes } from './boxes.js';
import { prisma } from '../lib/prisma.js';
import { createErrorHandler } from '../utils/errorHandler.js';

// Mock rate limiting (must be before importing routes)
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
    checkRateLimit: vi.fn().mockResolvedValue({ limited: false, remaining: 100, resetAt: Date.now() + 60000 }),
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
  SecurityEventType: {},
  SecuritySeverity: {},
}));

// Mock Prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    box: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Box Routes', () => {
  let app: ReturnType<typeof Fastify>;
  const testUserId = 'test-user-id-123';

  beforeAll(async () => {
    await initCrypto();
    
    app = Fastify({ logger: false });
    app.setErrorHandler(createErrorHandler());
    await app.register(jwt, { secret: config.jwtSecret });
    await app.register(boxRoutes, { prefix: '/v1' });
    await app.ready();
  });

  const generateToken = () => app.jwt.sign({ user_id: testUserId }, { expiresIn: '1h' });

  describe('POST /v1/boxes', () => {
    it('should create a box for authenticated user', async () => {
      const mockUser = {
        id: testUserId,
        pubSignKey: Buffer.alloc(32),
        pubEncKey: Buffer.alloc(32),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBox = {
        id: 'new-box-id',
        slug: 'my-box',
        ownerUserId: testUserId,
        ownerPubEncKey: mockUser.pubEncKey,
        settings: { allow_anonymous: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.box.findUnique).mockResolvedValue(null); // Slug not taken
      vi.mocked(prisma.box.create).mockResolvedValue(mockBox);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/boxes',
        headers: {
          authorization: `Bearer ${generateToken()}`,
        },
        payload: {
          slug: 'my-box',
          settings: { allow_anonymous: true },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('box_id');
      expect(body.slug).toBe('my-box');
    });

    it('should reject unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/boxes',
        payload: {
          slug: 'my-box',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject duplicate slug', async () => {
      const mockUser = {
        id: testUserId,
        pubSignKey: Buffer.alloc(32),
        pubEncKey: Buffer.alloc(32),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const existingBox = {
        id: 'existing-box-id',
        slug: 'taken-slug',
        ownerUserId: 'other-user',
        ownerPubEncKey: Buffer.alloc(32),
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.box.findUnique).mockResolvedValue(existingBox);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/boxes',
        headers: {
          authorization: `Bearer ${generateToken()}`,
        },
        payload: {
          slug: 'taken-slug',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('SLUG_TAKEN');
    });
  });

  describe('GET /v1/boxes/:slug', () => {
    it('should return box info by slug', async () => {
      const mockOwner = {
        id: testUserId,
        pubSignKey: Buffer.alloc(32),
        pubEncKey: Buffer.alloc(32),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const mockBox = {
        id: 'box-id-123',
        slug: 'test-box',
        ownerUserId: testUserId,
        ownerPubEncKey: Buffer.alloc(32),
        settings: { allow_anonymous: true },
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: mockOwner, // Include owner relation
      };

      vi.mocked(prisma.box.findUnique).mockResolvedValue(mockBox as any);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/boxes/test-box',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.slug).toBe('test-box');
      expect(body).toHaveProperty('owner_pub_enc_key');
    });

    it('should return 404 for non-existent box', async () => {
      vi.mocked(prisma.box.findUnique).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/boxes/non-existent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /v1/owner/boxes', () => {
    it('should return boxes for authenticated user', async () => {
      const mockBoxes = [
        {
          id: 'box-1',
          slug: 'box-one',
          ownerUserId: testUserId,
          ownerPubEncKey: Buffer.alloc(32),
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { questions: 5 },
        },
        {
          id: 'box-2',
          slug: 'box-two',
          ownerUserId: testUserId,
          ownerPubEncKey: Buffer.alloc(32),
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { questions: 10 },
        },
      ];

      vi.mocked(prisma.box.findMany).mockResolvedValue(mockBoxes);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/owner/boxes',
        headers: {
          authorization: `Bearer ${generateToken()}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.boxes).toHaveLength(2);
    });

    it('should reject unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/owner/boxes',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
