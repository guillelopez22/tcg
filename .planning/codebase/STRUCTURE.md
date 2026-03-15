# Codebase Structure

**Analysis Date:** 2026-03-15

## Directory Layout

```
la-grieta/
├── apps/
│   ├── api/                        # NestJS + tRPC backend
│   │   ├── src/
│   │   │   ├── main.ts             # Bootstrap entry point
│   │   │   ├── app.module.ts       # Root NestJS module
│   │   │   ├── config/             # Env var validation
│   │   │   ├── core/               # DB, Redis, R2 singletons
│   │   │   ├── trpc/               # tRPC router, context, middleware
│   │   │   └── modules/            # Domain modules (auth, deck, etc.)
│   │   ├── __tests__/              # Test files
│   │   └── dist/                   # Compiled output
│   │
│   └── web/                        # Next.js 14 frontend
│       ├── src/
│       │   ├── app/                # App Router pages + layouts
│       │   │   ├── (auth)/         # Public auth routes (login, register)
│       │   │   ├── (dashboard)/    # Protected dashboard routes
│       │   │   ├── cards/          # Public card browser
│       │   │   ├── match/          # Match play pages
│       │   │   ├── layout.tsx      # Root layout
│       │   │   ├── page.tsx        # Home page
│       │   │   ├── error.tsx       # Error boundary
│       │   │   └── not-found.tsx   # 404 page
│       │   ├── components/         # Shared React components
│       │   ├── hooks/              # Custom React hooks
│       │   ├── lib/                # Utilities (auth context, tRPC client, match socket)
│       │   ├── types/              # Type definitions (router type, inferred types)
│       │   ├── i18n/               # Internationalization config
│       │   └── app/globals.css     # Design system classes
│       ├── messages/               # i18n translation files
│       ├── public/                 # Static assets
│       └── .next/                  # Next.js build output
│
├── packages/                       # Shared TypeScript packages
│   ├── db/                         # PostgreSQL + Drizzle ORM
│   │   ├── src/
│   │   │   ├── client.ts           # Drizzle client factory
│   │   │   ├── migrate.ts          # Migration runner
│   │   │   ├── relations.ts        # Table relationships
│   │   │   ├── index.ts            # Exports
│   │   │   └── schema/             # Table definitions (Drizzle)
│   │   ├── drizzle/                # Migration files
│   │   └── scripts/                # Seed scripts
│   │
│   ├── shared/                     # Zod schemas, types, utilities
│   │   ├── src/
│   │   │   ├── constants/          # Card, match, order constants
│   │   │   ├── schemas/            # Zod validation schemas
│   │   │   ├── types/              # TypeScript types
│   │   │   ├── utils/              # Helpers (deck parser, draw logic, etc.)
│   │   │   └── index.ts            # Main export barrel
│   │   └── dist/                   # Compiled output
│   │
│   ├── r2/                         # Cloudflare R2 wrapper
│   │   └── src/
│   │       ├── client.ts           # R2 SDK client factory
│   │       ├── config.ts           # R2 env var validation
│   │       ├── presigned.ts        # Presigned URL generation
│   │       └── index.ts            # Exports
│   │
│   ├── tsconfig/                   # Shared TypeScript config
│   └── eslint-config/              # Shared ESLint rules
│
├── tools/                          # Utility scripts
│   ├── seed/                       # Data seeding scripts
│   │   ├── src/
│   │   │   ├── scrape-riftdecks.ts # Deck scraper for trending decks
│   │   │   ├── sync-riftdecks.ts   # Auto-sync deck data
│   │   │   └── scrape-official-tournaments.ts # Tournament data
│   │   └── __tests__/              # Seed tests
│   │
│   └── hash-cards/                 # Card hash utilities
│
├── docs/                           # Documentation
│   ├── architecture/               # Architecture diagrams
│   └── deployment/                 # Deployment guides
│
├── riftbound-tcg-data/             # External cloned repo (card data source)
│   ├── sets/                       # Set definitions (en.json)
│   └── cards/                      # Card data per set
│       └── en/                     # English cards
│
├── .planning/                      # GSD phase planning and analysis
│   ├── codebase/                   # Architecture docs (this file)
│   ├── phases/                     # Phase execution plans
│   └── research/                   # Research documents
│
├── .claude/                        # Claude Code agent memory and hooks
├── .github/                        # GitHub Actions workflows
├── certs/                          # SSL certificates (dev)
└── root files:
    ├── package.json                # Root workspace (pnpm)
    ├── pnpm-workspace.yaml         # Monorepo config
    ├── turbo.json                  # Turborepo config
    ├── tsconfig.json               # Root TypeScript config
    └── .env                        # Root env vars (shared across apps)
```

