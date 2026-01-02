import { initCrypto } from '@askbox/crypto';
import { beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock ioredis before any imports
vi.mock('ioredis', () => {
  const mockPipeline = {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, 0], // zremrangebyscore result
      [null, 0], // zcard result (count = 0, not limited)
      [null, 1], // zadd result
      [null, 1], // expire result
    ]),
  };
  
  const MockRedis = vi.fn().mockImplementation(() => ({
    pipeline: vi.fn(() => mockPipeline),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    setex: vi.fn().mockResolvedValue('OK'),
    incr: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
    on: vi.fn(),
  }));
  
  return { Redis: MockRedis, default: MockRedis };
});

// Initialize crypto before all tests
beforeAll(async () => {
  await initCrypto();
});

// Reset any mocks/state before each test
beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup after all tests
});
