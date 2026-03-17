# =============================================================================
# La Grieta API — Multi-stage Dockerfile
# Target: apps/api (NestJS)
# Base: node:20-alpine
#
# NOTE: Uses bcryptjs (pure JS) instead of bcrypt. Native bcrypt hangs on
# Alpine Linux because it requires glibc; bcryptjs avoids this entirely.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: deps
# Install ALL dependencies (including devDependencies) needed for the build.
# We use --frozen-lockfile to guarantee reproducibility.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Enable pnpm via corepack (ships with Node 20)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching.
# If only source files change, this layer (and the install) stays cached.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

# Copy all package.json files without source code so pnpm can resolve the
# workspace graph and cache node_modules independently of source changes.
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/

# Copy pnpm patch files referenced in package.json pnpm.patchedDependencies
COPY patches ./patches

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: builder
# Compile TypeScript for the API and its local package dependencies.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true
COPY --from=deps /app/packages ./packages_nm_placeholder

# Copy full source (everything needed to build)
COPY . .

# Build only the API and its workspace dependencies using Turborepo.
# --filter=@la-grieta/api... includes transitive local package dependencies.
RUN pnpm turbo run build --filter=@la-grieta/api...

# Run database migrations at build time is intentionally NOT done here.
# Migrations run at container startup via the CMD (or a Railway pre-deploy command).

# Prune to production-only dependencies to keep the final image small.
RUN pnpm --filter=@la-grieta/api --prod deploy /app/pruned

# -----------------------------------------------------------------------------
# Stage 3: runner (production image)
# Minimal image — only production node_modules + compiled output.
# Runs as a non-root user for security.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Install dumb-init for proper PID 1 signal handling and graceful shutdown.
RUN apk add --no-cache dumb-init

# Create a non-root user
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

WORKDIR /app

# Copy pruned production deps and build output from builder
COPY --from=builder --chown=nestjs:nodejs /app/pruned/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist

# Copy Drizzle migration files so the entrypoint can run `drizzle-kit migrate`
# or the built-in migration runner at startup.
COPY --from=builder --chown=nestjs:nodejs /app/packages/db/drizzle ./drizzle

# Copy package.json for module resolution (NODE_ENV, name, etc.)
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json

USER nestjs

# Expose the API port (overridable via API_PORT env var at runtime)
EXPOSE 3001

# Health check — Railway and other platforms use this to determine readiness.
# Adjust the path if the NestJS health endpoint differs.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${API_PORT:-3001}/api/health || exit 1

# dumb-init wraps Node to forward signals correctly (SIGTERM for graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