## Directory Purposes

**`apps/api/src/modules/`:**
- Purpose: Domain-driven modules organized by feature (auth, deck, collection, etc.)
- Contains: Per-module `.service.ts` (business logic), `.router.ts` (tRPC procedures), `.module.ts` (DI config)
- Pattern: Each module exports router via NestJS DI, router merged into root AppRouter
- Key modules:
  - `auth/`: User registration, login, token refresh, logout
  - `deck/`: CRUD, validation, share codes, import/export, trending suggestions
  - `collection/`: Add/remove cards, track quantities, conditions, R2 uploads
  - `card/`: Search, filter, details (card metadata from local bundled DB)
  - `match/`: Create session, manage game state, score computation
  - `user/`: Profile, settings, preferences
  - `wishlist/`: Want lists per user
  - `news/`: Article scraping, feed aggregation
  - `deck-sync/`: Auto-sync community decks from external sources
  - `scanner/`: Card recognition via image upload + OCR

**`apps/api/src/trpc/`:**
- Purpose: tRPC configuration and unified API endpoint
- Contains:
  - `trpc.router.ts`: Merges all module routers into single AppRouter
  - `trpc.service.ts`: Procedure factories (public, protected, rate-limited variants)
  - `trpc.context.ts`: Context factory and type definitions
  - `trpc.controller.ts`: Express route handler that adapts tRPC to HTTP
  - `trpc-core.module.ts`: NestJS imports for tRPC (minimal)

**`apps/api/src/core/`:**
- Purpose: Global singletons and infrastructure setup
- Contains:
  - `core.module.ts`: Provides DB_TOKEN, REDIS_TOKEN, R2_TOKEN as global exports
  - All modules depend on CoreModule to access database, Redis, R2

**`apps/api/src/config/`:**
- Purpose: Environment variable validation and service configuration
- Contains:
  - `auth.config.ts`: JWT secret, TTL settings
  - `database.config.ts`: PostgreSQL connection URL validation
  - `redis.config.ts`: Redis connection validation (if separate file)
- Pattern: Singletons injected where needed, fail fast on missing/invalid env

**`apps/web/src/app/`:**
- Purpose: Next.js 14 App Router file-based routing
- Layout groups:
  - `(auth)/`: Routes wrapped in auth layout (login, register). No dashboard nav.
  - `(dashboard)/`: Routes wrapped in dashboard layout. Auth-required, shows nav, matches tRPC context.
  - Root routes: `/`, `/cards`, `/cards/[id]` — public, show SmartNav
- Pattern: URL structure mirrors directory structure; `page.tsx` is the route, `layout.tsx` wraps children

**`apps/web/src/components/`:**
- Purpose: Reusable React components
- Examples: `SmartNav`, `DashboardNav`, `PublicNav`, `LanguageToggle`, `MatchQRCode`, `Skeletons`
- Pattern: One component per file, export as default or named, CSS classes via design system (`lg-*` classes)

**`apps/web/src/hooks/`:**
- Purpose: Custom React hooks for state and side effects
- Key hooks:
  - `use-local-game-state.ts`: Local state for match board (battlefield selections, phases)
  - `use-match-socket.ts`: WebSocket subscription to match updates via Socket.IO client

