# La Grieta v2 -- Phase Plan

This document defines the ordered build phases for La Grieta v2. Each phase is self-contained and delivers a working increment. Phases must be completed in order -- later phases depend on earlier ones.

---

## Phase 0: Foundation (Week 1)

**Goal**: Monorepo scaffold, database schema, card data seeded. No features yet, just infrastructure.

### Deliverables
1. **Monorepo Setup**
   - Initialize pnpm workspace + Turborepo
   - Create all app and package directories with `package.json`
   - Shared TypeScript configs (`@la-grieta/tsconfig`)
   - `docker-compose.yml` for local PostgreSQL + Redis
   - `.env.example` with all required variables
   - ESLint + Prettier config (shared)

2. **Database Package (`@la-grieta/db`)**
   - All Drizzle schema files (users, cards, sets, collections, decks, deck_cards, listings, orders, sessions)
   - All relations defined
   - Database client factory
   - `drizzle.config.ts` pointing to `DATABASE_URL`
   - Generate initial migration via Drizzle Kit
   - Verify migration runs clean against a fresh database

3. **Shared Package (`@la-grieta/shared`)**
   - Zod schemas for all input types (auth, card filters, collection mutations, etc.)
   - Type exports inferred from Zod schemas
   - Constants: rarities, card types, domains, conditions, statuses
   - Pagination utility (cursor-based)

4. **Card Data Seed Script**
   - `tools/seed/seed-cards.ts`
   - Reads `riftbound-tcg-data/sets/en.json` and `cards/en/*.json`
   - Filters products vs cards (rarity === null means product)
   - Parses string numbers to integers
   - Upserts into database (idempotent)
   - Logs summary: X sets, Y cards, Z products

5. **NestJS API Scaffold**
   - Bare `apps/api` with NestJS, configured with:
     - `@nestjs/config` with Zod-validated env
     - Database connection via `@la-grieta/db`
     - Redis connection via `ioredis`
     - Health check endpoint (`GET /health`)
     - Global exception filter
     - CORS configuration
   - tRPC module scaffold (empty router, context with DB + Redis)
   - Dockerfile for Railway deployment

### Exit Criteria
- `pnpm install` works from root
- `pnpm db:generate` creates migrations
- `pnpm db:migrate` applies migrations to a fresh DB
- `pnpm seed` populates ~550 cards across 3 sets
- `pnpm --filter api dev` starts API server
- `GET /health` returns 200

---

## Phase 1: Auth + Card API (Week 2-3)

**Goal**: Users can register, log in, and browse cards. The core read path works end-to-end.

### Deliverables
1. **Auth Module**
   - `auth.register` -- create user, hash password (bcryptjs, 12 rounds), issue tokens
   - `auth.login` -- verify credentials, issue tokens
   - `auth.refresh` -- rotate refresh token with 30s grace period
   - `auth.logout` -- revoke session, blacklist access token in Redis
   - `auth.logoutAll` -- revoke all user sessions
   - `auth.me` -- return current user profile
   - Password validation: min 8 chars, max 128
   - Username validation: 3-50 chars, alphanumeric + underscore/hyphen
   - Duplicate email/username returns CONFLICT error

2. **Card Module**
   - `card.list` -- paginated card browsing with filters (set, rarity, cardType, domain, search)
   - `card.getById` -- single card with set info
   - `card.getByExternalId` -- lookup by source data ID
   - `card.sets` -- list all sets
   - `card.sync` -- full card DB dump with hash for mobile offline sync
   - All card endpoints are public (no auth required)

3. **User Module**
   - `user.getProfile` -- public user profile
   - `user.updateProfile` -- update display name, bio, city, avatar
   - Protected: users can only update their own profile

4. **tRPC Middleware**
   - `publicProcedure` -- no auth required
   - `protectedProcedure` -- validates JWT, checks Redis blacklist
   - Request logging (method, duration, status)

5. **Rate Limiting**
   - `@nestjs/throttler` with Redis store
   - 100/min public, 1000/min authenticated, 10/min auth endpoints

6. **Tests**
   - Unit tests for auth service (register, login, token rotation)
   - Unit tests for card service (list, filters, sync hash)
   - Integration tests for auth flow (register -> login -> me -> refresh -> logout)
   - Integration tests for card browsing

### Exit Criteria
- Can register, log in, refresh token, and log out via tRPC
- Can browse cards with all filters working
- Card sync endpoint returns full DB + hash
- Rate limiting enforced
- 80% service test coverage, 60% controller coverage

