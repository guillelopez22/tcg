# =============================================================================
# La Grieta Web — Multi-stage Dockerfile
# Target: apps/web (Next.js 14)
# Base: node:20-alpine
# Uses output: 'standalone' for minimal production image
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: deps
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

# Copy all package.json files for workspace resolution
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/r2/package.json ./packages/r2/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Copy pnpm patch files referenced in package.json pnpm.patchedDependencies
COPY patches ./patches

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy entire deps output (preserves pnpm workspace symlinks between packages)
COPY --from=deps /app ./

# Overlay source code on top of installed dependencies
COPY . .

# NEXT_PUBLIC_ env vars must be set at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_R2_PUBLIC_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_R2_PUBLIC_URL=$NEXT_PUBLIC_R2_PUBLIC_URL

# Build the web app and its workspace dependencies
RUN pnpm turbo run build --filter=@la-grieta/web...

# -----------------------------------------------------------------------------
# Stage 3: runner
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

WORKDIR /app

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
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