**`apps/web/src/lib/`:**
- Purpose: Utility functions and context providers
- Key files:
  - `auth-context.tsx`: AuthProvider that manages token lifecycle, silent refresh
  - `trpc.ts`: tRPC client factory with httpLink configuration
  - `design-tokens.ts`: Theme values (colors, spacing) for runtime access
  - `match-socket.ts`: Socket.IO client initialization for match namespace
  - `providers.tsx`: Root provider setup (Auth, tRPC, i18n)

**`packages/db/src/schema/`:**
- Purpose: Drizzle ORM table definitions
- Each file defines one entity (tables, indices, constraints):
  - `users.ts`: User accounts, auth
  - `cards.ts`: Card metadata cache from riftbound-tcg-data
  - `collections.ts`: User collection entries (copy ownership)
  - `decks.ts`: User-created decks + share codes
  - `match-sessions.ts`: Active matches
  - Similar files for wishlists, orders, listings, sets, sessions, news articles
- Pattern: Drizzle relations defined in `relations.ts` (one-to-many, many-to-many)

**`packages/shared/src/schemas/`:**
- Purpose: Zod validation schemas (single source of truth for validation + types)
- Each file validates one domain:
  - `auth.schema.ts`: Register, login, refresh token schemas
  - `deck.schema.ts`: Create, update, import, browse deck schemas
  - `collection.schema.ts`: Add card, remove card, quantity update schemas
  - `card.schema.ts`: Search, filter, detail schemas
  - Similar files for user, wishlist, match, order, listing
- Pattern: Export schema, infer type via `z.infer<typeof schema>`

**`packages/shared/src/utils/`:**
- Purpose: Reusable business logic
- Key utilities:
  - `deck-import-parser.ts`: Parses text deck lists (card names → IDs)
  - `validate-deck-format.ts`: Checks deck buildability (legal card counts, total size)
  - `draw-hand.ts`: Game rule for initial hand draw
  - `compute-analytics.ts`: Collection stats (total cards, by set/rarity, etc.)
  - `pagination.ts`: Cursor-based pagination helper

**`tools/seed/src/`:**
- Purpose: Data seeding and sync utilities
- Scripts:
  - `scrape-riftdecks.ts`: Fetch trending decks from riftdecks.com
  - `sync-riftdecks.ts`: Auto-sync decks on schedule (run via cron in production)
  - `scrape-official-tournaments.ts`: Fetch tournament results from official sources
- Pattern: Called manually during dev setup or via scheduled tasks in production

**`riftbound-tcg-data/`:**
- Purpose: External cloned card data repository
- Contains: Set definitions and card metadata (images, cost, rarity, text, TCGPlayer links)
- Do not modify: This is a cloned external repository, all changes come from upstream
- Used by: Seed scripts to load card data into DB, web app uses local bundled copy for offline access

## Key File Locations

**Entry Points:**

| Purpose | File |
|---------|------|
| API bootstrap | `apps/api/src/main.ts` |
| API root module | `apps/api/src/app.module.ts` |
| Web root layout | `apps/web/src/app/layout.tsx` |
| Web home page | `apps/web/src/app/page.tsx` |
| tRPC router assembly | `apps/api/src/trpc/trpc.router.ts` |
| WebSocket gateway | `apps/api/src/modules/match/match.gateway.ts` |

**Configuration:**

| Purpose | File |
|---------|------|
| Root env vars | `.env` |
| API env example | `apps/api/.env.example` |
| Web env example | `apps/web/.env.local.example` |
| Database connection | `packages/db/src/client.ts` |
| Auth config (JWT) | `apps/api/src/config/auth.config.ts` |
| tRPC context | `apps/api/src/trpc/trpc.context.ts` |

**Core Logic:**

