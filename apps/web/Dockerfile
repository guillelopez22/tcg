# =============================================================================
# La Grieta Web — Dockerfile
# Uses npm (not pnpm) to avoid pnpm symlink issues with Next.js manifests
# =============================================================================

FROM node:20-alpine AS builder

RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy everything
COPY . .

# Install with npm (flat node_modules, no symlink issues)
RUN npm install --legacy-peer-deps

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_R2_PUBLIC_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_R2_PUBLIC_URL=$NEXT_PUBLIC_R2_PUBLIC_URL

# Build the web app
RUN cd apps/web && npx next build

# --- Runner ---
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

WORKDIR /app

# Copy the built app with flat node_modules
COPY --from=builder --chown=nextjs:nodejs /app ./

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "--prefix", "apps/web", "next", "start", "--port", "3000"]
