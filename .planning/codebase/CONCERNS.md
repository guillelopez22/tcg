# Codebase Concerns

**Analysis Date:** 2026-03-11

## Tech Debt

### Duplicated column selection patterns across services

**Issue:** CardService, CollectionService, and DeckService repeat identical 20+ field select objects with nested set/card/user structures. This creates maintenance burden when schema changes.

**Files:**
- `apps/api/src/modules/card/card.service.ts:68-107` (list method)
- `apps/api/src/modules/card/card.service.ts:126-177` (getById method)
- `apps/api/src/modules/card/card.service.ts:215-268` (getByExternalId method)
- `apps/api/src/modules/collection/collection.service.ts:69-110` (list method)
- `apps/api/src/modules/deck/deck.service.ts:57-109` (list method)

**Impact:** Hard to update; risk of inconsistent field projections between endpoints; ~200+ lines of duplicated column definitions.

**Fix approach:** Extract shared column definition constants (e.g., `cardWithSetColumns`, `userProfileColumns`) into utilities. Define once, import everywhere.

### Card sync always fetches full database on hash mismatch

**Issue:** `CardService.sync()` at `apps/api/src/modules/card/card.service.ts:294-315` loads all ~550 cards whenever the client's hash doesn't match. No delta mechanism — every stale client gets the full dataset.

**Files:** `apps/api/src/modules/card/card.service.ts:294-315`

**Impact:** High bandwidth on mobile clients; network waste for clients with minor version skew.

**Fix approach:** Add delta-sync based on `updatedAt` timestamps. Return only cards modified since client's last sync time. This becomes critical as card count approaches 1000+.

### Marketplace schema defined but no API endpoints implemented

**Issue:** Database schema includes `listings`, `orders`, and payment-related fields (Stripe integration IDs), but zero API endpoints exist to expose marketplace functionality. Tables are essentially dead code.

**Files:**
- `packages/db/src/schema/listings.ts` - 34 lines of unused schema
- `packages/db/src/schema/orders.ts` - 40 lines of unused schema
- Database includes 10+ Stripe-related columns with no handlers

**Impact:** Confuses developers; increases schema complexity; future refactors may accidentally break these tables.

**Fix approach:** Either (a) remove marketplace schema if not launching soon, or (b) implement marketplace routers (`listing.router.ts`, `order.router.ts`) with escrow logic as per CLAUDE.md. Currently blocking decision needed.

### Console logging instead of structured logging

**Issue:** Production logging uses `console.log()` instead of NestJS Logger or structured JSON output.

**Files:**
- `apps/api/src/main.ts:41,45` - bootstrap logs
- `apps/api/src/trpc/trpc.service.ts:26` - request logging

**Impact:** No log level control in production; no JSON structured format for aggregation; no correlation IDs for distributed tracing.

**Fix approach:** Use NestJS `Logger` service. Add correlation ID middleware. Output JSON in production.

---

## Known Bugs

### Register endpoint race condition on uniqueness checks

**Issue:** `AuthService.register()` performs separate email and username uniqueness checks before INSERT. Two concurrent requests with the same email can both pass checks before either INSERT executes.

**Files:** `apps/api/src/modules/auth/auth.service.ts:56-75`

**Symptoms:** User registration succeeds for one request, but the second registration with the same email fails with a raw PostgreSQL unique constraint error (code 23505) instead of a clean CONFLICT TRPCError.

**Workaround:** Catches the unique constraint error and returns a proper error message at line 98-105, but the error handling is after the fact.

**Fix approach:** Wrap registration in a transaction with `ON CONFLICT (email) DO NOTHING` or use a single query to check uniqueness atomically.

### Unsafe null assumption on authorization header in logout endpoints

**Issue:** `AuthRouter.logout()` and `logoutAll()` extract the Bearer token with a conditional but could still fail if header parsing logic is wrong.

**Files:** `apps/api/src/modules/auth/auth.router.ts:44-46, 53-55`

