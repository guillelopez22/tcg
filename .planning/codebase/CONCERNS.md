# Codebase Concerns

**Analysis Date:** 2026-03-15

## Tech Debt

**Monolithic Frontend Components:**
- Issue: `apps/web/src/app/(dashboard)/decks/deck-wizard.tsx` (1793 lines), `apps/web/src/app/(dashboard)/decks/[id]/deck-card-editor.tsx` (1201 lines), `apps/web/src/app/match/[code]/match-board.tsx` (917 lines) combine multiple concerns (state, rendering, validation, async operations)
- Files: `apps/web/src/app/(dashboard)/decks/deck-wizard.tsx`, `apps/web/src/app/(dashboard)/decks/[id]/deck-card-editor.tsx`, `apps/web/src/app/match/[code]/match-board.tsx`
- Impact: Difficult to test, high risk of regression when modifying one feature, unclear responsibility boundaries, makes the component slow to render
- Fix approach: Extract validation logic to custom hooks (`useDeckValidation`), separate state management into `useReducer` patterns, split rendering into smaller sub-components (<300 lines each)

**Large Service Files:**
- Issue: `apps/api/src/modules/deck/deck.service.ts` (1157 lines), `apps/api/src/modules/news/news.service.ts` (852 lines), `apps/api/src/modules/collection/collection.service.ts` (676 lines) combine multiple business domains
- Files: `apps/api/src/modules/deck/deck.service.ts`, `apps/api/src/modules/news/news.service.ts`, `apps/api/src/modules/collection/collection.service.ts`
- Impact: Single responsibility principle violated, difficult to test individual operations, harder to add features without side effects
- Fix approach: Break `deck.service.ts` into `deck-builder.service.ts`, `deck-import.service.ts`, `deck-validation.service.ts`; break `news.service.ts` into `news-scraper.service.ts` and `news-publisher.service.ts`

**Manual Error Typing with `unknown`:**
- Issue: Error handling casts `err as Record<string, unknown>` in multiple places to extract properties (e.g. `apps/api/src/modules/auth/auth.service.ts` lines 31-46, 98-107)
- Files: `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/news/news.service.ts`
- Impact: Not type-safe, prone to runtime errors if error object shape changes, difficult to handle different error types consistently
- Fix approach: Create error helper utilities with proper type guards: `isPostgresError`, `isPgConstraintError`, `getErrorMessage` functions

**Fragile News Scraper with Multiple Fallback Strategies:**
- Issue: `apps/api/src/modules/news/news.service.ts` implements 4 independent scraping strategies (RSS, Sitemap, Next.js JSON chunks, generic HTML selectors) that require constant maintenance as external websites change
- Files: `apps/api/src/modules/news/news.service.ts`
- Impact: Web scraping is inherently brittle; any site layout change breaks one strategy; each site requires custom parsing logic; strategies are difficult to test independently
- Fix approach: Abstract scraping into provider plugins (RssScraper, SitemapScraper, HtmlScraper), add circuit breaker pattern to fail fast on broken scrapers, implement fallback chaining, add monitoring for scraper health

**Loose Validation of External Scraping URLs:**
- Issue: Scraped URLs from external sites are accepted and stored without proper URL validation or allowlist checking; thumbnails and images from third-party sites are embedded directly
- Files: `apps/api/src/modules/news/news.service.ts` lines 442-460, 490-516
- Impact: Potential for XSS via malicious URLs in scraped content; no validation that URLs match expected domains; image URLs from untrusted sources
- Fix approach: Implement strict URL validation (allowlist known news domains), validate image URLs against CDN or proxy through safe image service, sanitize any user-facing URLs

## Known Bugs

**Potential Race Condition in Deck Card Updates:**
- Symptoms: Concurrent deck modifications via multiple browser tabs may result in lost updates or inconsistent card counts
- Files: `apps/api/src/modules/deck/deck.service.ts`, database schema `packages/db/src/schema/decks.ts`
- Trigger: Open same deck in multiple tabs, modify cards simultaneously, observe card counts or zone assignments may be out of sync
- Workaround: Refresh the page to reload deck state from server; avoid editing decks in multiple tabs concurrently

**Missing Cascade Delete on Card Deletion:**
- Symptoms: If a card is deleted from the card database, orphaned collection entries and deck cards remain (foreign key references are not cascaded)
- Files: `packages/db/src/schema/collections.ts` line 9, `packages/db/src/schema/decks.ts` line 28
- Trigger: Delete a card via admin or sync process while users have it in collections/decks
- Workaround: Perform soft deletes (mark as inactive) instead of hard deletes; manually clean up orphaned entries before deletion

