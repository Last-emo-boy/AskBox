import { FastifyRequest, FastifyReply } from 'fastify';
import { Redis } from 'ioredis';

import { config } from '../config.js';

// Redis client singleton
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

interface RateLimitOptions {
  /** Max requests allowed in the time window */
  max: number;
  /** Time window in seconds */
  windowSec: number;
  /** Key prefix for Redis */
  prefix: string;
  /** Function to extract key dimensions */
  keyGenerator: (request: FastifyRequest) => string[];
  /** Whether to skip in development */
  skipInDev?: boolean;
}

interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Sliding window rate limiter using Redis sorted sets
 * Supports multi-dimensional keys (IP + box_id + asker_token etc.)
 */
async function checkRateLimit(
  keys: string[],
  max: number,
  windowSec: number,
  prefix: string
): Promise<RateLimitResult> {
  const redis = getRedis();
  const now = Date.now();
  const windowStart = now - windowSec * 1000;

  // Combine all keys for unique rate limit bucket
  const compositeKey = `ratelimit:${prefix}:${keys.join(':')}`;

  // Use Redis transaction for atomic operations
  const pipeline = redis.pipeline();

  // Remove old entries outside the window
  pipeline.zremrangebyscore(compositeKey, 0, windowStart);

  // Count current requests in window
  pipeline.zcard(compositeKey);

  // Add current request
  pipeline.zadd(compositeKey, now.toString(), `${now}-${Math.random()}`);

  // Set expiry to clean up old keys
  pipeline.expire(compositeKey, windowSec);

  const results = await pipeline.exec();

  if (!results || !results[1]) {
    // Redis error, fail open
    return { limited: false, remaining: max, resetAt: now + windowSec * 1000 };
  }

  const currentCount = (results[1]?.[1] as number) || 0;
  const limited = currentCount >= max;
  const remaining = Math.max(0, max - currentCount - 1);

  return {
    limited,
    remaining,
    resetAt: now + windowSec * 1000,
  };
}

/**
 * Extract client IP from request, handling proxies
 */
function getClientIp(request: FastifyRequest): string {
  // Check X-Forwarded-For header (for reverse proxies)
  const xff = request.headers['x-forwarded-for'];
  if (xff) {
    const xffValue = Array.isArray(xff) ? xff[0] : xff;
    if (xffValue) {
      const ips = xffValue.split(',');
      const firstIp = ips[0]?.trim();
      if (firstIp) {
        return firstIp;
      }
    }
  }

  // Check X-Real-IP header
  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp;
    if (realIpValue) {
      return realIpValue;
    }
  }

  // Fall back to socket address
  return request.ip || 'unknown';
}

/**
 * Create a rate limit hook for Fastify routes
 */
export function createRateLimiter(options: RateLimitOptions) {
  return async function rateLimitHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Skip in development if configured
    if (options.skipInDev && process.env.NODE_ENV === 'development') {
      return;
    }

    try {
      const keys = options.keyGenerator(request);
      const result = await checkRateLimit(keys, options.max, options.windowSec, options.prefix);

      // Set rate limit headers
      reply.header('X-RateLimit-Limit', options.max.toString());
      reply.header('X-RateLimit-Remaining', result.remaining.toString());
      reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

      if (result.limited) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
        reply.header('Retry-After', retryAfter.toString());

        throw {
          statusCode: 429,
          message: 'Too many requests',
          code: 'RATE_LIMITED',
        };
      }
    } catch (error: any) {
      if (error.statusCode === 429) {
        throw error;
      }
      // Log but don't block on Redis errors
      request.log.error(error, 'Rate limit check failed');
    }
  };
}

// Pre-built rate limiters for common use cases

/** Rate limit question creation by IP + box */
export const questionRateLimit = createRateLimiter({
  max: 50,
  windowSec: 3600, // 1 hour
  prefix: 'question',
  keyGenerator: (request) => {
    const ip = getClientIp(request);
    const body = request.body as any;
    const boxId = body?.box_id || 'unknown';
    return [ip, boxId];
  },
});

/** Rate limit answer retrieval by asker token */
export const answerRetrievalRateLimit = createRateLimiter({
  max: 100,
  windowSec: 3600, // 1 hour
  prefix: 'answer-retrieve',
  keyGenerator: (request) => {
    const ip = getClientIp(request);
    const query = request.query as any;
    const askerToken = query?.asker_token || 'unknown';
    return [ip, askerToken];
  },
});

/** Rate limit auth attempts by IP */
export const authRateLimit = createRateLimiter({
  max: 10,
  windowSec: 60, // 1 minute
  prefix: 'auth',
  keyGenerator: (request) => {
    return [getClientIp(request)];
  },
});

/** Strict rate limit for box creation */
export const boxCreationRateLimit = createRateLimiter({
  max: 5,
  windowSec: 3600, // 1 hour
  prefix: 'box-create',
  keyGenerator: (request) => {
    const ip = getClientIp(request);
    // Also include user ID from JWT if available
    const userId = (request as any).userId || 'anon';
    return [ip, userId];
  },
});

/** Rate limit answer creation by box owner */
export const answerCreationRateLimit = createRateLimiter({
  max: 100,
  windowSec: 3600, // 1 hour
  prefix: 'answer-create',
  keyGenerator: (request) => {
    const userId = (request as any).userId || 'anon';
    return [userId];
  },
});

// Export utility for custom rate limits
export { getClientIp, checkRateLimit };
