# Technology Stack

**Analysis Date:** 2025-03-15

## Languages

**Primary:**
- TypeScript 5.7 - Strict mode across all apps, packages, and tools; no `any` type allowed
- JavaScript (JSX/TSX) - React components in web app

**Secondary:**
- SQL - PostgreSQL queries via Drizzle ORM

## Runtime

**Environment:**
- Node.js 18+ (no `.nvmrc` pinned version, but npm package manager enforced)

**Package Manager:**
- pnpm 9.0.0 (mandatory via `packageManager` field in root `package.json`)
- Lockfile: `pnpm-lock.yaml` (not visible but enforced by pnpm)

## Frameworks

**Core:**
- NestJS 10.x - API backend (`apps/api`)
  - Platform: Express via `@nestjs/platform-express`
  - Scheduler: `@nestjs/schedule` for cron jobs
  - WebSockets: `@nestjs/websockets` and `socket.io`

- Next.js 14.2 - Web frontend (`apps/web`)
  - App Router (Next.js 14)
  - Internationalization: `next-intl` 4.8
  - Image optimization from CDN

- Drizzle ORM 0.38 - Database abstraction (`packages/db`)
  - Supports PostgreSQL 16 via `pg` driver
  - Strict TypeScript schema-first approach

**API Communication:**
- tRPC 11.x - End-to-end type-safe RPC
  - Server: `@trpc/server` with Express adapter
  - Client: `@trpc/client` + `@trpc/react-query` integration
  - HTTP link only (no batch link due to Express adapter limitation)

**Testing:**
- Vitest 2.1 - Unit and service tests
  - Coverage provider: V8
  - Environment: Node

**Build/Dev:**
- Turbo 2.3 - Monorepo task orchestration
- SWC (@swc/cli, @swc/core) - Fast TypeScript compilation
- Nest CLI 10 - NestJS development server
- ts-loader - TypeScript loader for webpack/NestJS

**Styling:**
- Tailwind CSS 3.4 - Utility-first CSS framework
- PostCSS 8.4 - CSS processing with Tailwind plugin
- Autoprefixer 10.4 - Browser vendor prefixes

**Code Quality:**
- ESLint 9.0 - Linting with shared config from `@la-grieta/eslint-config`
- Prettier 3.0 - Code formatting
- TypeScript compiler - Type checking (`tsc --noEmit`)

## Key Dependencies

**Critical Backend:**
- `express` 5.2 - HTTP server framework
- `jsonwebtoken` 9.0 - JWT signing and verification (HS256/RS256 support)
- `bcryptjs` 2.4 - Password hashing (Alpine Linux compatible)
- `ioredis` 5.4 - Redis client for caching, session storage, rate limiting
- `zod` 3.23 - Runtime schema validation (shared across API and client)
- `drizzle-orm` 0.38 - Type-safe ORM
- `pg` 8.13 - PostgreSQL driver
- `drizzle-kit` 0.29 - ORM schema migrations and introspection

**Frontend:**
- `react` 18.3 - UI library
- `react-dom` 18.3 - React rendering
- `react-query` (via TanStack) 5.56 - Server state management
- `zod` 3.23 - Schema validation on client

**Utilities:**
- `axios` 1.13 - HTTP client for news scraper
- `cheerio` 1.0 - HTML parsing for web scraping
- `sharp` 0.33 - Image processing (card scanning fingerprints)
- `helmet` 8.1 - Security headers
- `cookie-parser` 1.4 - Cookie parsing middleware
- `dotenv` 17.3 - Environment variable loading
- `nanoid` 5.1 - Unique ID generation
- `socket.io` 4.8 - WebSocket library for real-time features
- `tesseract.js` 7.0 - OCR in browser (card recognition fallback)
- `fuse.js` 7.1 - Fuzzy search for card lookup
- `recharts` 3.8 - Chart library for deck statistics
- `sonner` 2.0 - Toast notifications
- `react-qr-code` 2.0 - QR code generation (deck sharing)
- `canvas-confetti` 1.9 - Celebration animations

**AWS SDK:**
- `@aws-sdk/client-s3` 3.600 - Cloudflare R2 (S3-compatible) client
- `@aws-sdk/s3-request-presigner` 3.600 - Presigned URL generation for uploads

## Configuration

**Environment:**
- Root `.env` - PostgreSQL, Redis, JWT secrets, API configuration
- `apps/api/.env` - (generated from root .env at runtime)
- `apps/web/.env.local` - Next.js public API URL and R2 public URL
- Config files: `apps/api/src/config/` (AuthConfig, etc.)

**Build:**
- `tsconfig.json` - Root TypeScript configuration with path aliases
- `packages/tsconfig/` - Shared TypeScript configs for workspaces
- `turbo.json` - Monorepo build pipeline and caching
- `vitest.config.ts` - Per-workspace test configuration (apps/api, packages/db, tools/seed)
- `next.config.mjs` - Next.js configuration with image remotePatterns and API rewrites

**Required env vars (critical):**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - HS256 secret (or JWT_PRIVATE_KEY/JWT_PUBLIC_KEY for RS256)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` - Cloudflare R2
- `NEXT_PUBLIC_API_URL` - Web app to API URL (e.g., `http://localhost:3001/api`)

**Optional env vars (Phase 4+):**
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` - Payment processing
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` - WhatsApp Cloud API
- Rate limiting: `THROTTLE_PUBLIC_LIMIT`, `THROTTLE_AUTH_LIMIT`, `THROTTLE_LOGIN_LIMIT`

## Platform Requirements

**Development:**
- Docker + Docker Compose (for local PostgreSQL 16 and Redis 7 via `docker-compose.yml`)
- Node.js 18+
- pnpm 9.0+

**Production:**
- Node.js 18+ runtime
- PostgreSQL 16 database
- Redis 7 cache layer
- Cloudflare R2 bucket for file storage
- HTTPS with valid certificate

**Deployment Target:**
- Containerizable (Docker-ready with `Dockerfile` not yet visible but implied by docker-compose)
- Works on Alpine Linux (bcryptjs required, native bcrypt hangs)

---

*Stack analysis: 2025-03-15*
