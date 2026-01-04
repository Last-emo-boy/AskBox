import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import { config } from './config.js';
import { answerRoutes } from './routes/answers.js';
import { authRoutes } from './routes/auth.js';
import { boxRoutes } from './routes/boxes.js';
import { pushRoutes } from './routes/push.js';
import { questionRoutes } from './routes/questions.js';
import wechatRoutes from './routes/wechat.js';
import { createErrorHandler } from './utils/errorHandler.js';

// Configure logger based on environment
const isDevelopment = process.env.NODE_ENV === 'development';

const app = Fastify({
  logger: isDevelopment
    ? {
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      }
    : {
        level: 'info',
      },
});

// Plugins
await app.register(cors, {
  origin: config.corsOrigin,
  credentials: true,
});

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
    },
  },
});

await app.register(jwt, {
  secret: config.jwtSecret,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Routes
await app.register(authRoutes, { prefix: '/v1/auth' });
await app.register(boxRoutes, { prefix: '/v1' });
await app.register(questionRoutes, { prefix: '/v1' });
await app.register(answerRoutes, { prefix: '/v1' });
await app.register(pushRoutes, { prefix: '/v1/push' });
await app.register(wechatRoutes, { prefix: '/v1' });

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Error handler
app.setErrorHandler(createErrorHandler());

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`🚀 Server running at http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { app };
