import 'dotenv/config';

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',

  // Database
  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://askbox:askbox_dev_password@localhost:5432/askbox',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: '1h',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Auth
  challengeExpiresInMinutes: 5,

  // Rate limits (relaxed for normal human usage)
  rateLimits: {
    auth: { max: 180, timeWindow: '1 minute' }, // ~3 req/sec, enough for page refreshes
    createBox: { max: 20, timeWindow: '1 hour' }, // reasonable for active users
    createQuestion: { max: 100, timeWindow: '1 hour' }, // 100 questions per box per hour
    createAnswer: { max: 200, timeWindow: '1 hour' }, // 200 answers per hour
  },

  // Size limits
  sizeLimits: {
    questionMaxBytes: 10 * 1024, // 10KB
    answerMaxBytes: 100 * 1024, // 100KB
    slugMinLength: 3,
    slugMaxLength: 50,
  },
};
