# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** API-first monorepo with modular backend (NestJS + tRPC), React frontend (Next.js 14), and shared type-safe packages.

**Key Characteristics:**
- tRPC bridges full-stack TypeScript with zero runtime API layer
- Authentication via JWT access tokens (memory) + refresh tokens (httpOnly cookies)
- WebSocket gateway for real-time match state synchronization
- Modular service/router pattern per domain (auth, card, deck, collection, match, etc.)
- Database: PostgreSQL via Drizzle ORM with strict type safety
- Rate limiting middleware at tRPC procedure level (public/auth/authenticated tiers)
- Offline-first design: card database bundled in web app
- Multi-tenant card data from external repo (`riftbound-tcg-data/`)

## Layers

**tRPC Router Layer:**
- Purpose: Unified RPC endpoint; merges all module routers into single API surface
- Location: `apps/api/src/trpc/`
- Contains: Procedures (public, protected, optional-auth), middleware, context, rate limiting
- Depends on: All module routers
- Used by: Web app via `@trpc/react-query`, mobile via `@trpc/client`

**Module Layer (Service + Router):**
- Purpose: Domain-specific business logic and API exposure
- Location: `apps/api/src/modules/{auth,deck,collection,card,match,user,etc.}/`
- Contains: `.service.ts` (logic), `.router.ts` (tRPC procedures), `.module.ts` (NestJS DI)
- Depends on: Core infrastructure (DB, Redis, R2), shared schemas
- Used by: TrpcRouter merges them into final AppRouter

**Core Infrastructure:**
- Purpose: Singleton instances for DB, Redis, R2, shared config
- Location: `apps/api/src/core/core.module.ts`
- Contains: DB_TOKEN, REDIS_TOKEN, R2_TOKEN providers
- Depends on: Environment variables
- Used by: Every module via NestJS factory injection

**Shared Packages:**
- `@la-grieta/db`: Drizzle schema, client, relations, migrations
- `@la-grieta/shared`: Zod validation schemas, types, constants, utilities (deck parser, draw logic, etc.)
- `@la-grieta/r2`: Cloudflare R2 client wrapper and presigned URL generation
- Purpose: DRY type definitions and logic across API + web
- Used by: API modules and Next.js pages/components

**Web App (Next.js):**
- Purpose: SSR-first React UI with client interactivity
- Location: `apps/web/src/app/`
- Pages: Public routes (`/`, `/cards`, `/cards/[id]`) + protected routes under `(dashboard)` layout group
- Components: Reusable UI in `src/components/`, hooks in `src/hooks/`, context in `src/lib/`
- Depends on: tRPC client, auth context, design system classes
- Data fetching: tRPC procedures via `trpc.useQuery()` and `trpc.useMutation()`

**WebSocket Layer (Match):**
- Purpose: Real-time bidirectional state synchronization for active matches
- Location: `apps/api/src/modules/match/match.gateway.ts`
- Gateway runs on `/match` namespace with Socket.IO
- Events: `battlefield:tap`, `battlefield:submit`, `phase:advance`, `turn:advance`, `match:pause`, `match:end`, `match:undo`
- Emits back: `state:patch`, `state:full`, `battlefield:reveal`, `match:ended`, `error`
- Used by: Web app via `src/lib/match-socket.ts` subscriber + `use-match-socket.ts` hook

## Data Flow

**Authentication Flow:**
1. User submits credentials → tRPC `auth.register` or `auth.login` mutation
2. AuthService hashes password (bcryptjs), inserts user, generates JWT access token + refresh token
3. Refresh token set as httpOnly cookie by Express response
4. Access token sent in response body → stored in React context (`src/lib/auth-context.tsx`)
5. On mount: AuthProvider calls `auth.refresh` silently to restore session from cookie
6. All requests: tRPC client reads token from context, adds `Authorization: Bearer <token>` header
7. Server: `authMiddleware` verifies JWT, checks Redis blacklist
8. On logout: token added to Redis blacklist with TTL = remaining JWT expiry

**Collection Management Flow:**
1. User views collection → tRPC `collection.list` (protected query)
2. CollectionService queries DB for user's collection entries (quantities, conditions)
3. Joins with card metadata from local bundled card DB (set IDs, names, images)
4. Returns paginated collection with card details
5. User adds copies → tRPC `collection.add` mutation
6. Service validates card exists, increments quantity or creates new entry
7. R2 presigned URL generated for card image upload (if custom scan)
8. Image stored in R2 → URL saved in collection entry