**Mulligan Phase State Not Persisted Across WebSocket Reconnection:**
- Symptoms: If a player disconnects during mulligan and reconnects, the mulligan modal doesn't reappear; player sees normal game state
- Files: `apps/web/src/app/match/[code]/match-board.tsx`, `apps/web/src/hooks/use-local-game-state.ts`
- Trigger: Disconnect browser during mulligan phase (first 30 seconds of match), reconnect, mulligan modal is missing
- Workaround: Manually re-draw cards or reload match page

**JSON JSONB State in Match Sessions Not Versioned:**
- Symptoms: If match state schema changes (card property additions, zone reorganization), old persisted states fail to deserialize
- Files: `packages/db/src/schema/match-sessions.ts` line 14, `apps/api/src/modules/match/match.service.ts`
- Trigger: Add new property to MatchState, retrieve old match from database
- Workaround: Manually migrate stored JSONB data in database; version the state schema

## Security Considerations

**Lack of Rate Limiting on Public Endpoints:**
- Risk: Public routes like `/api/trpc/card.list`, `/api/trpc/deck.browse` could be scraped or abused without per-IP rate limiting on authentication failures
- Files: `apps/api/src/modules/throttler/rate-limit.middleware.ts` (rate limiter exists but not applied to all routes)
- Current mitigation: Rate limiting implemented in middleware but may not be applied to all sensitive routes; check route decorators for `@UseGuards`
- Recommendations: Apply strict rate limiting (100 req/min per IP) to public list/search endpoints; implement CAPTCHA on registration/login after N failures; add IP-based blocking for brute force attempts

**Insufficient Input Validation on Deck Import:**
- Risk: Deck import via text/URL accepts arbitrary card counts and zone assignments; no validation that deck string format is correct before processing
- Files: `apps/api/src/modules/deck/deck.service.ts` (deck import parsing), `packages/shared/src/schemas/deck.schema.ts` (validation schemas)
- Current mitigation: Zod schemas validate the resolved deck format but don't validate intermediate parsing; malformed import strings may cause silent failures
- Recommendations: Add strict length limits to import text (max 10KB), reject imports with impossible deck formats early, log/alert on repeated import failures from same IP

**Database Connection Pool Not Explicitly Configured:**
- Risk: Default pg pool settings may be insufficient under load; no connection limit configured in production
- Files: `packages/db/src/client.ts` line 9, `apps/api/src/config/database.config.ts`
- Current mitigation: Uses default Pool from `pg` package (typically 10 connections)
- Recommendations: Set explicit pool size in production based on expected concurrency: `new Pool({ connectionString, max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 })`

**Unencrypted Photo Storage Metadata:**
- Risk: Photo URLs and keys stored in plaintext in collections table; no access control on photo URLs
- Files: `packages/db/src/schema/collections.ts` line 13-14
- Current mitigation: Photos stored via Cloudflare R2 with presigned URLs, but URL itself is sensitive data in database
- Recommendations: Don't store public URLs directly; regenerate presigned URLs on-demand, add database-level encryption for photo metadata, audit access logs to photos

**Weak Tournament/Placement Data Model:**
- Risk: `tier` (2 chars), `tournament` fields in deck schema are free text with no validation; allows arbitrary values and data entry errors
- Files: `packages/db/src/schema/decks.ts` lines 13-16
- Current mitigation: No validation; frontend assumes consistent values but can be bypassed via direct API calls
- Recommendations: Use enums for tournament and tier fields; create separate `tournaments` table with reference; validate tournament is active/approved before assignment

## Performance Bottlenecks

**Full Deck + Cards Query on Every Browse Request:**
- Problem: `deck.service.ts` list method joins deck_cards + cards for every result, even when only metadata is needed
- Files: `apps/api/src/modules/deck/deck.service.ts` lines 126-180
- Cause: SELECT * from joined tables; pagination without filtering to cover cards; no separate queries for metadata-only view
- Improvement path: Add `public:true` flag for browse, return only deck metadata + cover card image in list view, lazy-load full deck cards on detail page

**News Sync Blocks Startup (3 Second Delay):**
- Problem: `onModuleInit` waits 3 seconds then fires news sync; if scraping is slow, API startup is delayed
- Files: `apps/api/src/modules/news/news.service.ts` lines 34-39
- Cause: Fire-and-forget with `void this.syncCron()` but startup still waits 3 seconds for delay
- Improvement path: Remove startup delay, run sync asynchronously without blocking, add startup flag to skip first sync if cache is fresh

