# =============================================================================
# La Grieta Web — Multi-stage Dockerfile
# Target: apps/web (Next.js 15, standalone output)
# Base: node:20-alpine
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: deps
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

ARG CACHE_BUST=3

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY turbo.json ./

COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/r2/package.json ./packages/r2/
COPY packages/eslint-config/package.json ./packages/eslint-config/

COPY patches ./patches

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=deps /app ./
COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_R2_PUBLIC_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_R2_PUBLIC_URL=$NEXT_PUBLIC_R2_PUBLIC_URL

RUN pnpm turbo run build --filter=@la-grieta/web...

# -----------------------------------------------------------------------------
# Stage 3: runner — standalone output (Next.js 15 bundles everything correctly)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

WORKDIR /app

# Copy standalone server (includes all bundled dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static assets and public files
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