**Deck Building Flow:**
1. User clicks "Create Deck" → page navigates to deck builder
2. tRPC `deck.create` mutation creates empty deck, returns deck ID
3. User adds cards → tRPC `deck.setCards` mutation with card IDs
4. DeckService validates buildability (card counts, deck size, format rules)
5. BuildabilityStatus computed: LEGAL, INCOMPLETE, INVALID (stored in DB)
6. Share code: tRPC `deck.generateShareCode` creates base64-encoded share code, saved with TTL
7. Import: tRPC `deck.importFromText` or `deck.importFromUrl` parses text/URL, validates, creates deck
8. Browse public decks: tRPC `deck.browse` (public query) filters by filters, returns paginated results

**Match Play Flow:**
1. User enters match code → page connects WebSocket to `/match?code={code}`
2. MatchGateway confirms code, sends `state:full` event with entire match state
3. User selects cards for battlefield → sends `battlefield:set-local` (optimistic local update)
4. User submits selection → sends `battlefield:submit` event
5. Service stores submission, checks if both players ready
6. If both ready: gateway broadcasts `battlefield:reveal` with both selections
7. MatchService computes battlefield showdown results (combat logic)
8. User advances phase/turn → sends `phase:advance` or `turn:advance`
9. Service updates match state in DB, broadcasts `state:patch` to both players
10. On match end: `match:end` event → service computes final score, saves match history

**State Management:**
- **Server state**: PostgreSQL (single source of truth for persistence)
- **In-flight state**: Redis (session tokens blacklist, temporary match snapshots)
- **Client state**: React context (auth), React Query cache (tRPC queries), local state (form fields)
- **Real-time state**: WebSocket events push full/patch updates to match participants

## Key Abstractions

**Router Factory Pattern:**
- Purpose: Each module exports a router builder that merges into root AppRouter
- Examples: `AuthRouter`, `DeckRouter`, `CollectionRouter` in `apps/api/src/modules/*/router.ts`
- Pattern: Constructor receives TrpcService + domain service; `buildRouter()` method returns tRPC router definition
- Benefit: Decouples routing from business logic, enables modular registration

**Service Injection via Factory:**
- Purpose: Provide singletons of DB/Redis/R2 to services without tight coupling
- Example: `DeckService` injected with `DB_TOKEN` and `REDIS_TOKEN` from CoreModule
- Pattern: NestJS factory providers with `useFactory` + `inject` array
- Benefit: Easy testing (mock DB/Redis), single instance per app lifecycle

**tRPC Middleware Pipeline:**
- Purpose: Composable auth, rate limiting, logging across all procedures
- Examples: `publicProcedure`, `protectedProcedure`, `rateLimitedPublicProcedure`
- Pattern: Each middleware wraps previous via `.use()` chain
- Auth middleware: verifies JWT, checks Redis blacklist, sets `userId` in context
- Rate limit middleware: checks Redis counter, increments, enforces limit per IP/user
- Benefit: Reusable, testable, composable auth + rate limiting without boilerplate

**Zod Schema as Single Source of Truth:**
- Purpose: Unified validation across API input, API output, web forms
- Examples: `deckCreateSchema`, `collectionAddSchema` in `@la-grieta/shared/src/schemas/`
- Pattern: Zod schema defines both parsing + TypeScript types
- API uses: `tRPC .input(schema).mutation()` for automatic validation
- Web uses: Import type `z.infer<typeof schema>` for form typing
- Benefit: No duplicated validation logic, guaranteed API-web type safety

**Match State Patch System:**
- Purpose: Minimize bandwidth for real-time match updates
- Pattern: `state:full` sent on connect (entire match object); `state:patch` sent on mutations (only changed fields)
- Example: Battlefield tap mutation returns only `{battlefields: [...]}`, gateway broadcasts as `state:patch`
- Benefit: Reduces message size, avoids full re-renders on client

