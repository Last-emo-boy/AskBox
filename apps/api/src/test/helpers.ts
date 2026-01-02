import jwt from '@fastify/jwt';
import Fastify, { FastifyInstance } from 'fastify';

import { config } from '../config.js';

/**
 * Create a test Fastify instance with common plugins
 */
export async function createTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  await app.register(jwt, {
    secret: config.jwtSecret,
  });

  return app;
}

/**
 * Generate a test JWT token
 */
export function generateTestToken(app: FastifyInstance, userId: string): string {
  return app.jwt.sign({ user_id: userId }, { expiresIn: '1h' });
}

/**
 * Mock user data for testing
 */
export const mockUser = {
  id: 'test-user-id-123',
  pubSignKey: Buffer.alloc(32),
  pubEncKey: Buffer.alloc(32),
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Mock box data for testing
 */
export const mockBox = {
  id: 'test-box-id-456',
  slug: 'test-box',
  ownerUserId: mockUser.id,
  ownerPubEncKey: Buffer.alloc(32),
  settings: { allow_anonymous: true },
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Mock question data for testing
 */
export const mockQuestion = {
  id: 'test-question-id-789',
  boxId: mockBox.id,
  ciphertextQuestion: Buffer.from('encrypted-question'),
  receiptPubEncKey: Buffer.alloc(32),
  askerTokenHash: Buffer.alloc(32),
  clientCreatedAt: new Date(),
  createdAt: new Date(),
  openedAt: null,
  openedSig: null,
};

/**
 * Mock answer data for testing
 */
export const mockAnswer = {
  id: 'test-answer-id-012',
  questionId: mockQuestion.id,
  visibility: 'public' as const,
  publicText: 'This is a public answer',
  ciphertextAnswer: null,
  nonce: null,
  dekForOwner: null,
  dekForAsker: null,
  createdAt: new Date(),
  publishedAt: null,
};
