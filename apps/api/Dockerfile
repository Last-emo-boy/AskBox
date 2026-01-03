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

# Generate Prisma client for the target environment (Alpine Linux)
RUN pnpm --filter @askbox/api db:generate

# Use pnpm deploy to create a standalone deployment with all dependencies resolved
RUN pnpm --filter @askbox/api deploy --prod /app/deploy

# Copy Prisma schema and generated client to deploy directory
RUN cp -r /app/apps/api/prisma /app/deploy/

# Debug: Find where .prisma is located
RUN find /app -name ".prisma" -type d 2>/dev/null || echo "No .prisma directory found"
RUN find /app -name "libquery_engine*" -type f 2>/dev/null | head -5 || echo "No query engine found"

# Copy .prisma from wherever it is (pnpm stores it in .pnpm)
RUN cp -r $(find /app -path "*/.prisma/client" -type d | head -1)/.. /app/deploy/node_modules/.prisma || echo "Trying alternative location"

# Copy Prisma CLI and engines from builder (to avoid npx downloading wrong version)
RUN mkdir -p /app/deploy/node_modules/prisma /app/deploy/node_modules/@prisma/engines
RUN cp -r /app/node_modules/.pnpm/prisma@*/node_modules/prisma/* /app/deploy/node_modules/prisma/
RUN cp -r /app/node_modules/.pnpm/@prisma+engines@*/node_modules/@prisma/engines/* /app/deploy/node_modules/@prisma/engines/

# Production stage
FROM node:20-alpine AS runner

# Install OpenSSL for Prisma, and wget for healthcheck
RUN apk add --no-cache openssl openssl-dev libc6-compat wget

WORKDIR /app

ENV NODE_ENV=production

# Copy deployed application (pnpm deploy resolves all workspace dependencies)
COPY --from=builder /app/deploy ./

EXPOSE 3030

# Run database migrations and start using the copied prisma CLI
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node dist/index.js"]
