import 'dotenv/config';

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://askbox:askbox_dev_password@localhost:5432/askbox',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: '1h',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Auth
  challengeExpiresInMinutes: 5,
  
  // Rate limits
  rateLimits: {
    auth: { max: 10, timeWindow: '1 minute' },
    createBox: { max: 5, timeWindow: '1 hour' },
    createQuestion: { max: 50, timeWindow: '1 hour' },
    createAnswer: { max: 100, timeWindow: '1 hour' },
  },
  
  // Size limits
  sizeLimits: {
    questionMaxBytes: 10 * 1024, // 10KB
    answerMaxBytes: 100 * 1024, // 100KB
    slugMinLength: 3,
    slugMaxLength: 50,
  },
};