**Symptoms:** Unlikely but if a middleware misconfiguration allows null headers through, token extraction defaults to empty string, causing logout to fail silently.

**Trigger:** Middleware bypass or custom proxy stripping headers.

**Fix approach:** Already mostly fixed in current code (uses typeof check), but could extract to a shared utility to prevent regression.

### Scanner fingerprint loading blocks on missing images

**Issue:** `ScannerService.loadCardFingerprints()` downloads images for all ~550 cards sequentially in batches. A single CDN 403/404 or timeout skips that card. If multiple cards fail, scanner never reaches full capacity.

**Files:** `apps/api/src/modules/scanner/scanner.service.ts:174-237`

**Symptoms:** Scanner reports "loaded 512/550 fingerprints" but silently skips 38 cards due to CDN failures. Users may scan cards that return no match because the fingerprint wasn't loaded.

**Impact:** Degraded user experience; no visibility into why specific cards don't match.

**Fix approach:** Log failed cards with reasons. Implement retry queue for failed images. Report coverage % in status endpoint.

---

## Security Considerations

### No graceful database connection shutdown

**Issue:** PostgreSQL and Redis connections are created at module bootstrap but never closed. On server restart or container stop, connections hang until timeout.

**Files:**
- `apps/api/src/core/core.module.ts:15-27` - DbClient provider
- `apps/api/src/config/redis.config.ts` - Redis provider
- `packages/db/src/migrate.ts:5-6` - Migration utility

**Risk:** Zombie connections accumulate in dev/test environments. Long shutdown times in production.

**Current mitigation:** None.

**Recommendation:** Implement NestJS `OnModuleDestroy` hooks. Call `pool.end()` on DB and Redis. Add `enableShutdownHooks()` in `main.ts`.

### Session revocation via Redis could be bypassed

**Issue:** Token blacklist is stored in Redis. If Redis is down or data is cleared, revoked tokens become valid again.

**Files:**
- `apps/api/src/modules/auth/auth.service.ts:109-124` - logout logic
- `apps/api/src/trpc/trpc.service.ts:58-61` - blacklist check

**Risk:** Logout is not durable. A Redis restart could re-authenticate users who should be logged out.

**Current mitigation:** Refresh tokens are httpOnly cookies with short TTL (30 days), so the impact is bounded.

**Recommendation:** For high-security operations, also track revoked token hashes in a durable store (PostgreSQL). Sync Redis from DB on startup.

### No request correlation IDs for audit trails

**Issue:** All requests are logged independently with no way to trace a user action across multiple endpoints.

**Files:** All modules log independently; no middleware adds correlation IDs.

**Risk:** Debugging production incidents is harder. Security audits cannot follow a user's session.

**Recommendation:** Add `@RequestId()` decorator or correlation ID middleware. Include in all logs and error responses.

---

## Performance Bottlenecks

### N+1 queries in collection stats endpoint

**Issue:** `CollectionService.stats()` fetches all sets, then issues 2 queries per set to get total/owned counts. With 3 sets = 6 extra queries on top of initial set fetch.

**Files:** `apps/api/src/modules/collection/collection.service.ts:252-280` (as of code review, may be partially fixed)

**Problem:** `COUNT(DISTINCT col.card_id)` subquery for each set instead of single GROUP BY.

**Cause:** Drizzle's relational API not easily expressing aggregate queries.

**Improvement path:** Consolidate into a single GROUP BY query with computed columns. Benchmark: should drop from 8 queries to 1.

### Collection addBulk processes entries sequentially

**Issue:** `CollectionService.addBulk()` loops through entries and calls `add()` sequentially in a transaction. Up to 50 entries = 50-100 database round-trips.

**Files:** `apps/api/src/modules/collection/collection.service.ts:229-239`

**Cause:** Sequential for-loop with async/await inside transaction. No batch processing.

**Improvement path:** Pre-check all card IDs in a single `WHERE id IN (...)` query. Build insert array. Single batch insert. Expected: 100-150 queries down to 3-4.

### All cards fetched on every client sync

