# ================================
# Stage 1: Build Dependencies
# ================================
FROM node:20-alpine AS deps

WORKDIR /workspace

# Copy package files
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

# Build the web application using Nx
RUN npx nx build web --configuration=production

# ================================
# Stage 3: Production Runtime with Nginx
# ================================
FROM nginx:1.25-alpine AS runner

# Build argument to select nginx config
# Options: "local" (with SSL) or "railway" (HTTP only, default for cloud deployment)
ARG NGINX_CONFIG=railway

# Install dumb-init for proper signal handling and openssl for certificate generation
RUN apk add --no-cache dumb-init openssl curl

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx configurations
COPY web/nginx.conf /etc/nginx/nginx.local.conf
COPY web/nginx.railway.conf /etc/nginx/nginx.railway.conf

# Select the appropriate nginx config based on build arg
RUN if [ "$NGINX_CONFIG" = "railway" ]; then \
      cp /etc/nginx/nginx.railway.conf /etc/nginx/conf.d/default.conf; \
    else \
      cp /etc/nginx/nginx.local.conf /etc/nginx/conf.d/default.conf; \
    fi

# Copy built application from builder stage
# Angular build outputs to dist/web/browser
COPY --from=builder /workspace/dist/web/browser /usr/share/nginx/html

# Create SSL directory and generate placeholder certificates
# For Railway: These are not used since Railway handles SSL termination
# For Local: These serve as fallback; mount real certs in production
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/server.key \
      -out /etc/nginx/ssl/server.crt \
      -subj "/CN=localhost/O=La Grieta TCG" 2>/dev/null && \
    chmod 644 /etc/nginx/ssl/server.crt && \
    chmod 600 /etc/nginx/ssl/server.key

# Create non-root user for nginx
RUN addgroup --system --gid 1001 nginx-app && \
    adduser --system --uid 1001 nginx-app && \
    chown -R nginx-app:nginx-app /usr/share/nginx/html && \
    chown -R nginx-app:nginx-app /var/cache/nginx && \
    chown -R nginx-app:nginx-app /var/log/nginx && \
    chown -R nginx-app:nginx-app /etc/nginx/ssl && \
    chown -R nginx-app:nginx-app /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx-app:nginx-app /var/run/nginx.pid

# Copy entrypoint script for runtime config substitution
COPY web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Switch to non-root user
USER nginx-app

# Expose port (Railway only uses one port)
EXPOSE 80

# Health check - use HTTP endpoint with dynamic port
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD sh -c 'curl -f http://127.0.0.1:${PORT:-80}/health || exit 1'

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start nginx with entrypoint for env substitution
CMD ["/docker-entrypoint.sh"]
