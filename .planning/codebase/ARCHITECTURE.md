# Architecture

**Analysis Date:** 2025-03-11

## Pattern Overview

**Overall:** Monorepo with API-first architecture using NestJS + tRPC backend and Next.js 14 web frontend.

**Key Characteristics:**
- **Modular backend:** NestJS modules organized by domain (auth, card, collection, deck, user, etc.)
- **tRPC-first API:** All features exposed via tRPC procedures before reaching the frontend
- **Shared types:** Zod schemas and types in `@la-grieta/shared` package prevent type drift between frontend and backend
- **Database-first:** Drizzle ORM with PostgreSQL; schema is the source of truth for data models
- **Server-side rendering:** Next.js 14 with app router; pages are server components by default
- **Memory-only authentication:** Access tokens in React state (not localStorage); refresh tokens in httpOnly cookies

## Layers

**Presentation (Next.js Web):**
- Purpose: Render pages and interactive UI; consume tRPC API
- Location: `apps/web/src/app/` and `apps/web/src/components/`
- Contains: Server and client components, page layouts, route handlers
- Depends on: tRPC client (`@la-grieta/shared`), React Query for caching
- Used by: End users via browser

**API Gateway (tRPC + NestJS):**
- Purpose: Expose domain procedures over HTTP; coordinate authentication, validation, authorization
- Location: `apps/api/src/trpc/`
- Contains: tRPC router definition, context setup, procedure builders (public, authenticated)
- Depends on: Service layer, authentication middleware
- Used by: Web frontend via tRPC client, mobile apps

**Service Layer (NestJS Modules):**
- Purpose: Business logic, database operations, external integrations
- Location: `apps/api/src/modules/[domain]/`
- Contains: `*.service.ts` files with use cases (e.g., `AuthService`, `CardService`)
- Depends on: Database client, Redis, external APIs
- Used by: tRPC routers, scheduled tasks

**Data Layer (Drizzle ORM):**
- Purpose: Database schema and queries
- Location: `packages/db/src/schema/` and `packages/db/src/client.ts`
- Contains: Table definitions, relations, type inference
- Depends on: PostgreSQL
- Used by: Services via `@la-grieta/db` package import

**Shared Layer:**
- Purpose: Type-safe definitions, constants, utilities used across backend and frontend
- Location: `packages/shared/src/`
- Contains: Zod schemas, types, constants (card types, listing statuses, order enums), utilities (pagination, currency)
- Depends on: Zod
- Used by: All packages (API, Web, DB)

## Data Flow

**Authentication Flow:**

1. User submits login/register form on web app
2. Form handler calls `auth.register` or `auth.login` tRPC procedure
3. `AuthRouter` validates input against `registerSchema` / `loginSchema` (from `@la-grieta/shared`)
4. `AuthService` hashes password with bcryptjs, writes to `users` table via Drizzle
5. API generates JWT access token (in-memory on client) and refresh token (httpOnly cookie)
6. Web app stores access token in React state via `AuthContext`
7. On subsequent requests, `auth-context.tsx` reads token from state and passes it as Bearer token
8. `authMiddleware` in `trpc.service.ts` verifies JWT and checks Redis blacklist
9. On 401, `auth-context.tsx` automatically calls refresh endpoint to get new token

**Card Browsing Flow:**

1. User navigates to `/cards` (server component)
2. Page component calls tRPC `card.list` procedure
3. `CardRouter` validates pagination + filter params via Zod
4. `CardService` queries `cards` table via Drizzle, applies filters
5. Results are cached in React Query and returned to component
6. Component renders cards using design system classes (`lg-*`)

**Deck Building Flow:**

1. User navigates to `/decks/new` (client component)
2. Form calls `deck.create` tRPC procedure with deck cards array
3. `DeckRouter` validates deck structure via `deckSchema`
4. `DeckService` writes deck + card associations to `decks` and `deck_cards` tables
5. Page redirects to `/decks/[id]` to view the created deck

**State Management:**

- **Server state:** PostgreSQL database (source of truth)
- **Client state:** React state (auth tokens), React Query cache (tRPC responses)
- **Cache:** Redis used by backend for rate limiting, token blacklist (logout), session management
- **Error handling:** Zod validation catches bad input; tRPC error formatter returns consistent error shapes to frontend

## Key Abstractions

**Module Pattern (NestJS):**
- Purpose: Group related services, routers, and exports
- Examples: `AuthModule` (`apps/api/src/modules/auth/`), `CardModule`, `DeckModule`
- Pattern: Each module exports a router (for tRPC), service, and its dependencies

**tRPC Router Pattern:**
- Purpose: Define public and protected procedures with consistent error handling
- Examples: `AuthRouter` (`auth.login`, `auth.register`, `auth.refresh`)
- Pattern: Routers call `this.trpc.publicProcedure` or `this.trpc.protectedProcedure`, add input/output validation, invoke service methods

