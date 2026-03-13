# La Grieta v2 -- Code Quality Review

**Date**: 2026-03-10
**Reviewer**: Software Architect Agent
**Scope**: Full monorepo -- architecture, database, shared package, code patterns, TypeScript, build pipeline
**Overall Rating**: **B+** (Good foundation with targeted improvements needed)

---

## Executive Summary

The codebase demonstrates solid architectural decisions: clean NestJS + tRPC integration, well-organized monorepo structure, proper use of Zod as single source of truth, and a thoughtful auth system with refresh token rotation. The main areas for improvement are: eliminating `@ts-ignore` and unsafe type assertions, fixing a potential SQL injection vector in ILIKE queries, addressing N+1 query patterns, and tightening the type safety gap between the tRPC context and protected procedures.

---

## Critical Issues (P0)

### 1. SQL Injection via ILIKE wildcard characters

**Severity**: Critical
**Files**:
- `apps/api/src/modules/card/card.service.ts:51`
- `apps/api/src/modules/card/card.service.ts:55`
- `apps/api/src/modules/deck/deck.service.ts:225`
- `apps/api/src/modules/deck/deck.service.ts:229`

User input is interpolated directly into ILIKE patterns without escaping `%` and `_` wildcard characters:

```ts
conditions.push(ilike(cards.domain, `%${input.domain}%`));
conditions.push(ilike(cards.cleanName, `%${input.search}%`));
```

While Drizzle parameterizes the value (preventing classic SQL injection), an attacker can craft search strings containing `%` or `_` to manipulate the LIKE pattern matching behavior, causing unexpected result sets or performance degradation via full-table scans.

**Recommendation**: Escape LIKE special characters before interpolation:
```ts
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}
conditions.push(ilike(cards.cleanName, `%${escapeLike(input.search)}%`));
```

### 2. `@ts-ignore` suppression hiding potential type error

**Severity**: Critical
**File**: `apps/api/src/modules/collection/collection.service.ts:100`

```ts
// @ts-ignore Drizzle nested select
name: sets.name,
```

This `@ts-ignore` hides a Drizzle type conflict in the nested select. The issue is that `sets.name` collides with `cards.name` in the same select statement, causing ambiguity. Rather than suppressing the error, use a column alias or restructure the query.

**Recommendation**: Use Drizzle's `.as()` or restructure to fetch card and set data separately, or use the relational query API.

---

## High Issues (P1)

### 3. Non-null assertions (`!`) on `ctx.userId` throughout all routers

**Severity**: High
**Files**:
- `apps/api/src/modules/auth/auth.router.ts:38,44,48`
- `apps/api/src/modules/collection/collection.router.ts:25,29,33,37,41,44`
- `apps/api/src/modules/deck/deck.router.ts:28,32,36,40,44`
- `apps/api/src/modules/user/user.router.ts:22`

**Count**: 15 occurrences of `ctx.userId!`

The `TrpcContext` interface defines `userId?: string` (optional), so every router using `protectedProcedure` has to use `!` to assert it exists. This is fragile -- if someone accidentally uses `publicProcedure` instead of `protectedProcedure`, the `!` would hide a runtime bug.

**Recommendation**: Define a `ProtectedContext` type where `userId` is required, and have `protectedProcedure` return it:
```ts
interface ProtectedContext extends TrpcContext {
  userId: string;
  userRole: string;
}
```
This way the middleware type-narrows the context, and no `!` assertions are needed.

### 4. N+1 query in `CollectionService.stats()`

**Severity**: High
**File**: `apps/api/src/modules/collection/collection.service.ts:252-280`

The `stats()` method fetches all sets, then issues 2 queries per set inside `Promise.all()`. With 3 sets this is 6 extra queries (acceptable for now), but it will degrade as sets are added.

**Recommendation**: Consolidate into a single query with `GROUP BY`:
```sql
SELECT s.id, s.name, s.slug,
  COUNT(DISTINCT c.id) FILTER (WHERE c.is_product = false) as total_cards,
  COUNT(DISTINCT col.card_id) as owned_cards
FROM sets s
LEFT JOIN cards c ON c.set_id = s.id
LEFT JOIN collections col ON col.card_id = c.id AND col.user_id = $1
GROUP BY s.id
ORDER BY s.release_date;
```

