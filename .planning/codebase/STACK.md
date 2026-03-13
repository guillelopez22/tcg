# Technology Stack

**Analysis Date:** 2026-03-11

## Languages

**Primary:**
- TypeScript 5.7 - All source code (strict mode enforced)
- JavaScript - Build configuration files, configuration files

**Runtime:**
- Node.js 20-alpine - Docker base image
- Browser (React 18.3) - Web frontend

## Runtime & Package Manager

**Environment:**
- Node.js 20 LTS (Alpine Linux in production)

**Package Manager:**
- pnpm 9.0.0
- Lockfile: `pnpm-lock.yaml` (present)
- Workspace: `pnpm-workspace.yaml` - monorepo with apps and packages

## Frameworks

**Backend:**
- NestJS 10.0.0 - API server framework (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`)
- NestJS Schedule 6.1.1 - Cron job scheduling

**Frontend Web:**
- Next.js 14.2.0 - React framework with SSR/SSG
- React 18.3.0 - UI component library
- React Query/TanStack Query 5.56.0 - Server state management

**RPC & API:**
- tRPC 11.0.0 - Type-safe RPC framework with httpLink adapter (NOT httpBatchLink)
- Express 5.2.1 - HTTP server used by NestJS and tRPC

**Testing:**
- Vitest 2.1.0 - Test runner (all apps: `apps/api`, `packages/db`)
- Vitest Coverage v8 2.1.0 - Code coverage reporting

**Build & Development:**
- Turbo 2.3.0 - Monorepo build orchestration
- SWC 1.15.18 - TypeScript compiler with `@swc/cli`, `@swc/core`, `@swc-node/register`
- tsc (TypeScript compiler) - Type checking
- ts-loader 9.5.4 - Webpack/build TypeScript loader
- ts-node 10.9.2 - Node.js TypeScript execution
- tsconfig-paths 4.2.0 - Path alias resolution

**Styling:**
- Tailwind CSS 3.4.0 - Utility-first CSS framework
- PostCSS 8.4.0 - CSS processing
- Autoprefixer 10.4.0 - Vendor prefix generation

**Code Quality:**
- ESLint 9.0.0 - Linting (with custom shared config `@la-grieta/eslint-config`)
- Prettier 3.0.0 - Code formatting

## Key Dependencies

**Critical:**
- zod 3.23.0 - Schema validation for tRPC, API inputs, and shared types (single source of truth)
- drizzle-orm 0.38.0 - ORM for PostgreSQL queries (no raw SQL in application code)

**Authentication & Security:**
- jsonwebtoken 9.0.0 - JWT token creation/verification
- bcryptjs 2.4.3 - Password hashing (pure JavaScript — avoids Alpine Linux glibc issues with native bcrypt)
- helmet 8.1.0 - Security headers (Content-Security-Policy, X-Frame-Options, etc.)
- cookie-parser 1.4.7 - HTTP-only cookie parsing for refresh tokens

**Database & Caching:**
- pg 8.13.0 - PostgreSQL client adapter
- ioredis 5.4.0 - Redis client for caching
- drizzle-kit 0.29.0 - Database migration tooling

**File Storage:**
- @aws-sdk/client-s3 3.600.0 - Cloudflare R2 API client (AWS S3 compatible)
- @aws-sdk/s3-request-presigner 3.600.0 - Presigned URL generation for secure uploads
- sharp 0.33.0 - Image processing (resizing, encoding) for scanner fingerprints

**Data Processing:**
- tesseract.js 7.0.0 - OCR library (web app) for card text recognition
- fuse.js 7.1.0 - Fuzzy search library for card lookup

**Utilities:**
- dotenv 17.3.1 - Environment variable loading
- reflect-metadata 0.2.0 - Reflection API for NestJS decorators
- rxjs 7.8.0 - Reactive programming for NestJS observables
- sonner 2.0.7 - Toast notification library (web)

## Configuration

**Environment:**
- `.env` file (never committed) - loaded via `dotenv` in `apps/api/src/main.ts`
- `.env.example` - template with all required variables
- Environment variables configuration:
  - `NODE_ENV` - development/production
  - `API_PORT` - API server port (default 3001)
  - `API_PREFIX` - Global API route prefix (default "api")
  - Database, Redis, JWT, R2, CORS, rate limiting settings
  - Future: Stripe, WhatsApp configuration

**Build:**
- `turbo.json` - Monorepo build orchestration config
- `tsconfig.json` (root) - Base TypeScript strict mode config
- `apps/api/tsconfig.json` - API-specific TypeScript config
- `apps/web/tsconfig.json` - Web-specific TypeScript config
- `packages/*/tsconfig.json` - Package-specific configs
- `packages/db/drizzle.config.ts` - Database migration config (dialect: postgresql)
- `apps/web/next.config.mjs` - Next.js configuration with image remotes and tRPC rewrites
- `apps/web/tailwind.config.ts` - Tailwind CSS theme customization
- `apps/web/postcss.config.js` - PostCSS pipeline

## Platform Requirements

**Development:**
- Node.js 20+
- pnpm 9.0.0
- PostgreSQL 16 (via Docker compose)
- Redis 7 (via Docker compose)
- Docker & Docker Compose (for local database/cache)

**Production:**
- Node.js 20-alpine
- PostgreSQL 16 (cloud-hosted)
- Redis 7 (cloud-hosted or managed)
- Cloudflare R2 bucket (file storage)
- Deployment: Docker container (Railway.app reference in `railway.toml`)

## Docker

**Multi-stage Build (`Dockerfile`):**
1. **deps stage** - Install pnpm and all dependencies (with frozen lockfile for reproducibility)
2. **builder stage** - Compile TypeScript via Turbo, prune to production-only deps
3. **runner stage** - Minimal production image with dumb-init, non-root user (nestjs), health check

**Database:**
- `docker-compose.yml` - PostgreSQL 16-alpine + Redis 7-alpine
- Automated migrations via `drizzle-kit migrate` at container startup
- Health checks on both services

---

*Stack analysis: 2026-03-11*
