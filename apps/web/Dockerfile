# =============================================================================
# La Grieta Web — Dockerfile
# Build from apps/web directory directly to fix manifest path issues
# =============================================================================

FROM node:20-alpine AS deps

ARG CACHE_BUST=5
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

FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app ./
COPY . .

# Build shared packages first
RUN pnpm turbo run build --filter=@la-grieta/shared --filter=@la-grieta/db --filter=@la-grieta/r2 --filter=@la-grieta/tsconfig

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_R2_PUBLIC_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_R2_PUBLIC_URL=$NEXT_PUBLIC_R2_PUBLIC_URL

# Build Next.js FROM the apps/web directory so manifest paths match runtime
WORKDIR /app/apps/web
RUN pnpm next build

# --- Runner ---
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Copy entire app to preserve pnpm structure
WORKDIR /app
COPY --from=builder --chown=nextjs:nodejs /app ./

# Run from the same directory where build happened
WORKDIR /app/apps/web

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "start"]