---

## Phase 2: Collections + Decks (Week 4-5)

**Goal**: Users can manage their card collection and build decks. Core feature for engagement.

### Deliverables
1. **Collection Module**
   - `collection.add` -- add card to collection (upsert by user+card+condition)
   - `collection.addBulk` -- batch add up to 50 entries
   - `collection.update` -- change quantity (0 = delete)
   - `collection.remove` -- remove entry
   - `collection.list` -- paginated with card details, filterable by set/rarity
   - `collection.stats` -- total cards, unique cards, completion % per set
   - All mutations require auth, scoped to current user

2. **Deck Module**
   - `deck.create` -- create deck with optional initial cards
   - `deck.update` -- update metadata (name, description, public flag)
   - `deck.delete` -- remove deck and all its cards
   - `deck.setCards` -- full replace of deck card list (simpler than add/remove)
   - `deck.list` -- user's decks (protected)
   - `deck.getById` -- single deck with cards (public if `isPublic`, otherwise owner-only)
   - `deck.browse` -- browse public decks with domain filter and search
   - Validation: max 60 cards per deck, max 4 copies of any single card

3. **Tests**
   - Collection CRUD with edge cases (duplicate handling, quantity 0)
   - Deck CRUD with card validation
   - Authorization tests (can't modify another user's collection/deck)

### Exit Criteria
- Can add/remove cards from collection with condition tracking
- Can build decks with card quantity limits enforced
- Collection stats show completion percentage
- Public deck browsing works
- All protected endpoints reject unauthenticated requests

---

## Phase 3: Next.js Web App (Week 6-8)

**Goal**: Web dashboard with card browser, collection manager, and deck builder. This is the browsing layer.

### Deliverables
1. **Next.js Setup**
   - App Router with route groups: `(auth)`, `(dashboard)`, `cards`, `marketplace`
   - tRPC client setup with React Query
   - Tailwind CSS + mobile-first responsive design (375px base)
   - Auth state management (access token in memory, refresh token in httpOnly cookie or localStorage)

2. **Pages**
   - **Login / Register** -- forms with client-side Zod validation
   - **Card Browser** (`/cards`) -- grid/list view, filters (set, rarity, type, domain), search, infinite scroll
   - **Card Detail** (`/cards/[id]`) -- full card info, image, stats, "add to collection" button
   - **My Collection** (`/dashboard/collection`) -- filterable list, quantity editor, stats panel
   - **Deck Builder** (`/dashboard/decks`) -- list of decks, create/edit
   - **Deck Editor** (`/dashboard/decks/[id]`) -- card search + add to deck, visual card list, quantity controls
   - **Public Deck View** (`/decks/[id]`) -- shareable deck page
   - **Profile** (`/dashboard/profile`) -- edit display name, bio, city, avatar

3. **Components**
   - `CardGrid` -- responsive grid of card thumbnails
   - `CardImage` -- optimized image with lazy loading (TCGPlayer CDN URLs)
   - `FilterBar` -- set/rarity/type/domain filters
   - `SearchInput` -- debounced search
   - `Pagination` -- cursor-based "Load More" button
   - `DeckList` -- deck card list with quantities
   - `CollectionEntry` -- card + quantity + condition editor

### Exit Criteria
- Full card browser with all filters working
- User can register, log in, manage collection, build decks via web UI
- Mobile-responsive design verified at 375px
- Pages load in under 2 seconds on 3G
- No TypeScript errors in strict mode

---

## Phase 4: Marketplace Listings (Week 9-11)

**Goal**: Users can list cards for sale and browse listings. No payments yet -- this is the catalog.

### Deliverables
1. **Listing Module (API)**
   - `listing.create` -- create listing with card, price, condition, images
   - `listing.update` -- edit or cancel listing
   - `listing.list` -- browse active listings with filters (card, set, rarity, condition, city, price range, sort)
   - `listing.getById` -- full listing detail
   - `listing.myListings` -- seller's own listings by status

2. **Upload Module (API)**
   - `upload.getPresignedUrl` -- generate R2 presigned URL for listing images or avatar
   - R2 bucket configuration
   - Image key structure: `{purpose}/{userId}/{uuid}.{ext}`
   - Allowed types: JPEG, PNG, WebP
   - Max file size enforced via presigned URL conditions