**Card List Query Unbounded Without Cursor Validation:**
- Problem: Card list pagination uses cursor but doesn't validate cursor format; invalid cursor might cause full table scan
- Files: `apps/api/src/modules/card/card.service.ts`
- Cause: Cursor accepted without validation; if cursor is malformed, query falls back to start
- Improvement path: Validate cursor format before use, return 400 for invalid cursor, add LIMIT clause on all queries

**Match State Updates Serialized to JSONB on Every Action:**
- Problem: Every battlefield tap, rune channel, or card movement serializes entire match state to JSONB; no incremental updates
- Files: `apps/api/src/modules/match/match.service.ts`, `packages/db/src/schema/match-sessions.ts` line 14
- Cause: JSONB replacement on every write; no event log or delta tracking
- Improvement path: Implement event sourcing for match state, store events instead of full state, reconstruct state on read, cache reconstructed state in Redis

## Fragile Areas

**Deck Validation Logic Scattered Across Multiple Files:**
- Files: `apps/web/src/app/(dashboard)/decks/deck-wizard.tsx` (client-side validation), `apps/api/src/modules/deck/deck.service.ts` (server-side), `packages/shared/src/schemas/deck.schema.ts` (Zod schemas)
- Why fragile: Validation is duplicated in three places; if business rule changes (e.g., max signatures per domain), must update all three locations; client and server can diverge
- Safe modification: Extract all validation logic to `packages/shared/src/utils/deck-validation.ts` with pure functions that both client and server import; maintain single source of truth
- Test coverage: Unit tests for validation functions exist but don't cover all edge cases (signature domain matching, zone interactions)

**WebSocket Match State Synchronization:**
- Files: `apps/api/src/modules/match/match.gateway.ts`, `apps/web/src/hooks/use-match-socket.ts`, `apps/web/src/app/match/[code]/match-board.tsx`
- Why fragile: Full state sent on reconnect, then incremental patches; if patch is lost or applied out-of-order, client state diverges from server; no versioning on patches
- Safe modification: Add sequence numbers to all state patches, validate version before applying, request full state refresh if patches are out-of-order
- Test coverage: WebSocket tests exist but only cover happy path; no tests for reconnection, concurrent updates, or out-of-order patches

**Auto-Build Recommendation Algorithm:**
- Files: `apps/api/src/modules/deck-recommendations/deck-recommendations.service.ts`
- Why fragile: Uses static rarity scoring (`RARITY_PRIORITY` in deck-wizard.tsx) without domain matching; if card meta changes, recommendations become stale; no feedback mechanism to improve quality
- Safe modification: Implement weighted scoring based on actual deck performance data, add preference for cards that synergize with legend, track which suggestions are accepted/rejected
- Test coverage: Auto-build tests exist but only verify structure, not recommendation quality

## Scaling Limits

**Redis Connection Pool Not Explicitly Sized:**
- Current capacity: Single Redis connection per process; no connection pooling configured
- Limit: Under 100 req/sec, single connection is fine; at 1000+ req/sec, single connection becomes bottleneck
- Scaling path: Use `ioredis` cluster mode or Redis Sentinel, configure `maxRetriesPerRequest`, implement Redis connection pool wrapper

**Match Sessions Stored in PostgreSQL JSONB (No Sharding):**
- Current capacity: PostgreSQL can handle ~10K concurrent matches with 4 CPU cores; JSONB queries are slower than relational
- Limit: At 100K concurrent matches, single PostgreSQL instance becomes bottleneck; JSONB state updates serialization overhead is significant
- Scaling path: Move match state to Redis (faster JSONB operations), use PostgreSQL only for history/audit; implement match session sharding by code hash if needed

**News Sync Runs Synchronously on Cron (4 Hour Window):**
- Current capacity: Full sync takes ~30 seconds; if 2+ scrape operations timeout, sync may take >5 minutes
- Limit: At 4 hour intervals, 1 missed sync is tolerable; if timeout increases or sync duration doubles, may skip cron window
- Scaling path: Make scraping async with individual timeouts per source, queue articles for processing instead of blocking, implement per-source sync scheduling