### 5. `addBulk` processes entries sequentially with individual DB round-trips

**Severity**: High
**File**: `apps/api/src/modules/collection/collection.service.ts:181-189`

```ts
for (const entry of input.entries) {
  const result = await this.add(userId, entry);
  results.push(result);
}
```

Up to 50 entries (per schema validation), each issuing 2-3 queries = 100-150 queries per call. This should use a transaction with batch operations.

**Recommendation**: Wrap in a Drizzle transaction and batch the card-existence checks into a single `WHERE id IN (...)` query.

### 6. Unsafe type assertion on authorization header in auth router

**Severity**: High
**File**: `apps/api/src/modules/auth/auth.router.ts:37,43`

```ts
const token = (ctx.req.headers['authorization'] as string).replace(/^Bearer\s+/, '');
```

This casts `headers['authorization']` to `string` without checking. While the auth middleware should have already validated the header, this is a direct assertion that could crash if the header is `undefined` for any reason (e.g., middleware misconfiguration).

**Recommendation**: Add a null check or extract the token parsing into a shared utility:
```ts
const authHeader = ctx.req.headers['authorization'];
const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/, '') : '';
```

---

## Medium Issues (P2)

### 7. Duplicated card select columns across CardService methods

**Severity**: Medium
**Files**:
- `apps/api/src/modules/card/card.service.ts:74-107` (getById)
- `apps/api/src/modules/card/card.service.ts:122-156` (getByExternalId)

Both methods have identical 20-field select objects with embedded set fields. This is ~80 lines of duplicated column definitions.

**Recommendation**: Extract a `cardWithSetColumns` constant:
```ts
const cardWithSetColumns = {
  id: cards.id,
  // ... all card fields
  set: {
    id: sets.id,
    // ... all set fields
  },
};
```

### 8. Duplicated user profile select columns

**Severity**: Medium
**Files**:
- `apps/api/src/modules/user/user.service.ts:14-28` (getProfile)
- `apps/api/src/modules/user/user.service.ts:57-71` (updateProfile returning)
- `apps/api/src/modules/user/user.service.ts:82-96` (getProfileById)
- `apps/api/src/modules/auth/auth.service.ts:215-230` (me)

The same ~14 user profile columns are repeated in 4 places.

**Recommendation**: Extract a `userProfileColumns` constant in the user module.

### 9. `UserRouter.getProfile` is not rate-limited

**Severity**: Medium
**File**: `apps/api/src/modules/user/user.router.ts:16-18`

```ts
getProfile: this.trpc.publicProcedure
  .input(z.object({ username: z.string() }))
  .query(...)
```

Uses `publicProcedure` (no rate limit) instead of `rateLimitedPublicProcedure`. This is the only public data-fetching endpoint without rate limiting. Could be used for user enumeration.

**Recommendation**: Change to `this.trpc.rateLimitedPublicProcedure`.

### 10. `UserRouter.updateProfile` is not rate-limited

**Severity**: Medium
**File**: `apps/api/src/modules/user/user.router.ts:20-22`

Uses `this.trpc.protectedProcedure` instead of `this.trpc.rateLimitedProtectedProcedure`. All other protected endpoints use the rate-limited variant.

**Recommendation**: Change to `this.trpc.rateLimitedProtectedProcedure`.

### 11. Auth module: `register` race condition on uniqueness checks

**Severity**: Medium
**File**: `apps/api/src/modules/auth/auth.service.ts:42-60`

The email and username uniqueness checks are separate queries before the INSERT. Two concurrent registrations with the same email/username could both pass the checks before either INSERT executes. The DB unique constraint will catch this, but the error bubbles up as an unhandled Postgres error, not a clean TRPCError.

**Recommendation**: Wrap in a transaction with `ON CONFLICT` handling, or catch the unique constraint violation and return a proper CONFLICT error.