3. **Web Pages**
   - **Marketplace** (`/marketplace`) -- listing browser with filters, search, sort
   - **Listing Detail** (`/marketplace/[id]`) -- full listing info, seller info, card details
   - **Create Listing** (`/dashboard/listings/new`) -- form with card selector, price, condition, image upload
   - **My Listings** (`/dashboard/listings`) -- manage active/sold/cancelled listings

4. **Image Upload Flow**
   - Client requests presigned URL from API
   - Client uploads directly to R2
   - Client submits listing with R2 public URLs
   - Display uploaded images with `next/image` optimization

### Exit Criteria
- Can create, edit, browse, and cancel listings
- Image upload to R2 works end-to-end
- Marketplace browsing is fast with proper indexes
- Listing filters and sort work correctly
- No payments yet -- listings are view-only for buyers

---

## Phase 5: Stripe Connect + Orders (Week 12-14)

**Goal**: Full escrow payment flow. Buyers can purchase listings, funds held in escrow, released to sellers on delivery.

### Deliverables
1. **Stripe Connect Integration**
   - Seller onboarding flow (Stripe Connect Standard or Express)
   - `user.setupStripe` -- initiate Connect onboarding, return URL
   - `user.stripeStatus` -- check onboarding status
   - Webhook handler for `account.updated` events

2. **Order Module (API)**
   - `order.create` -- create order + Stripe PaymentIntent with `transfer_data` to seller's Connect account
   - `order.getById` -- order details (buyer or seller only)
   - `order.myOrders` -- user's orders as buyer or seller
   - `order.updateStatus` -- state machine transitions:
     - Seller: `paid -> shipped` (with tracking number)
     - Buyer: `shipped -> delivered`
     - System: `delivered -> completed` (auto after 3 days, releases funds)
     - Buyer: `shipped -> disputed`
     - Admin: `disputed -> resolved`
     - Buyer/Seller: `pending -> cancelled`
   - Platform fee: configurable percentage (default 10%)

3. **Stripe Webhooks**
   - `POST /api/webhooks/stripe` (standard NestJS controller, NOT tRPC)
   - Handle: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Signature verification with `stripe.webhooks.constructEvent`
   - Idempotent processing (check if already handled)

4. **Web Pages**
   - **Checkout** -- Stripe Elements payment form
   - **Order Detail** -- status timeline, tracking info
   - **My Orders** -- tabs for buying/selling
   - **Seller Dashboard** -- earnings summary, payout status

5. **Escrow Flow**
   ```
   Buyer pays -> Stripe holds funds
   Seller ships -> Buyer confirms delivery
   3-day hold -> Funds transferred to seller (minus platform fee)
   ```

### Exit Criteria
- Seller can onboard to Stripe Connect
- Buyer can purchase a listing with card payment
- Order status transitions work with proper authorization
- Stripe webhooks process payments correctly
- Escrow hold period enforced before payout
- Platform fee calculated correctly
- All Stripe interactions tested with test mode keys

---

## Phase 6: WhatsApp Bot (Week 15-17)

**Goal**: WhatsApp-first marketplace interface. Users can browse, buy, and sell via WhatsApp messages.

### Deliverables
1. **WhatsApp App Setup**
   - WhatsApp Cloud API integration (Meta Business API)
   - Webhook receiver for incoming messages
   - Message queue for outbound rate limiting
   - Service account JWT for API authentication

2. **Conversation State Machine**
   - Redis-backed state per phone number (30min TTL)
   - States: idle, browsing, viewing_card, creating_listing, checkout, ...
   - State transitions triggered by message patterns

3. **Core Flows**
   - **Search**: "buscar [query]" -> card results with images + buttons
   - **Browse Listings**: "mercado [card name]" -> active listings for card
   - **View Listing**: Tap listing -> full details + "Comprar" button
   - **Buy**: "comprar" -> Stripe payment link -> order created
   - **Sell**: "vender" -> guided flow: select card -> set price -> add photo -> publish
   - **My Collection**: "coleccion" -> stats + browse
   - **Help**: "ayuda" -> command list

4. **Message Templates**
   - Card info card (image + stats)
   - Listing card (image + price + seller)
   - Order status update
   - Welcome message for new users
   - All templates in Spanish (primary market: Honduras)

5. **Phone Number Linking**
   - First message from unknown number -> prompt to register or link account
   - Link via verification code sent to email
   - Linked phone stored in `users.whatsappPhone`

### Exit Criteria
- Can search cards, browse listings, and purchase via WhatsApp
- Can create listings via guided conversational flow
- Conversation state persists across messages (Redis)
- Bot handles errors gracefully with user-friendly messages
- Rate limiting prevents abuse
- Spanish language support

