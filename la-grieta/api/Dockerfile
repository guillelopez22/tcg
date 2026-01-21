# ================================
# Stage 1: Build Dependencies
# ================================
FROM node:20-alpine AS deps

WORKDIR /workspace

# Copy package files (Nx monorepo - only root package.json needed)
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# ================================
# Stage 2: Build Application
# ================================
FROM node:20-alpine AS builder

WORKDIR /workspace

# Copy dependencies from deps stage
COPY --from=deps /workspace/node_modules ./node_modules

# Copy source code and configuration
COPY . .

# Generate Prisma Client
RUN npx prisma generate --schema=./api/prisma/schema.prisma

# Build the API using Nx
RUN npx nx build api --configuration=production

# ================================
# Stage 3: Production Runtime
# ================================
FROM node:20-alpine AS runner

# Install required system dependencies
RUN apk add --no-cache \
    dumb-init \
    openssl \
    libc6-compat

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /workspace/dist/api ./
COPY --from=builder --chown=nestjs:nodejs /workspace/api/prisma ./prisma

# Copy node_modules (Nx generates package.json in dist)
COPY --from=builder --chown=nestjs:nodejs /workspace/node_modules ./node_modules

# Make sure nestjs user can write to node_modules for Prisma engines
RUN chown -R nestjs:nodejs /app/node_modules

# Install production dependencies only (if package.json exists in dist)
RUN if [ -f package.json ]; then npm ci --production --legacy-peer-deps && npm cache clean --force; fi

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "main.js"]
