# Codebase Structure

**Analysis Date:** 2025-03-11

## Directory Layout

```
project-root/
├── apps/
│   ├── api/                    # NestJS API server (port 3001)
│   │   ├── src/
│   │   │   ├── main.ts         # Bootstrap, middleware setup
│   │   │   ├── app.module.ts   # Root module
│   │   │   ├── core/           # Global providers (DB, Redis)
│   │   │   ├── config/         # Config classes (AuthConfig, etc.)
│   │   │   ├── modules/        # Domain modules (auth, card, deck, etc.)
│   │   │   ├── trpc/           # tRPC server, routers, context
│   │   │   └── common/         # Reusable decorators, filters, guards, interceptors
│   │   └── package.json
│   │
│   └── web/                    # Next.js 14 web app (port 3000)
│       ├── src/
│       │   ├── app/            # App router structure (pages, layouts, routes)
│       │   │   ├── (auth)/     # Auth group: login, register
│       │   │   ├── (dashboard)/# Dashboard group: collection, decks, profile, scanner
│       │   │   ├── cards/      # Card browser (public)
│       │   │   ├── layout.tsx  # Root layout
│       │   │   ├── page.tsx    # Landing page
│       │   │   └── globals.css # Design system classes
│       │   ├── components/     # Reusable components (nav, ui, etc.)
│       │   ├── lib/            # Client utilities (auth-context, trpc, providers)
│       │   ├── hooks/          # Custom hooks
│       │   └── types/          # TypeScript type definitions
│       └── package.json
│
├── packages/                   # Shared libraries
│   ├── db/                     # Database schemas, client, migrations
│   │   ├── src/
│   │   │   ├── schema/         # Drizzle table definitions
│   │   │   ├── client.ts       # Database client factory
│   │   │   ├── relations.ts    # Drizzle relations
│   │   │   ├── migrate.ts      # Migration runner
│   │   │   └── index.ts        # Main export (schema + client)
│   │   ├── drizzle/            # Migration files (auto-generated)
│   │   ├── drizzle.config.ts   # Drizzle config
│   │   └── package.json
│   │
│   ├── shared/                 # Shared types, schemas, constants
│   │   ├── src/
│   │   │   ├── schemas/        # Zod schemas (auth, card, deck, etc.)
│   │   │   ├── constants/      # Enums and constants
│   │   │   ├── utils/          # Shared utilities (pagination, currency, like)
│   │   │   └── index.ts        # Main export (all schemas, types, utils)
│   │   └── package.json
│   │
│   ├── r2/                     # Cloudflare R2 client
│   │   ├── src/
│   │   │   └── index.ts        # R2 SDK wrapper
│   │   └── package.json
│   │
│   ├── eslint-config/          # Shared ESLint rules
│   │   ├── base.js             # Base config (TypeScript, imports)
│   │   ├── nestjs.js           # NestJS-specific rules
│   │   ├── next.js             # Next.js-specific rules
│   │   └── .prettierrc.js       # Prettier config
│   │
│   └── tsconfig/               # Shared TypeScript configs
│       ├── base.json           # Base tsconfig (strict mode, paths)
│       ├── nestjs.json         # NestJS-specific
│       ├── nextjs.json         # Next.js-specific
│       └── react-native.json   # React Native (future)
│
├── tools/                      # Utility scripts
│   ├── seed/                   # Database seeding scripts
│   └── hash-cards/             # Card data hashing utility
│
├── riftbound-tcg-data/         # External card data (cloned repo, DO NOT MODIFY)
│   ├── sets/en.json            # Set metadata
│   └── cards/en/               # Card data per set
│
├── docs/                       # Documentation
│
├── certs/                      # HTTPS certificates (dev only)
│
├── .github/                    # GitHub workflows (CI/CD)
│
├── .planning/                  # GSD planning documents
│   └── codebase/               # Architecture, structure, conventions, testing
│
├── tsconfig.json               # Root TypeScript config
├── turbo.json                  # Turbo monorepo build config
├── pnpm-workspace.yaml         # pnpm workspace definition
├── pnpm-lock.yaml              # Lockfile
├── prettier.config.js          # Global Prettier config
├── eslint.config.js            # Global ESLint config
├── package.json                # Root package.json (scripts)
├── Dockerfile                  # Docker image for API
├── docker-compose.yml          # Local dev environment
├── railway.toml                # Railway deployment config
└── .env.example                # Environment template
```

## Directory Purposes

**apps/api/src/modules/:**
- Purpose: Domain-driven modules containing service logic and tRPC routers
- Contains: One subdirectory per domain (auth, card, collection, deck, user, scanner, etc.)
- Key files: `*.service.ts` (business logic), `*.router.ts` (tRPC procedures), `*.module.ts` (NestJS module def)

