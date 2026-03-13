# External Integrations

**Analysis Date:** 2026-03-11

## APIs & External Services

**TCGPlayer/Card Pricing:**
- Service: tcgcsv.com - Free third-party price aggregator for Riftbound TCG (tcgplayer.com is deprecated)
- What it's used for: Periodic price synchronization for all cards across all sets
  - Implementation: `apps/api/src/modules/price-sync/price-sync.service.ts`
  - Cron: Every 6 hours (NestJS Schedule)
  - Fetches: `https://tcgcsv.com/tcgplayer/89/{groupId}/prices` - JSON price data
  - Method: Upsert via Drizzle ORM into `cardPrices` table by `cardId`
  - Auth: None (public API)
- Data schema: `TcgcsvPriceRow` interface with lowPrice, midPrice, highPrice, marketPrice, directLowPrice, subTypeName (Normal/Foil)

**Card Image CDN:**
- Service: product-images.tcgplayer.com / TCGPlayer CDN
- What it's used for: Card artwork and thumbnails
  - Referenced in: `apps/web/next.config.mjs` remote patterns
  - Used by: Scanner service to download card images for fingerprinting
  - Fetch: HTTP requests with User-Agent header, 10s timeout, graceful failure on 403/404

**Card Data Source (Local Bundle):**
- Source: apitcg/riftbound-tcg-data (GitHub repo, free, cloned locally to `riftbound-tcg-data/`)
- What it's used for: Initial card database seed, no external API calls required
  - Sets: `riftbound-tcg-data/sets/en.json` - array of Riftbound TCG sets
  - Cards: `riftbound-tcg-data/cards/en/{setId}.json` - array of cards per set from TCGPlayer
  - Schema: id, number, code, name, cleanName, images, set, tcgplayer, rarity, cardType, domain, energyCost, powerCost, might, description, flavorText
  - Note: Early entries in Origins and Spiritforged are products (booster packs) with null card attributes — seed script filters these

## Data Storage

**Databases:**

