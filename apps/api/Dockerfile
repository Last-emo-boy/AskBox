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

# Production stage
FROM node:20-alpine AS runner

# Install OpenSSL for Prisma, and wget for healthcheck
RUN apk add --no-cache openssl openssl-dev libc6-compat wget

# Use npm in production (simpler than pnpm for deployment)
WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/crypto/package.json ./packages/crypto/
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Copy built files
COPY --from=builder /app/packages/crypto/dist ./packages/crypto/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Install production dependencies using npm (flattened node_modules, no symlink issues)
# Configure npm to use China mirror
RUN npm config set registry https://registry.npmmirror.com

# Install dependencies for crypto package (libsodium)
WORKDIR /app/packages/crypto
RUN npm install --omit=dev --ignore-scripts

# Install dependencies for api package
WORKDIR /app/apps/api
RUN npm install --omit=dev --ignore-scripts

# Generate Prisma client for this environment
RUN npx prisma generate

EXPOSE 3030

# Run database migrations and start
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