### 12. `DeckService.setCards` is not transactional

**Severity**: Medium
**File**: `apps/api/src/modules/deck/deck.service.ts:206-216`

The delete + insert in `setCards()` are separate operations. If the insert fails, the old cards are already deleted, leaving the deck empty.

**Recommendation**: Wrap in `db.transaction()`.

### 13. `card.sync` fetches all cards every time hash doesn't match

**Severity**: Medium
**File**: `apps/api/src/modules/card/card.service.ts:174-192`

The sync endpoint computes a hash from all cards, then returns the full card list if hashes don't match. For ~550 cards this is currently fine, but this doesn't scale. There's no delta-sync mechanism.

**Recommendation**: Acceptable for now with the current card count. Add a TODO for future delta-sync based on `updatedAt` timestamps.

---

## Low Issues (P3)

### 14. Redis and DB connections not gracefully shut down

**Severity**: Low
**File**: `apps/api/src/core/core.module.ts:15-27`

The `CoreModule` creates Redis and Postgres pool connections but never closes them on shutdown. NestJS `OnModuleDestroy` or `enableShutdownHooks()` should be used.

**Recommendation**: Implement `onModuleDestroy` on the providers or use NestJS lifecycle hooks.

### 15. `migrate.ts` creates a new DB client that is never closed

**Severity**: Low
**File**: `packages/db/src/migrate.ts:5-6`

```ts
const db = createDbClient(connectionString);
await migrate(db, { migrationsFolder: './drizzle' });
```

The pool created by `createDbClient` is never closed after migration completes.

### 16. Logging middleware uses `console.log` instead of NestJS Logger

**Severity**: Low
**File**: `apps/api/src/trpc/trpc.service.ts:26`

```ts
console.log(`[tRPC] ${type} ${path} -- ${result.ok ? 'ok' : 'error'} (${durationMs}ms)`);
```

Should use NestJS `Logger` for consistent log formatting and level control.

### 17. `TrpcService` exposes raw tRPC internals as getters

**Severity**: Low
**File**: `apps/api/src/trpc/trpc.service.ts:112-143`

The `TrpcService` class uses `@Injectable()` but its getters (`router`, `publicProcedure`, etc.) simply proxy module-level constants. This is a thin wrapper that mixes NestJS DI with tRPC's module-level initialization. While functional, it creates a coupling where the tRPC initialization (`initTRPC`) happens at module evaluation time, outside of NestJS's DI lifecycle.

This is an acceptable tradeoff for now given tRPC's design constraints.

### 18. `HealthModule` exports `HealthService` unnecessarily

**Severity**: Low
**File**: `apps/api/src/modules/health/health.module.ts:18`

`HealthService` is exported but no other module imports it. Remove the export to keep the module boundary clean.

---

## Type Safety Audit

### `@ts-ignore` Locations
| File | Line | Comment |
|------|------|---------|
| `apps/api/src/modules/collection/collection.service.ts` | 100 | `// @ts-ignore Drizzle nested select` |

### Type Assertions (`as`) in Application Code
| File | Line | Expression | Risk |
|------|------|-----------|------|
| `apps/api/src/trpc/trpc.service.ts` | 93, 99 | `ctx.req as Parameters<typeof getClientIp>[0]` | Low -- type widening for utility function |
| `apps/api/src/trpc/trpc.service.ts` | 105 | `ctx as TrpcContext & { userId: string }` | Medium -- should use typed context |
| `apps/api/src/trpc/trpc.controller.ts` | 45 | `fetchReq as unknown as globalThis.Request` | Low -- necessary for fetch adapter bridge |
| `apps/api/src/modules/auth/auth.router.ts` | 37, 43 | `ctx.req.headers['authorization'] as string` | High -- unsafe null assumption |
| `apps/api/src/modules/card/card.service.ts` | 118, 167 | `row as CardWithSet` | Medium -- Drizzle join result typing gap |
| `apps/api/src/modules/collection/collection.service.ts` | 118 | `rows as CollectionEntryWithCard[]` | Medium -- same Drizzle join gap |
| `apps/api/src/modules/deck/deck.service.ts` | 97 | `{ ...deck, cards: cardRows } as DeckWithCards` | Medium -- same pattern |
| `apps/api/src/modules/throttler/rate-limit.middleware.ts` | 32 | `results?.[2]?.[1] as number \| null` | Low -- Redis pipeline return typing |

