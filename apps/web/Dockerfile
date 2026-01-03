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
COPY apps/web/package.json apps/web/tsconfig.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/crypto/ ./packages/crypto/
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/web/ ./apps/web/

# Build packages
RUN pnpm --filter @askbox/shared-types build
RUN pnpm --filter @askbox/crypto build

# Build argument for API URL (needed at build time for Next.js)
ARG NEXT_PUBLIC_API_URL=https://askbox.w33d.xyz/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build web app
RUN pnpm --filter @askbox/web build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built files
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3031

ENV PORT=3031
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