**Auth Context + tRPC Link Integration:**
- Purpose: Centralize token lifecycle (refresh, expiry, logout)
- Pattern: AuthProvider holds access token in memory ref, tRPC httpLink reads token synchronously
- Refresh: Proactive refresh every 12 minutes (80% of 15-min TTL) to avoid 401 mid-request
- On 401: tRPC error triggers token refresh, request is NOT retried (client should retry manually)
- Benefit: Single source of token state, automatic silent refresh, no localStorage exposure

## Entry Points

**API Bootstrap:**
- Location: `apps/api/src/main.ts`
- Triggers: NestFactory.create(AppModule) → bootstraps Express server with Socket.IO adapter
- Responsibilities: Config (CORS, JSON limit 5MB, helmet, cookie parser), set global API prefix, start server on port 3001

**Web Bootstrap:**
- Location: `apps/web/src/app/layout.tsx` (root layout)
- Triggers: Next.js app server on port 3000
- Responsibilities: Load fonts, set metadata/viewport, wrap Providers (auth context, tRPC client, i18n)

**tRPC Entry Point:**
- Location: `apps/api/src/trpc/trpc.router.ts` → builds AppRouter (merged from 12 module routers)
- Serves at: `/api/trpc/{auth,card,user,deck,collection,match,...}` via Express adapter
- All module routers attached: merges auth, card, user, collection, wishlist, deck, priceSync, scanner, deckRecommendations, deckSync, match, news

**WebSocket Entry Point:**
- Location: `apps/api/src/modules/match/match.gateway.ts`
- Runs on: `/match` namespace via Socket.IO
- Triggered: Web app connects on `/match?code={code}` when joining match board page

**Protected Route Guard:**
- Location: `apps/web/src/components/dashboard-guard.tsx`
- Used by: `(dashboard)` layout group wraps all protected pages
- Redirects: Unauthenticated users to `/` home page

## Error Handling

**Strategy:** Three-tier: input validation → service exception → tRPC error response

**Patterns:**

1. **Input Validation:**
   - tRPC `.input(schema)` validates request via Zod
   - Schema defines allowed fields, types, constraints
   - Zod error thrown automatically → tRPC catches, returns 400 with field errors

2. **Service Exceptions:**
   - Service methods throw Error or TRPCError with specific code
   - Examples: `throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' })`
   - Codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST, INTERNAL_SERVER_ERROR, etc.

3. **Error Response Format:**
   - tRPC v11 response: `{ ok: false, error: { code, message, data: { stack?, ... } } }`
   - Stack trace included in dev mode only (stripped in production)
   - Web client receives error, can display user-friendly message or retry

4. **Authentication Errors:**
   - Missing token: `throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing access token' })`
   - Invalid token: caught, re-thrown as UNAUTHORIZED
   - Blacklisted token: checked in Redis, return UNAUTHORIZED if found
   - Expired token: JWT.verify throws, caught, return UNAUTHORIZED

5. **Rate Limit Errors:**
   - TRPCError with code 'TOO_MANY_REQUESTS' if limit exceeded
   - Message includes retry-after info
   - Client receives 429-equivalent error

## Cross-Cutting Concerns

**Logging:**
- Framework: Node `console` (development friendly)
- Pattern: `console.log` in tRPC middleware logs `[tRPC] {type} {path} — {ok|error} ({duration}ms)`
- Services log: key mutations (auth, deck creation, match state changes) for debugging
- Not logged: sensitive data (passwords, tokens, PII)

**Validation:**
- Framework: Zod (shared package)
- Pattern: Every tRPC input validated via schema before reaching router handler
- Custom validation in services: e.g., deck buildability, collection card existence
- Errors propagated as TRPCError to client

**Authentication:**
- Framework: jsonwebtoken (JWT) + Redis (blacklist)
- Pattern: Middleware extracts Authorization header, verifies signature, checks blacklist
- Context enriched: `userId` + `userRole` available to protected procedures
- Token refresh: httpOnly cookie + proactive refresh in auth context

**Authorization:**
- Pattern: Check `ctx.userId` matches resource owner before mutation (e.g., deck update)
- Public queries: no check (e.g., deck.browse returns only public decks)
- Protected queries: implicitly check user is authenticated
- Role-based: future expansion via `ctx.userRole`

**CORS:**
- Configured in `main.ts`: origins from CORS_ORIGINS env var (default: localhost:3000)
- Credentials: true (allows cookies)
- Enforced by Express middleware before route handlers

---

*Architecture analysis: 2026-03-15*