### Non-null Assertions (`!`)
15 occurrences of `ctx.userId!` across routers (see Issue #3 above).

---

## Architecture Assessment

### Strengths

1. **Clean tRPC + NestJS integration**: The `TrpcCoreModule` / `TrpcModule` split elegantly avoids circular dependencies. Feature modules import `TrpcCoreModule` for the service, while `TrpcModule` aggregates all routers.

2. **Proper auth security model**: JWT + refresh token rotation with SHA-256 hashing, Redis blacklist for immediate revocation, token reuse detection with full session invalidation -- this is well-implemented.

3. **Zod as single source of truth**: All input schemas live in `@la-grieta/shared`, types are inferred with `z.infer<>`, and routers consume them directly. No type drift between packages.

4. **Database schema quality**: Proper UUID primary keys, FK indexes, unique constraints, `createdAt`/`updatedAt` on all tables, and a clean relations file. The composite unique index on `collections(userId, cardId, condition)` is correctly designed.

5. **Monorepo structure**: Clean separation of concerns with `packages/db`, `packages/shared`, `packages/tsconfig`. Turborepo task graph is correctly configured with `dependsOn: ["^build"]`.

6. **Webpack config**: Simple and correct -- bundles workspace packages while externalizing node_modules.

### Areas for Improvement

1. **No database transactions**: The codebase has zero uses of `db.transaction()`. Operations that span multiple queries (register, setCards, addBulk) should be transactional.

2. **No graceful shutdown**: No `enableShutdownHooks()` in `main.ts`, no `OnModuleDestroy` on the core module. Redis and Postgres connections will leak on hot reloads or container stops.

3. **No structured error codes**: Error messages are human-readable strings. Consider adding machine-readable error codes (e.g., `AUTH_EMAIL_TAKEN`, `COLLECTION_CARD_NOT_FOUND`) for the WhatsApp bot to parse.

4. **No request ID / correlation**: No correlation ID middleware for tracing requests across logs. Important for debugging in production.

---

## Consistency Check

| Pattern | Consistent? | Notes |
|---------|------------|-------|
| Module structure (service + router + module) | Yes | All 5 feature modules follow the same pattern |
| Zod schemas in shared package | Yes | All input types defined in `@la-grieta/shared` |
| Error handling with TRPCError | Yes | Consistent use of proper error codes |
| Pagination pattern | Yes | All list endpoints use cursor-based with `buildPaginatedResult` |
| Rate limiting | Mostly | `UserRouter` is missing rate limiting (Issue #9, #10) |
| DB column selection | No | Some queries use `select()` (all columns), others select specific columns |
| Type exports from DB package | Yes | Consistent `$inferSelect` / `$inferInsert` pattern |

---

## Recommendations Summary

| Priority | Issue | Effort |
|----------|-------|--------|
| P0 | Escape ILIKE wildcards in search inputs | Low |
| P0 | Fix `@ts-ignore` in collection service | Medium |
| P1 | Create `ProtectedContext` type to eliminate `!` assertions | Medium |
| P1 | Fix N+1 queries in `stats()` | Medium |
| P1 | Batch `addBulk` operations in a transaction | Medium |
| P1 | Add null check for auth header in logout/logoutAll | Low |
| P2 | Extract shared column definitions (card, user) | Low |
| P2 | Add rate limiting to UserRouter | Low |
| P2 | Wrap `setCards` in a transaction | Low |
| P2 | Handle uniqueness constraint race condition in register | Medium |
| P3 | Add graceful shutdown hooks | Low |
| P3 | Replace console.log with NestJS Logger | Low |
| P3 | Add request correlation IDs | Medium |