**Service Pattern:**
- Purpose: Encapsulate business logic
- Examples: `AuthService` (hashing, JWT generation), `CardService` (card queries), `DeckService` (deck management)
- Pattern: Constructor accepts DB client and Redis client via dependency injection; methods validate and perform database operations

**Schema-as-Type-Source (Zod):**
- Purpose: Single source of truth for type safety across API and frontend
- Examples: `registerSchema`, `loginSchema`, `deckSchema` in `packages/shared/src/schemas/`
- Pattern: `z.infer<typeof schema>` generates TypeScript types from Zod schemas; API input validation uses `.parse()`, client uses generated types

**Design System Classes:**
- Purpose: Reusable styled components via Tailwind CSS component classes
- Location: `apps/web/src/app/globals.css`
- Pattern: `lg-btn-primary`, `lg-btn-secondary`, `lg-text-primary`, `lg-text-secondary` are defined as `@apply` directives; components use these class names, not raw Tailwind

## Entry Points

**API Server:**
- Location: `apps/api/src/main.ts`
- Triggers: `npm run dev` in workspace or `pnpm --filter @la-grieta/api dev`
- Responsibilities: Bootstrap NestJS app, set global middleware (helmet, CORS, cookie parser), set global API prefix, listen on port 3001

**Web App:**
- Location: `apps/web/src/app/layout.tsx` (root layout, server component)
- Triggers: `npm run dev` in workspace or `pnpm --filter @la-grieta/web dev`
- Responsibilities: Set up Next.js app, wrap with Providers (tRPC client, React Query, AuthContext), inject global styles

**Home Page:**
- Location: `apps/web/src/app/page.tsx`
- Triggers: User visits `/`
- Responsibilities: Show landing page if unauthenticated, redirect to `/collection` if authenticated

**Dashboard Layout:**
- Location: `apps/web/src/app/(dashboard)/layout.tsx`
- Triggers: User visits any `/dashboard/*` route
- Responsibilities: Wrap pages with DashboardGuard (auth check), render DashboardNav with bottom navigation

**Card Browser:**
- Location: `apps/web/src/app/cards/page.tsx` and `apps/web/src/app/cards/[id]/page.tsx`
- Triggers: User visits `/cards` or `/cards/[id]`
- Responsibilities: Fetch cards list or detail, render card grid or detail view (accessible to authenticated and unauthenticated users)

## Error Handling

**Strategy:** Zod input validation first, then service-level error checks, then tRPC error formatter.

**Patterns:**

- **Input validation:** All tRPC procedures use `.input(schema)` with Zod. Invalid input throws `ZOD_ERROR` automatically.
  - Example: `auth.login` uses `.input(loginSchema)`, which validates email/password format before reaching the service.

- **Service errors:** Throw TRPCError with specific codes (`UNAUTHORIZED`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`, `BAD_REQUEST`).
  - Example: `AuthService.login()` throws `TRPCError({ code: 'UNAUTHORIZED' })` if password doesn't match.

- **Middleware errors:** Authentication middleware catches JWT errors and returns `UNAUTHORIZED`.
  - Example: `authMiddleware` in `trpc.service.ts` catches expired tokens, invalid signatures.

- **Error response shape:** Consistent `{ code, message, data }` sent to frontend via tRPC error formatter.
  - Stack traces stripped in production; included in development.

## Cross-Cutting Concerns

**Logging:** Console.log in production-ready format. `trpc.service.ts` has `loggingMiddleware` that logs all tRPC calls with duration.
- Format: `[tRPC] {type} {path} — {status} ({duration}ms)`

**Validation:** Zod schemas in `packages/shared/src/schemas/`. Every tRPC input is validated before reaching the service.
- Usage: All API routers call `.input(schema)` on procedures.
- Pattern: Services also re-validate data before database operations (belt-and-suspenders).

**Authentication:** JWT-based with httpOnly refresh token cookies.
- Access tokens: In-memory React state on client (short-lived, 15 minutes)
- Refresh tokens: httpOnly cookies (long-lived, 30 days)
- Blacklist: Redis blacklist checked on every authenticated request
- Rate limiting: `checkRateLimit()` middleware on public procedures (100 req/min per IP)

**Authorization:** Role-based (user/admin) via JWT payload and Redis checks.
- Example: Marketplace endpoints check user role before allowing listing creation.

**Rate Limiting:** Middleware in `apps/api/src/modules/throttler/rate-limit.middleware.ts`.
- Applied to: Public procedures (100 req/min per IP), authenticated procedures (1000 req/min per user)
- Implementation: Client IP extracted via `X-Forwarded-For` (trust proxy set in main.ts)

---

*Architecture analysis: 2025-03-11*