- **PostgreSQL 16**
  - Connection: `DATABASE_URL` environment variable (postgresql://user:pass@host:port/db)
  - Client: `pg` (native PostgreSQL driver via Drizzle ORM)
  - Package: `@la-grieta/db` - Drizzle schema and migrations
  - Dialect: PostgreSQL (strict mode)
  - Migrations: Located in `packages/db/drizzle/` - run automatically at container startup via `drizzle-kit migrate`
  - Tables: cards, sets, cardPrices, users, collections, collectionItems, decks, deckSlots (see `packages/db/src/schema/`)

- **Redis 7**
  - Connection: `REDIS_URL` environment variable (redis://:password@host:port)
  - Client: `ioredis` - Redis client library
  - Purpose: Caching, session data, rate limiting state
  - Configuration: `apps/api/src/config/redis.config.ts`
  - Docker compose: maxmemory 256mb, LRU eviction policy

**File Storage:**

- **Cloudflare R2**
  - Purpose: Secure file uploads (user-generated content, collection images, deck lists)
  - Auth: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` environment variables
  - Bucket: `R2_BUCKET_NAME` (default: la-grieta-uploads)
  - Public URL: `R2_PUBLIC_URL` (custom domain or r2.dev subdomain)
  - Implementation: `packages/r2/` - AWS SDK v3 client with presigned URL generation
  - Pattern: Backend generates presigned URLs for:
    - Uploads: Client uploads directly to R2 via presigned POST URL (no file handling on backend)
    - Downloads: Client downloads from public R2 URL or presigned GET URL
  - Supported: User profile images, collection thumbnails, deck export PDFs
  - Constants: `MAX_FILE_SIZE_BYTES`, `PRESIGNED_URL_TTL_SECONDS`, `ALLOWED_MIME_TYPES`

**No other storage:**
- Card data: PostgreSQL only (seeded from local riftbound-tcg-data repo)
- Prices: PostgreSQL cardPrices table
- No external document store, no blob storage beyond R2

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `apps/api/src/modules/auth/`
  - Access tokens: In-memory (short-lived, default 15 minutes via `JWT_ACCESS_TOKEN_TTL`)
  - Refresh tokens: httpOnly cookies (long-lived, default 30 days via `JWT_REFRESH_TOKEN_TTL`)
  - Algorithm: HS256 (development) or RS256 (production with `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`)
  - Secret: `JWT_SECRET` environment variable (minimum 32 characters)
  - Password hashing: bcryptjs (pure JavaScript, Alpine Linux safe)
- Session management: Stateless JWT + httpOnly refresh token cookies
- CORS: Configured per `CORS_ORIGINS` comma-separated list (e.g., localhost:3000, localhost:19006)

**No OAuth:**
- No third-party identity providers (Google, GitHub, Discord)
- User registration/login: Email + password

## Monitoring & Observability

**Error Tracking:**
- Not currently integrated (feature for Phase 5+)
- Errors logged to stdout via NestJS logger

**Logs:**
- Stdout logging via NestJS Logger
- Log levels: log, warn, error, debug
- Structured logging in some modules (e.g., Scanner, PriceSyncService emit progress)
- No external log aggregation (Datadog, Sentry, CloudWatch) at this stage

**Health Checks:**
- Endpoint: `/api/health` (GET)
- Implementation: `apps/api/src/modules/health/health.controller.ts`
- Docker healthcheck: Pings endpoint every 30s (start-period 30s, retries 3)
- Used by: Kubernetes/Railway for service readiness

## CI/CD & Deployment

**Hosting:**
- Target: Railway.app (reference in `railway.toml`)
- Docker: Multi-stage build via `Dockerfile`
- Environment: Production PostgreSQL, Redis (Railway managed services)

**CI Pipeline:**
- Not yet configured (GitHub Actions in `.github/workflows/` but not active)
- Manual deployments via Railway git push

**Deployment Process:**
1. Docker build: 3-stage pipeline (deps → builder → runner)
2. Migrations: Automated via `packages/db/drizzle/` at container startup
3. Port: `API_PORT` environment variable (default 3001)
4. Shutdown: dumb-init forwards SIGTERM for graceful shutdown

## Environment Configuration

**Required env vars (must be set):**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Minimum 32 characters, no "change_me" placeholders
- `API_PORT` - NestJS server port
- `API_PREFIX` - Global API prefix (default "api")
- `NODE_ENV` - development or production
- `NEXT_PUBLIC_API_URL` - Exposed to browser (e.g., http://localhost:3001)
- `NEXT_PUBLIC_R2_PUBLIC_URL` - Public R2 bucket URL
- `CORS_ORIGINS` - Comma-separated allowed origins

**Optional env vars (features for future phases):**
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` - File uploads
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` - Phase 5+ payments
- `STRIPE_PLATFORM_FEE_BPS` - Platform fee in basis points (e.g., 500 = 5%)
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN` - Cloud API (Phase 4+)
- `WHATSAPP_SESSION_DIR` - Baileys self-hosted (Phase 4+ alternative)

**Rate Limiting:**
- Public routes: 100 req/min per IP (`THROTTLE_PUBLIC_LIMIT`, `THROTTLE_PUBLIC_TTL` in ms)
- Authenticated routes: 1000 req/min (`THROTTLE_AUTH_LIMIT`)
- Login endpoints: 10 req/min (`THROTTLE_LOGIN_LIMIT`)
- Implementation: NestJS throttler guard

**Secrets location:**
- Development: `.env` file (local, never committed)
- Production: Railway environment variables or Cloudflare Pages/Workers secrets
- No files committed with secrets (.env always in .gitignore)

## Webhooks & Callbacks

**Incoming:**
- None at this stage (marketplace/escrow webhooks reserved for Phase 5+)

**Outgoing:**
- None currently (Stripe webhooks to be added for payment reconciliation in Phase 5+)

**Price Sync Integration:**
- Not a webhook — uses scheduled cron job every 6 hours (NestJS Schedule)
- Pulls from tcgcsv.com on demand, no push callbacks

## No Third-Party Dependencies

**Notably absent (by design):**
- No external API keys for card data (local riftbound-tcg-data repo instead)
- No OAuth/social login (custom JWT only)
- No payment gateway live (Phase 5+)
- No WhatsApp integration yet (Phase 4+)
- No Sentry, Datadog, or observability SaaS
- No CDN besides Cloudflare R2

---

*Integration audit: 2026-03-11*