---

## Phase 7: Mobile App (Week 18-22)

**Goal**: React Native app with offline card database, collection management, and future card scanning.

### Deliverables
1. **Expo Setup**
   - Expo managed workflow
   - tRPC client with React Query
   - Local SQLite database for card data (via `drizzle-orm/expo-sqlite`)
   - Offline-first architecture

2. **Screens**
   - **Login / Register**
   - **Card Browser** -- search/filter against local SQLite (instant, no network)
   - **Card Detail** -- full info with cached images
   - **My Collection** -- manage collection, syncs with server when online
   - **Deck Builder** -- build and edit decks
   - **Marketplace** -- browse and view listings (requires network)
   - **Profile**

3. **Offline Sync**
   - Card DB sync on first launch and periodic refresh
   - Mutation queue: collection/deck changes stored locally, pushed when online
   - Conflict resolution: server wins for quantities, last-write-wins
   - Sync indicator in UI (last synced timestamp, pending changes count)

4. **Card Scanning (Stub)**
   - Camera permission and preview screen
   - Stub for future OCR/image recognition
   - Manual card search as fallback

### Exit Criteria
- Card browsing works fully offline
- Collection and deck management work offline with sync
- App loads and is usable within 2 seconds
- Marketplace browsing works online
- Data syncs correctly when connectivity returns

---

## Phase 8: Polish + Production (Week 23-25)

**Goal**: Production readiness. Performance, security, monitoring, and deployment.

### Deliverables
1. **Performance**
   - Database query optimization (EXPLAIN ANALYZE on key queries)
   - API response time < 200ms p95 for card browsing
   - Image lazy loading and CDN caching headers
   - tRPC request batching enabled

2. **Security Hardening**
   - Helmet middleware
   - CORS locked to production domains
   - Input sanitization audit (all Zod schemas reviewed)
   - SQL injection audit (all queries go through Drizzle)
   - Rate limiting tuned for production traffic
   - Secrets audit (no PII in logs)

3. **Monitoring**
   - Structured JSON logging (pino or winston)
   - Health check endpoint with DB + Redis connectivity checks
   - Error tracking (Sentry)
   - Basic metrics (request count, latency, error rate)

4. **Deployment**
   - Railway configuration for API service
   - Railway PostgreSQL + Redis
   - Environment variable management
   - Dockerfile optimized (multi-stage build, Alpine Linux, bcryptjs)
   - CI/CD pipeline (GitHub Actions): lint, test, build, deploy
   - Database migration on deploy

5. **Admin Tools**
   - Admin-only tRPC procedures (user management, listing moderation)
   - Reseed command for card data updates
   - Order dispute resolution workflow

### Exit Criteria
- All tests pass in CI
- API response times within SLA
- Zero critical security findings
- Production deployment automated
- Monitoring alerts configured
- Admin can manage users, listings, and disputes

---

## Dependency Graph

```
Phase 0 (Foundation)
  |
  v
Phase 1 (Auth + Cards)
  |
  v
Phase 2 (Collections + Decks)
  |
  +---> Phase 3 (Web App) ----+
  |                            |
  +---> Phase 4 (Marketplace) -+---> Phase 5 (Payments)
                               |         |
                               |         v
                               +---> Phase 6 (WhatsApp Bot)
                               |
                               +---> Phase 7 (Mobile App)
                               |
                               v
                          Phase 8 (Polish)
```

Phases 3, 4 can run in parallel after Phase 2.
Phases 6, 7 can run in parallel after Phase 5.
Phase 8 runs last when all features are complete.

---

## Estimated Timeline

| Phase | Duration | Team Focus |
|---|---|---|
| Phase 0: Foundation | 1 week | Backend |
| Phase 1: Auth + Cards | 2 weeks | Backend |
| Phase 2: Collections + Decks | 2 weeks | Backend |
| Phase 3: Web App | 3 weeks | Frontend (parallel with Phase 4) |
| Phase 4: Marketplace | 3 weeks | Backend + Frontend |
| Phase 5: Stripe + Orders | 3 weeks | Backend + Frontend |
| Phase 6: WhatsApp Bot | 3 weeks | Backend |
| Phase 7: Mobile App | 5 weeks | Mobile |
| Phase 8: Polish | 3 weeks | Full team |
| **Total** | **~25 weeks** | |

Note: Timeline assumes a small team (1-3 engineers). Phases 3+4 and 6+7 can overlap with parallel tracks.