**Issue:** `CardService.sync()` loads the entire cards table (with ~550 entries) whenever hash doesn't match. Client must process full JSON response.

**Files:** `apps/api/src/modules/card/card.service.ts:298-302`

**Impact:** Every new user downloads 2MB+ of card data. No incremental sync.

**Improvement path:** Add `lastSyncHash` + `updatedAt` fields. Return only changed cards. See "Tech Debt" section above.

---

## Fragile Areas

### Type assertions on Drizzle join results

**Issue:** Drizzle left-join queries return flattened objects with potential null fields. Code uses type assertions (`as CardWithSet`) without proper null normalization first.

**Files:**
- `apps/api/src/modules/card/card.service.ts:117-119` - Normalizes `price` but asserts overall
- `apps/api/src/modules/collection/collection.service.ts:164` - Manual reshaping then assertion
- `apps/api/src/modules/deck/deck.service.ts:97` - Assertion without normalization

**Why fragile:** If join logic changes (e.g., schema rename), TypeScript won't catch the breakage.

**Safe modification:** Use discriminated unions (e.g., `price: P | null` in return type) instead of assertions. Validate at source.

**Test coverage:** Services have 70-80% coverage but edge cases around null joins are tested with mocks, not real DB.

### Scanner service loads fingerprints at module init

**Issue:** `ScannerService.onModuleInit()` fires-and-forgets the fingerprint loading. Until loading completes, `identify()` throws a precondition error.

**Files:** `apps/api/src/modules/scanner/scanner.service.ts:117-120`

**Why fragile:** If fingerprint loading hangs (CDN down, disk full), scanner silently becomes unavailable. No monitoring of load progress except via status endpoint.

**Safe modification:** Add timeout. If loading takes >5 minutes, log error and report degraded status. Implement retry queue for failed images.

**Test coverage:** No tests for fingerprint loading. Scanner tests mock the fingerprints map directly.

---

## Scaling Limits

### Sync endpoint will degrade as card count increases

**Current capacity:** ~550 cards, ~2MB JSON response per full sync.

**Limit:** At 5000 cards, full sync becomes 20MB+. Mobile clients may timeout or OOM.

**Scaling path:**
1. Implement delta sync (see Tech Debt section)
2. Add compression (gzip response)
3. Add pagination to sync endpoint (paginate by set or release date)

### Rate limiting is IP-based for public endpoints

**Current setup:** 100 req/min per IP for public routes (card list, card detail, user profile).

**Problem:** Behind a reverse proxy, all users share the same IP.

**Scaling path:** Switch to user-based rate limiting where authenticated. For unauthenticated, use API keys or header fingerprinting.

### Database indexes assume current query patterns

**Relevant indexes:**
- `idx_collections_user_id` - supports collection.list by user
- `idx_listings_seller_id` - exists but no router uses it
- `idx_orders_status` - exists but no router uses it

**Scaling issue:** Marketplace features are unimplemented but indexed. When implemented, queries may not match index assumptions.

**Fix approach:** Review query patterns once marketplace routers exist. Adjust indexes if needed.

---

## Dependencies at Risk

### No marketplace payment integration chosen

**Issue:** Schema includes Stripe payment intent fields, but no Stripe SDK is imported. No payment processing exists.

**Files:**
- `packages/db/src/schema/orders.ts:17-18` - Stripe fields defined
- `packages/db/src/schema/listings.ts` - No payment-related fields (inconsistent)

**Risk:** Marketplace launch is blocked on choosing Stripe vs. other provider vs. removing marketplace.

**Recommendation:** Update CLAUDE.md to clarify: (a) marketplace MVP timeline, (b) payment processor choice, or (c) decision to defer/remove.

### bcryptjs pinned version (workaround for Alpine Linux)

**Issue:** Uses `bcryptjs` instead of native `bcrypt` to avoid Alpine hanging (documented in CLAUDE.md line 56).

**Files:**
- `apps/api/src/modules/auth/auth.service.ts:3` - imports bcryptjs
- `apps/api/package.json` - bcryptjs dependency