**No Async Job Queue for Heavy Operations:**
- Current capacity: Deck import, auto-build, scanner image processing all run synchronously in request handler
- Limit: Large imports (100+ cards) or 10+ concurrent scanner uploads block API threads
- Scaling path: Implement async job queue (Bull/RabbitMQ), move slow operations off request path, track progress via polling or WebSocket, return job ID immediately

## Dependencies at Risk

**External Web Scraping Dependencies (News Sources):**
- Risk: Riftbound.gg, riftdecks.com, official Riftbound site could change HTML/API structure without notice; scrapers break silently
- Impact: News feed becomes stale; no alerts when scraping fails; users see old data without knowing it's stale
- Migration plan: Implement RSS feed monitoring with alerts, contact news sources to provide API/feed, implement dedicated news provider integrations, add health checks to scraper dashboard

**Drizzle ORM Type Generation:**
- Risk: `.d.ts` files in `packages/db/src/` are auto-generated; committing generated files causes merge conflicts and sync issues
- Impact: Type mismatches between generated types and actual schema if build process breaks; git history polluted with generated diffs
- Migration plan: Add generated files to `.gitignore`, regenerate on `npm install`, document schema changes in migration files, use `drizzle-kit` for versioned schema management

**bcryptjs Dependency on Alpine Linux:**
- Risk: Native `bcrypt` hangs on Alpine Linux without libc; project uses `bcryptjs` fallback but dependency selection is fragile
- Impact: Native builds fail on Alpine; deployment fails if wrong bcrypt version installed
- Migration plan: Pin `bcryptjs` in package.json with clear comment explaining Alpine requirement; add build script to verify bcrypt version at startup; test in CI with Alpine image

## Missing Critical Features

**No Audit Log for Sensitive Operations:**
- Problem: Deck deletions, collection modifications, match concessions are not logged; can't track user actions or detect abuse
- Blocks: Compliance reporting, dispute resolution, fraud detection, user support investigation
- Implementation: Add `audit_logs` table with `userId`, `action`, `resourceType`, `resourceId`, `changes`; log all mutations; query audit logs on support requests

**No Deck Version History:**
- Problem: Deck updates overwrite previous version; can't revert to older deck list or compare changes
- Blocks: Deck iteration feedback, tournament prep (can't see what changed between attempts), deck evolution tracking
- Implementation: Implement soft deletes for deck cards, track deck version number, allow restore from previous versions, show diff view between versions

**No Tournament Verification or Admin Approval:**
- Problem: Any user can set deck `tournament`, `tier`, `region`, `placement` fields; fraudulent tournament claims possible
- Blocks: Accurate tournament meta data, leaderboards, regional rankings, competitive integrity
- Implementation: Add deck approval workflow, require tournament ID from official tournament systems, implement admin panel for deck verification, add moderation tools

## Test Coverage Gaps

**WebSocket/Real-time Match Flow Not Tested:**
- What's not tested: Player disconnection/reconnection, out-of-order message delivery, concurrent updates, state divergence scenarios
- Files: `apps/api/src/modules/match/match.gateway.ts`, `apps/web/src/hooks/use-match-socket.ts`
- Risk: Critical match flow bugs may ship unnoticed; reconnection edge cases cause silent failures
- Priority: High — matches are core gameplay feature; real-time reliability is critical

**News Scraper Resilience Not Tested:**
- What's not tested: Timeout handling, malformed HTML responses, missing required fields, circuit breaker behavior when all scrapers fail
- Files: `apps/api/src/modules/news/news.service.ts`
- Risk: Scraper may crash or silently drop articles; no visibility into scraper health
- Priority: High — news feed is public-facing; stale/missing news affects user trust

**Deck Import Parser Edge Cases Not Fully Covered:**
- What's not tested: Unicode characters, unusual whitespace/newlines, mixed card name/number formats, imports with special characters in card names
- Files: `apps/api/src/modules/deck/deck.service.ts`, test file `apps/api/__tests__/deck-import-parser.spec.ts`
- Risk: Users can't import valid deck strings in some formats; import failures are silent with generic error messages
- Priority: Medium — import is convenience feature but affects new user onboarding

**Client-Side State Management (useLocalGameState) Not Fully Tested:**
- What's not tested: Mulligan phase edge cases (all discards, no discards), rune exhaustion/recycling order, concurrent drag operations, hand size limits
- Files: `apps/web/src/hooks/use-local-game-state.ts`
- Risk: Game logic errors can occur without server validation (though server corrects on action submission)
- Priority: Medium — local state is not persistent; server is source of truth but UX is degraded if local state is wrong

---

*Concerns audit: 2026-03-15*
