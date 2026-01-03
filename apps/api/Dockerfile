# Build stage
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8 --activate

# Configure pnpm with China mirror and retry settings
RUN pnpm config set registry https://registry.npmmirror.com && \
    pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    pnpm config set fetch-timeout 300000

WORKDIR /app

# Copy package files and tsconfig
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/crypto/package.json packages/crypto/tsconfig.json ./packages/crypto/
COPY packages/shared-types/package.json packages/shared-types/tsconfig.json ./packages/shared-types/
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/crypto/ ./packages/crypto/
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/api/ ./apps/api/

# Build packages and api
RUN pnpm --filter @askbox/shared-types build
RUN pnpm --filter @askbox/crypto build
RUN pnpm --filter @askbox/api build

# Generate Prisma client
RUN pnpm --filter @askbox/api db:generate

# Use pnpm deploy to create a standalone deployment with all dependencies resolved
RUN pnpm --filter @askbox/api deploy --prod /app/deploy

# Copy Prisma schema and generated client to deploy directory
RUN cp -r /app/apps/api/prisma /app/deploy/
RUN cp -r /app/apps/api/node_modules/.prisma /app/deploy/node_modules/ || true

# Production stage
FROM node:20-alpine AS runner

# Install OpenSSL for Prisma, and wget for healthcheck
RUN apk add --no-cache openssl openssl-dev libc6-compat wget

WORKDIR /app

ENV NODE_ENV=production

# Copy deployed application (pnpm deploy resolves all workspace dependencies)
COPY --from=builder /app/deploy ./

# Regenerate Prisma client for this environment (Alpine Linux)
RUN npx prisma generate

EXPOSE 3030

# Run database migrations and start
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