**Risk:** bcryptjs is slower than native bcrypt. Acceptable now, but should revisit when Alpine/Node versions are updated.

**Recommendation:** Monitor upstream. If native bcrypt fixes Alpine support, migrate back.

---

## Missing Critical Features

### No observability/monitoring infrastructure

**What's missing:**
- No request correlation IDs
- No distributed tracing
- No metrics (Prometheus/StatsD)
- No health checks beyond GET /api/health

**Blocks:** Production deployment visibility.

**Recommendation:** Add Pino logger with correlation ID middleware. Optionally add Prometheus metrics. Test with production load simulator.

### Marketplace feature completely absent

**What's missing:**
- No listing router/service
- No order router/service
- No escrow logic (payment in limbo until delivery)
- No dispute resolution

**Blocks:** Peer-to-peer trading feature set.

**Recommendation:** Defer or implement as Phase 2. Update schema/CLAUDE.md if deferring.

### No email notifications

**What's missing:**
- No welcome email on registration
- No password reset flow
- No order status notifications
- No listing alerts

**Blocks:** User engagement.

**Recommendation:** Add after MVP. Use SendGrid or Resend.

---

## Test Coverage Gaps

### Scanner service fingerprint loading untested

**What's not tested:** The actual image download + fingerprint generation pipeline.

**Files:** `apps/api/__tests__/` - No scanner integration tests. Service tests mock the fingerprints map.

**Risk:** Image processing bugs (corrupt PNG, HEIC format, encoding issues) are only discovered in production.

**Priority:** High - scanner is a core user-facing feature.

**Safe test:** Download real card images from riftbound-tcg-data. Mock HTTP, test sharp pipeline, verify fingerprint dimensions.

### No marketplace integration tests

**What's not tested:** Listing creation, order placement, payment flow.

**Files:** No order.*.spec.ts or listing.*.spec.ts tests exist.

**Risk:** When marketplace launches, bugs are discovered post-launch.

**Priority:** Medium - marketplace not yet launched.

### Price sync service untested

**What's not tested:** TCGPlayer API mocking, rate limiting, price update logic.

**Files:** `apps/api/src/modules/price-sync/price-sync.service.ts` - No tests.

**Risk:** Price data corruption or API failures will go undetected.

**Priority:** Medium - used only for data import, not critical path.

### Web app authentication edge cases

**What's not tested:** Token refresh race conditions (concurrent requests), localStorage/cookie sync.

**Files:** `apps/web/src/lib/auth-context.tsx` - No tests.

**Risk:** Users can get stuck in logged-out state during network interruptions.

**Priority:** Medium - auth is critical but context rarely changes.

---

## Known Issues from V1 (Already Fixed)

The following issues from V1 have been addressed in V2:

1. ✅ **bcryptjs instead of bcrypt** - Already using bcryptjs on Alpine Linux (documented)
2. ✅ **Global route prefixes duplication** - API prefix set once in `main.ts`, no duplication in controllers
3. ✅ **SQL injection via ILIKE** - `escapeLike()` utility now used in card.service and deck.service

---

## Recommendations Summary (Prioritized)

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0 | Add graceful shutdown hooks (DB/Redis) | Low | Prevents connection leaks |
| P0 | Marketplace feature decision (implement/defer/remove) | High | Unblocks schema clarity |
| P1 | Extract shared column definitions | Low | Reduces duplication |
| P1 | Implement delta-sync for card data | Medium | Scales mobile bandwidth |
| P1 | Add request correlation IDs | Medium | Enables production debugging |
| P2 | Fix N+1 queries in stats endpoint | Medium | Improves latency |
| P2 | Batch collection.addBulk operations | Medium | Scales bulk imports |
| P2 | Add structured logging (JSON) | Low | Production readiness |
| P2 | Scanner fingerprint loading tests | Medium | Reduces image pipeline bugs |
| P3 | Email notification system | High | User engagement |
| P3 | Redis session durability | Medium | High-security use cases |

---

*Concerns audit: 2026-03-11*