| Purpose | File |
|---------|------|
| Authentication | `apps/api/src/modules/auth/auth.service.ts` |
| Deck management | `apps/api/src/modules/deck/deck.service.ts` |
| Collection | `apps/api/src/modules/collection/collection.service.ts` |
| Match state + scoring | `apps/api/src/modules/match/match.service.ts` |
| Card data | `apps/api/src/modules/card/card.service.ts` |

**Testing:**

| Purpose | File/Dir |
|---------|----------|
| API tests | `apps/api/__tests__/` |
| Seed tests | `tools/seed/__tests__/` |
| Test utilities | See each `__tests__` directory |

**Web Pages:**

| Route | File |
|-------|------|
| `/` | `apps/web/src/app/page.tsx` |
| `/login` | `apps/web/src/app/(auth)/login/page.tsx` |
| `/register` | `apps/web/src/app/(auth)/register/page.tsx` |
| `/cards` | `apps/web/src/app/cards/page.tsx` |
| `/cards/[id]` | `apps/web/src/app/cards/[id]/page.tsx` |
| `/collection` | `apps/web/src/app/(dashboard)/collection/page.tsx` |
| `/decks` | `apps/web/src/app/(dashboard)/decks/page.tsx` |
| `/match/new` | `apps/web/src/app/(dashboard)/match/new/page.tsx` |
| `/match/[code]` | `apps/web/src/app/match/[code]/page.tsx` |

## Naming Conventions

**Files:**

| Type | Pattern | Example |
|------|---------|---------|
| Service | `{domain}.service.ts` | `auth.service.ts`, `deck.service.ts` |
| Router | `{domain}.router.ts` | `auth.router.ts`, `deck.router.ts` |
| Module | `{domain}.module.ts` | `auth.module.ts`, `deck.module.ts` |
| Gateway | `{domain}.gateway.ts` | `match.gateway.ts` |
| Schema | `{domain}.schema.ts` | `auth.schema.ts`, `deck.schema.ts` |
| Config | `{domain}.config.ts` | `auth.config.ts`, `database.config.ts` |
| Hook | `use-{purpose}.ts` | `use-match-socket.ts`, `use-local-game-state.ts` |
| Component | `{PascalCase}.tsx` | `SmartNav.tsx`, `LoginForm.tsx` |
| Page | `page.tsx` | Routable page in App Router |
| Layout | `layout.tsx` | Wrapper for child routes |

**Directories:**

| Type | Pattern | Example |
|------|---------|---------|
| Module | `{domain}` | `auth`, `deck`, `collection` |
| Shared | lowercase | `components`, `hooks`, `lib`, `types` |
| Config | lowercase | `config`, `core`, `common` |
| Public routes | `(groupname)` | `(auth)`, `(dashboard)` |

**Functions:**

| Type | Pattern | Example |
|------|---------|---------|
| NestJS service method | camelCase | `register()`, `createDeck()`, `addToCollection()` |
| tRPC router builder | `buildRouter()` | All routers use this pattern |
| React component | PascalCase | `LoginForm`, `DeckBuilder`, `CollectionGrid` |
| React hook | `use*` + camelCase | `useAuth()`, `useMatchSocket()` |
| Utility function | camelCase | `validateDeckFormat()`, `parseDeckText()` |

**Database & Types:**

| Type | Pattern | Example |
|------|---------|---------|
| Table name | snake_case | `users`, `collection_entries`, `deck_share_codes` |
| Column name | snake_case | `user_id`, `card_id`, `created_at` |
| Type (Zod schema export) | PascalCase + "Type" or infer | `DeckCreateInput`, `CollectionAddInput` |
| Constant | UPPER_SNAKE_CASE | `MAX_DECK_SIZE`, `REFRESH_TOKEN_TTL_SECONDS` |

## Where to Add New Code

**New Feature (e.g., Wishlist Management):**
1. **API Domain Logic:**
   - Create `apps/api/src/modules/wishlist/` directory with:
     - `wishlist.service.ts` - business logic (add, remove, list)
     - `wishlist.router.ts` - tRPC procedures
     - `wishlist.module.ts` - NestJS DI setup
   - Export router in module, register in `apps/api/src/trpc/trpc.module.ts`

