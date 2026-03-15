# External Integrations

**Analysis Date:** 2025-03-15

## APIs & External Services

**Web Scraping (News):**
- riftbound.gg - Community wiki
  - Method: Multi-strategy (RSS → Sitemap → HTML scrape)
  - Client: `axios`, `cheerio`
  - Implementation: `apps/api/src/modules/news/news.service.ts`
  - Cadence: Every 4 hours (cron: `0 */4 * * *`)

- official.riftbound.io - Official Riftbound announcements
  - Method: HTML scraping + Next.js data extraction
  - Client: `cheerio`, `axios`
  - Implementation: `apps/api/src/modules/news/news.service.ts`

- riftdecks.com - Tournament/meta deck data
  - Method: HTML scraping
  - Client: `cheerio`, `axios`
  - Implementation: `apps/api/src/modules/news/news.service.ts`

**TCGPlayer (Card Data Source):**
- Product images: `https://product-images.tcgplayer.com`
  - Used for: Card thumbnails and full art (stored in DB after seed)
  - Configuration: Allowed in Next.js `remotePatterns` in `next.config.mjs`
  - Scope: No API key required, read-only image CDN

**File Uploads:**
- Cloudflare R2 (S3-compatible object storage)
  - Purpose: User-generated content (listing images, deck artwork)
  - Presigned URLs only - no direct backend upload
  - Implementation: `packages/r2/src/` with AWS SDK clients
  - Configuration: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
  - Public URL: `NEXT_PUBLIC_R2_PUBLIC_URL` (e.g., https://uploads.lagrieta.app)

## Data Storage

**Primary Database:**
- PostgreSQL 16 (via Docker container: `la-grieta-postgres`)
  - Connection: `DATABASE_URL` env var (postgresql://user:pass@host:5432/lagrieta)
  - Client: `pg` npm package
  - ORM: Drizzle ORM 0.38 with schema-first approach
  - Schema location: `packages/db/src/schema/` (cards, sets, users, decks, collections, listings, orders, wishlists, sessions, etc.)
  - Migration runner: Drizzle Kit (`drizzle-kit`)
  - Port: 5432 (local dev)

**Caching & Session Store:**
- Redis 7 (via Docker container: `la-grieta-redis`)
  - Connection: `REDIS_URL` (redis://:password@localhost:6379)
  - Client: `ioredis` (v5.4)
  - Uses:
    - JWT token blacklist (logout)
    - Session/refresh token storage
    - Rate limit counters
    - Deck recommendation cache
  - Max memory: 256MB with allkeys-lru eviction policy
  - Port: 6379 (local dev)

**Card Image Storage:**
- Local JSON fallback: `riftbound-tcg-data/` (cloned external repo, not modified)
  - Source: https://github.com/apitcg/riftbound-tcg-data.git
  - Structure: `sets/en.json` (sets), `cards/en/<set-id>.json` (cards per set)
  - Used for: Seed data only; card images fetched from TCGPlayer CDN at runtime

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Tokens: Access (15 min) + Refresh (30 days in httpOnly cookie)
  - Algorithm: HS256 (dev) or RS256 (production via JWT_PRIVATE_KEY/JWT_PUBLIC_KEY)
  - Secret: `JWT_SECRET` env var
  - Implementation: `apps/api/src/modules/auth/auth.service.ts`
  - Login flow:
    1. User registers with email/password
    2. Password hashed with bcryptjs (12 rounds)
    3. Session created in DB with refresh token hash
    4. Access token returned, refresh token set in httpOnly cookie
    5. Refresh token rotation on auth.refresh call

**Session Management:**
- PostgreSQL `sessions` table
  - Stores: userId, refreshToken (hashed), expiresAt, isRevoked
  - Logout: Token added to Redis blacklist with TTL
  - Refresh: Single-use check + new token issued

**Authorization:**
- Role-based (RBAC): `user.role` field in DB
- tRPC procedure tiers:
  - `publicProcedure` - No auth required
  - `optionalAuthProcedure` - Auth optional
  - `protectedProcedure` - Auth required
  - `adminProcedure` - Admin role required
  - Implementation: `apps/api/src/trpc/trpc.service.ts`

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Rollbar, etc. integrated)

**Logs:**
- Console logging (development)
- NestJS Logger via `@nestjs/common`
- tRPC middleware logs request type, path, status, duration
- Scanner service logs fingerprint load progress
- News service logs scrape success/failure per source

## CI/CD & Deployment

**Hosting:**
- Not yet deployed (development only)
- Target: Cloud-ready (containerized, no hardcoded paths)
- Expected: Vercel (web), ECS/Kubernetes (API)

**CI Pipeline:**
- Not detected (no GitHub Actions, GitLab CI, etc. yet)
- Turbo caching ready for monorepo builds

**Build Pipeline:**
- Root: `pnpm build` → turbo runs build per workspace
- API: `nest build` → NestJS compilation
- Web: `next build` → Next.js static export or server build
- Packages: `tsc` TypeScript compilation

## Environment Configuration

**Required env vars:**

*Database & Cache:*
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - PostgreSQL setup
- `DATABASE_URL` - Full connection string (postgresql://...)
- `REDIS_PASSWORD`, `REDIS_URL` - Redis credentials and URI

*API Server:*
- `NODE_ENV` - "development" or "production"
- `API_PORT` - Server port (default 3001)
- `API_PREFIX` - tRPC prefix (default "api")

*JWT Auth:*
- `JWT_SECRET` - HS256 secret (min 32 chars) OR
- `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` - RS256 keys (base64-encoded PEM, production)
- `JWT_ACCESS_TOKEN_TTL` - Seconds (default 900 = 15 min)
- `JWT_REFRESH_TOKEN_TTL` - Seconds (default 2592000 = 30 days)

*File Storage (R2):*
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `R2_PUBLIC_URL` - Public CDN URL for R2 bucket

*Web Client:*
- `NEXT_PUBLIC_API_URL` - API base URL (http://localhost:3001/api in dev)
- `NEXT_PUBLIC_R2_PUBLIC_URL` - R2 public URL for displaying images

*Rate Limiting:*
- `THROTTLE_PUBLIC_LIMIT` - Requests per minute for public endpoints (default 100)
- `THROTTLE_PUBLIC_TTL` - Time window in ms (default 60000 = 1 min)
- `THROTTLE_AUTH_LIMIT` - Auth endpoint limit (default 1000)
- `THROTTLE_LOGIN_LIMIT` - Login endpoint limit (default 10/min)

*CORS:*
- `CORS_ORIGINS` - Comma-separated allowed origins

**Secrets location:**
- `.env` (root) - Source of truth for dev environment
- Docker Compose - Uses env vars from `.env`
- CI/CD - Env vars injected at runtime (not committed)
- Never commit `.env` to version control

## Webhooks & Callbacks

**Incoming Webhooks:**
- Not detected (no Stripe webhooks, WhatsApp webhooks yet)

**Outgoing Webhooks:**
- Not detected (no calls to external webhook endpoints)

**Future (Phase 4+):**
- Stripe webhook: `POST /webhooks/stripe` for payment events
- WhatsApp webhook: `POST /webhooks/whatsapp` for message callbacks

## Real-time Communication

**WebSockets:**
- Socket.IO 4.8 server (`@nestjs/websockets`)
- Socket.IO client 4.8 in web app
- Purpose: Real-time match board updates, deck sync notifications
- Gateway location: `apps/api/src/modules/match/match.gateway.ts` (if exists)
- Events: Match state updates, player actions
- Rooms: Per-match code for isolated broadcasting

## Scheduled Tasks

**Cron Jobs (NestJS Schedule):**
- News sync: Every 4 hours (`0 */4 * * *`)
  - Service: `apps/api/src/modules/news/news.service.ts` → `syncCron()`
  - Behavior: Fire-and-forget startup sync, then cron schedule

- Deck sync: Not visible but module exists (`DeckSyncModule` in AppModule)
  - Purpose: Sync trending decks from riftdecks.com or similar

- Price sync: Not visible but module exists (`price-sync` directory)
  - Purpose: Update card prices from TCGPlayer or similar

## Rate Limiting

**Strategy:**
- Redis-backed rate limiter in `apps/api/src/modules/throttler/rate-limit.middleware.ts`
- Tiers:
  - Public endpoints: 100/min per IP
  - Authenticated endpoints: 1000/min per user
  - Login/Register: 10/min per IP (brute-force protection)
- Implementation: Client IP extracted, counter stored in Redis with TTL

---

*Integration audit: 2025-03-15*