**apps/api/src/core/:**
- Purpose: Global providers and dependencies (database, Redis)
- Contains: `core.module.ts` which exports DB_TOKEN and REDIS_TOKEN
- Key files: `core.module.ts` defines providers for PostgreSQL client and Redis client

**apps/api/src/config/:**
- Purpose: Configuration classes that validate and read environment variables
- Contains: `auth.config.ts` (JWT secrets, TTLs), `database.config.ts`, `redis.config.ts`
- Key files: Each config class has getters that throw if required env vars are missing

**apps/api/src/trpc/:**
- Purpose: tRPC server setup, router composition, context creation
- Contains: tRPC initialization, middleware (auth, logging, rate limiting), router aggregation
- Key files:
  - `trpc.service.ts`: Core tRPC instance with middleware
  - `trpc.router.ts`: Aggregates all module routers
  - `trpc.context.ts`: Context object passed to all procedures
  - `trpc.controller.ts`: Express route handler for tRPC

**apps/api/src/common/:**
- Purpose: Reusable NestJS decorators, filters, guards, interceptors (currently empty placeholders)
- Contains: Organized subdirectories for different NestJS extension types
- Usage: When adding cross-cutting concerns, place them here

**apps/web/src/app/:**
- Purpose: Next.js 14 app router structure
- Contains: Directories for layout groups `(auth)`, `(dashboard)`, and public routes `cards/`
- Pattern: Each route has `page.tsx` (server component by default) and optional `layout.tsx`

**apps/web/src/app/globals.css:**
- Purpose: Design system class definitions
- Contains: `lg-*` component classes (buttons, text styles, colors)
- Usage: Components use `className="lg-btn-primary"` instead of raw Tailwind

**apps/web/src/components/:**
- Purpose: Reusable UI components
- Contains: Navigation components (`smart-nav`, `dashboard-nav`, `public-nav`), UI primitives (in `ui/` subdirectory)
- Key files: `smart-nav.tsx` (renders different nav based on auth state)

**apps/web/src/lib/:**
- Purpose: Utilities and context for client-side logic
- Key files:
  - `auth-context.tsx`: Manages JWT access token in React state, refresh token lifecycle
  - `trpc.ts`: tRPC client configuration with token injection
  - `providers.tsx`: Wraps app with React Query, tRPC, AuthContext

**packages/db/src/schema/:**
- Purpose: Drizzle ORM table definitions
- Contains: One file per table (users.ts, cards.ts, decks.ts, collections.ts, etc.)
- Pattern: Each table exports `typeof table.$inferSelect` as TypeScript type

**packages/shared/src/schemas/:**
- Purpose: Zod validation schemas used by both API and web
- Contains: One file per domain (auth.schema.ts, card.schema.ts, deck.schema.ts, etc.)
- Pattern: Export both schema and inferred type: `export type RegisterInput = z.infer<typeof registerSchema>`

## Key File Locations

**Entry Points:**
- API: `apps/api/src/main.ts` — Bootstraps NestJS, sets middleware, listens on port 3001
- Web: `apps/web/src/app/layout.tsx` — Root layout (server component), wraps with Providers
- API router: `apps/api/src/trpc/trpc.router.ts` — Aggregates all domain routers

**Configuration:**
- API env vars: `apps/api/src/config/auth.config.ts`, `database.config.ts`
- Web tRPC client: `apps/web/src/lib/trpc.ts` — Configures httpLink with token injection
- Web auth: `apps/web/src/lib/auth-context.tsx` — Token lifecycle, refresh logic

**Core Logic:**
- Authentication: `apps/api/src/modules/auth/auth.service.ts` — Hashing, JWT, refresh
- Card queries: `apps/api/src/modules/card/card.service.ts` — Filter, sort, paginate cards
- Deck management: `apps/api/src/modules/deck/deck.service.ts` — Deck CRUD operations
- Database schema: `packages/db/src/schema/` — All table definitions (users, cards, decks, etc.)

**Testing:**
- API tests: Vitest configs at `apps/api/` root level
- Web tests: Not yet set up (Next.js testing patterns TBD)

**Type Definitions:**
- Shared schemas: `packages/shared/src/schemas/` — Zod schemas as single source of truth
- Database types: `packages/db/src/schema/` — Drizzle `$inferSelect` types
- Web types: `apps/web/src/types/` — Frontend-specific types (separate from shared)

## Naming Conventions