2. **Shared Validation:**
   - Add `packages/shared/src/schemas/wishlist.schema.ts` with Zod schemas
   - Export in `packages/shared/src/index.ts`

3. **Database:**
   - Add table in `packages/db/src/schema/wishlists.ts`
   - Add relations in `packages/db/src/relations.ts` if needed

4. **Web UI:**
   - Create component `apps/web/src/app/(dashboard)/wishlist/page.tsx`
   - Use tRPC hook: `const { data } = trpc.wishlist.list.useQuery()`
   - Call mutations: `trpc.wishlist.add.useMutation()`

**New Component/Module (e.g., Card Detail View):**
- **Location:** `apps/web/src/components/card-detail.tsx`
- **Pattern:**
  - Accept props (card ID, optional controls)
  - Use `trpc.card.getById.useQuery(cardId)` to fetch
  - Render card image, text, cost, domain
  - Use design system classes (`lg-card`, `lg-text-secondary`)

**Shared Utilities (e.g., Rarity Color Helper):**
- **Location:** `packages/shared/src/utils/rarity-color.ts`
- **Pattern:** Export named function, import in both API (display) and web (UI)
- **Example:** `export function getRarityColor(rarity: Rarity): string { ... }`

**API Endpoint (e.g., New Deck Feature):**
1. Add method to `DeckService`: `async suggestCards(deckId, userId) { ... }`
2. Add procedure to `DeckRouter.buildRouter()`:
   ```typescript
   suggest: proc
     .input(deckSuggestSchema)
     .query(({ ctx, input }) => this.deckService.suggest(ctx.userId, input))
   ```
3. Call from web: `const suggestions = trpc.deck.suggest.useQuery({ deckId })`

**Database Migration:**
1. Add new table in `packages/db/src/schema/{entity}.ts` using Drizzle syntax
2. Run Drizzle migration generation: `pnpm run db:generate` (from db package)
3. Review generated migration in `packages/db/drizzle/`
4. Run migration: `pnpm run db:migrate` (from db package)
5. Commit schema file + generated migration

**Error Handling Pattern:**
```typescript
// In service:
if (!deck) {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' });
}
if (deck.userId !== userId) {
  throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your deck' });
}

// Client receives error, shows toast:
const result = trpc.deck.update.useMutation({
  onError: (err) => toast.error(err.message),
});
```

**Rate Limiting New Endpoint:**
- Use `this.trpc.rateLimitedProtectedProcedure` for authenticated endpoints (1000/min per user)
- Use `this.trpc.rateLimitedPublicProcedure` for public endpoints (100/min per IP)
- Use `this.trpc.authProcedure` for auth endpoints like login (10/min per IP)

## Special Directories

**`node_modules/`:**
- Purpose: Third-party dependencies
- Generated: Yes (pnpm install)
- Committed: No (in .gitignore)

**`.next/`:**
- Purpose: Next.js build cache and output
- Generated: Yes (next build)
- Committed: No (in .gitignore)

**`dist/`:**
- Purpose: Compiled TypeScript → JavaScript (API)
- Generated: Yes (tsc or build script)
- Committed: No (in .gitignore)

**`drizzle/`:**
- Purpose: Drizzle ORM migration files
- Generated: Yes (drizzle-kit generate)
- Committed: Yes (critical for schema history)

**`.planning/`:**
- Purpose: GSD phase documents and analysis
- Generated: Yes (by GSD agents)
- Committed: Yes (tracks planning history)
- Subdirs:
  - `codebase/`: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md
  - `phases/`: Phase execution plans and logs
  - `debug/`: Debug logs from executions

**`riftbound-tcg-data/`:**
- Purpose: External card data (cloned git repo)
- Generated: No (manually cloned from GitHub)
- Committed: No (git submodule or ignored)
- Note: Do not edit; pull updates from upstream

---

*Structure analysis: 2026-03-15*