**Files:**
- NestJS modules: `{domain}.module.ts` — Example: `auth.module.ts`
- Service files: `{domain}.service.ts` — Example: `card.service.ts`
- tRPC routers: `{domain}.router.ts` — Example: `deck.router.ts`
- Zod schemas: `{domain}.schema.ts` — Example: `collection.schema.ts`
- Database schema: `{domain}.ts` in `packages/db/src/schema/` — Example: `users.ts`
- Components: kebab-case.tsx — Example: `smart-nav.tsx`, `dashboard-guard.tsx`
- Pages: `page.tsx` and `layout.tsx` in next.js app router structure
- Config files: `{service}.config.ts` — Example: `auth.config.ts`

**Directories:**
- Modules: plural or singular domain name — Example: `modules/auth/`, `modules/card/`
- Layout groups (Next.js): parentheses syntax — Example: `(auth)`, `(dashboard)`
- Dynamic routes: square brackets — Example: `[id]/page.tsx` → `/decks/[id]`
- Shared packages: lowercase with hyphens — Example: `eslint-config`, `tsconfig`

**Variables and Functions:**
- camelCase for variables and functions
- PascalCase for classes, interfaces, types
- UPPER_SNAKE_CASE for constants (e.g., `BCRYPT_ROUNDS`, `REFRESH_GRACE_PERIOD_MS`)

## Where to Add New Code

**New Feature (Database + API + Web):**

1. **Database schema:** Add table to `packages/db/src/schema/{domain}.ts`
   - Example: Creating a new listing feature → `packages/db/src/schema/listings.ts`
   - Define table with Drizzle, export type via `$inferSelect`

2. **Shared schema:** Add Zod schema to `packages/shared/src/schemas/{domain}.schema.ts`
   - Example: `packages/shared/src/schemas/listing.schema.ts`
   - Define validation rules, export types via `z.infer`

3. **API module:** Create `apps/api/src/modules/{domain}/`
   - `{domain}.module.ts` — NestJS module with dependencies
   - `{domain}.service.ts` — Business logic
   - `{domain}.router.ts` — tRPC procedures (public and authenticated)

4. **Web pages:** Create route in `apps/web/src/app/{route}/`
   - `layout.tsx` — If creating a new section, wrap with auth/layout
   - `page.tsx` — Server component by default; add `'use client'` if interactive
   - Call tRPC procedures via React Query hooks

5. **Web components:** Add to `apps/web/src/components/`
   - Use design system classes from `globals.css` (e.g., `className="lg-btn-primary"`)
   - Export component for use in pages

**New Component/Module:**

- Create folder in `apps/web/src/components/{component-name}.tsx`
- Follow component naming: kebab-case file name
- Import and use in pages or other components

**Utilities:**

- Shared helpers: `packages/shared/src/utils/` (used by both API and web)
- API-only utilities: Create folder in `apps/api/src/common/` or within a module
- Web-only utilities: Create folder in `apps/web/src/lib/` or `apps/web/src/utils/` (doesn't exist yet, create as needed)

**Constants:**

- Shared constants: `packages/shared/src/constants/{domain}.constants.ts`
  - Example: Card types, listing statuses, order enums
- API-only constants: Define in `apps/api/src/modules/{domain}/` or `apps/api/src/config/`
- Web-only constants: Define near usage or in `apps/web/src/constants/` (doesn't exist yet)

## Special Directories

**riftbound-tcg-data/:**
- Purpose: External card database (cloned from https://github.com/apitcg/riftbound-tcg-data.git)
- Generated: Yes (cloned via git, not built)
- Committed: Yes (but marked as submodule or externally sourced)
- Usage: Seed script reads this to populate the `cards` table
- Important: DO NOT MODIFY — this is the source of truth from the TCG publisher

**drizzle/ (packages/db/drizzle/):**
- Purpose: Auto-generated migration files
- Generated: Yes (by `drizzle-kit generate`)
- Committed: Yes (track migrations in version control)
- Usage: Run migrations with `drizzle-kit migrate` or `pnpm run migrate` in db package

**.next/ (apps/web/.next/):**
- Purpose: Next.js build output
- Generated: Yes (by `next build`)
- Committed: No (added to .gitignore)
- Note: May cause stale cache issues; delete and restart dev server if pages aren't updating

**node_modules/ and .turbo/:**
- Purpose: Dependencies and build cache
- Generated: Yes
- Committed: No (both in .gitignore)

## Import Path Aliases

Used throughout codebase for cleaner imports:

- `@/` → relative to `apps/web/src/` (Next.js config)
- `@la-grieta/db` → `packages/db/src/` (exported via workspace)
- `@la-grieta/shared` → `packages/shared/src/` (exported via workspace)
- `@la-grieta/api` → `apps/api/src/` (used in web tests/dev tools)

---

*Structure analysis: 2025-03-11*
