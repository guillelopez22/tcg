# La Grieta TCG — Security Audit Report

**Date:** 2026-03-10
**Auditor:** Software Architect (automated review)
**Scope:** Full monorepo — authentication, authorization, input validation, rate limiting, database security, OWASP Top 10
**Codebase Commit:** Current `main` branch

---

## Executive Summary

The codebase demonstrates **solid security foundations** for an early-stage project. Authentication uses industry-standard bcryptjs (12 rounds) with JWT + refresh token rotation. Input validation via Zod is consistently applied across all tRPC procedures. Rate limiting is implemented with Redis sliding windows. No raw SQL injection vectors were found in application code.

**Overall Security Posture: GOOD** — with a small number of medium-severity issues that should be addressed before production launch.

| Severity | Count |
|----------|-------|
| CRITICAL | 0     |
| HIGH     | 2     |
| MEDIUM   | 5     |
| LOW      | 4     |
| INFO     | 4     |

---

## Findings

### HIGH-001: ILIKE Queries with Unsanitized User Input (LIKE Injection)

**Severity:** HIGH
**Files:**
- `apps/api/src/modules/card/card.service.ts:51` — `ilike(cards.domain, \`%${input.domain}%\`)`
- `apps/api/src/modules/card/card.service.ts:55` — `ilike(cards.cleanName, \`%${input.search}%\`)`
- `apps/api/src/modules/deck/deck.service.ts:225` — `ilike(decks.domain, \`%${input.domain}%\`)`
- `apps/api/src/modules/deck/deck.service.ts:229` — `ilike(decks.name, \`%${input.search}%\`)`

**Description:** User-supplied `search` and `domain` strings are interpolated directly into ILIKE patterns without escaping `%` and `_` wildcard characters. While Drizzle ORM parameterizes the query (preventing SQL injection), users can inject LIKE wildcards to craft expensive pattern-matching queries (e.g., `%_%_%_%_%` repeated). This is a DoS vector and a data probing vector.

**Recommended Fix:** Escape `%` and `_` characters in user input before embedding in LIKE patterns:
```typescript
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}
// Usage:
conditions.push(ilike(cards.cleanName, `%${escapeLike(input.search)}%`));
```

---

### HIGH-002: Public Profile Endpoint Leaks Email and WhatsApp Phone

**Severity:** HIGH
**File:** `apps/api/src/modules/user/user.service.ts:12-37`

**Description:** The `getProfile` endpoint is a **public procedure** (no auth required, per `apps/api/src/modules/user/user.router.ts:16`) and returns the full `UserOutput` schema which includes `email` and `whatsappPhone`. These are PII fields that should not be exposed to unauthenticated users or to users viewing someone else's profile.

**Recommended Fix:** Create a separate `PublicUserOutput` schema that excludes `email` and `whatsappPhone`, or conditionally strip those fields when the requester is not the profile owner.

---

### MEDIUM-001: User Router Endpoints Missing Rate Limiting

**Severity:** MEDIUM
**File:** `apps/api/src/modules/user/user.router.ts:16-22`

**Description:** Both `user.getProfile` and `user.updateProfile` use the base `publicProcedure` and `protectedProcedure` respectively, without any rate limiting middleware applied. All other routers (auth, card, collection, deck) consistently apply rate limiting. This is likely an oversight.

- `getProfile` uses `this.trpc.publicProcedure` (no rate limit)
- `updateProfile` uses `this.trpc.protectedProcedure` (no rate limit)

**Recommended Fix:** Use `rateLimitedPublicProcedure` for `getProfile` and `rateLimitedProtectedProcedure` for `updateProfile`.

---

### MEDIUM-002: No `jti` (JWT ID) Claim in Access Tokens

**Severity:** MEDIUM
**File:** `apps/api/src/modules/auth/auth.service.ts:258-266`

**Description:** Access tokens are signed without a `jti` claim. The `jwtPayloadSchema` marks `jti` as optional (`z.string().optional()`), and the `signAccessToken` method does not include it. Without `jti`, the logout blacklisting mechanism stores the entire raw JWT in Redis (`blacklist:${accessToken}` at line 176), which wastes memory and makes blacklist keys extremely long.

**Recommended Fix:** Add `jti: crypto.randomUUID()` to the JWT payload and use `blacklist:${jti}` as the Redis key instead.

---

### MEDIUM-003: No Minimum JWT Secret Length Enforcement

**Severity:** MEDIUM
**File:** `apps/api/src/config/auth.config.ts:5-9`

**Description:** The `jwtSecret` getter only checks that `JWT_SECRET` is not empty. It does not enforce a minimum length. A short secret (e.g., `"abc"`) would be trivially brute-forceable for HS256. The `.env.example` notes "at least 32 chars" but this is not enforced in code.

**Recommended Fix:** Add a minimum length check:
```typescript
if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
```

---

### MEDIUM-004: Missing `Helmet` Security Headers

**Severity:** MEDIUM
**File:** `apps/api/src/main.ts`

**Description:** The NestJS application does not use `helmet` or any equivalent middleware to set security-related HTTP headers (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.). While tRPC endpoints return JSON (limiting XSS surface), security headers are a defense-in-depth measure.

**Recommended Fix:** Install `helmet` and apply it in `main.ts`:
```typescript
import helmet from 'helmet';
app.use(helmet());
```

---

### MEDIUM-005: `card.sync` Endpoint Returns Full Card Database Without Pagination

**Severity:** MEDIUM
**File:** `apps/api/src/modules/card/card.service.ts:174-192`

**Description:** The `card.sync` endpoint loads ALL non-product cards into memory and returns them in a single response when the client's hash does not match. With ~550+ cards, this is manageable today, but as the card pool grows this becomes a memory pressure and bandwidth concern. More critically, this is a public endpoint and can be used for cheap DoS by repeatedly sending mismatched hashes.

**Recommended Fix:** This endpoint is rate-limited (uses `rateLimitedPublicProcedure`), which mitigates the DoS risk. For future-proofing, consider paginating or using incremental sync (return only cards updated since a timestamp).

---

### LOW-001: Refresh Token Grace Period Weakens Rotation Security

**Severity:** LOW
**File:** `apps/api/src/modules/auth/auth.service.ts:30-31, 128`

**Description:** A 30-second grace period is applied to refresh token expiry to handle concurrent tab races. While this is a practical trade-off, it means a stolen refresh token remains valid for up to 30 seconds after the legitimate user has already rotated it. The token reuse detection (line 145-151) mitigates this — if both the attacker and user try to use the same token, all sessions are revoked.

**Impact:** Low — the reuse detection provides good protection. Document this as a known trade-off.

---

### LOW-002: `cardGetByExternalIdSchema` Has No Length Limit on `externalId`

**Severity:** LOW
**File:** `packages/shared/src/schemas/card.schema.ts:20`

**Description:** `externalId: z.string()` has no `.max()` constraint. An attacker could send an extremely long string. While Drizzle will parameterize it and the DB column is `varchar(100)`, the string could consume memory during request processing.

**Recommended Fix:** Add `.max(100)` to match the DB column constraint.

---

### LOW-003: `updateUserSchema.whatsappPhone` Lacks Format Validation

**Severity:** LOW
**File:** `packages/shared/src/schemas/user.schema.ts:8`

**Description:** `whatsappPhone: z.string().max(20).optional()` accepts any string up to 20 characters. It does not validate phone number format. Users could store arbitrary text in this field.

**Recommended Fix:** Add a regex pattern for international phone numbers:
```typescript
whatsappPhone: z.string().max(20).regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number').optional()
```

---

### LOW-004: `deckBrowseSchema.domain` Has No Length Limit

**Severity:** LOW
**File:** `packages/shared/src/schemas/deck.schema.ts:42`

**Description:** `domain: z.string().optional()` has no `.max()` constraint. Similar to LOW-002, this could be used to send very long strings.

**Recommended Fix:** Add `.max(100)` to match the DB column constraint.

---

### INFO-001: `console.log` Used for Request Logging

**Severity:** INFO
**File:** `apps/api/src/trpc/trpc.service.ts:26`

**Description:** The tRPC logging middleware uses `console.log` for request logging. No sensitive data is logged (only path, type, status, duration), so this is not a vulnerability. However, structured logging (e.g., `pino` or `winston`) would be preferable for production for log aggregation and filtering.

---

### INFO-002: Docker Compose Exposes Ports to Host

**Severity:** INFO
**File:** `docker-compose.yml:13, 29`

**Description:** PostgreSQL (5432) and Redis (6379) are mapped to host ports. This is appropriate for local development but should be restricted in production. Railway deployment does not use docker-compose, so this is a dev-only concern.

---

### INFO-003: CORS Origin List is Configurable (Good)

**Severity:** INFO
**File:** `apps/api/src/main.ts:13-17`

**Description:** CORS origins are configured from environment variables with a safe default of `localhost:3000`. The implementation is correct and does not use `origin: true` or `*`. This is properly implemented.

---

### INFO-004: `.gitignore` Properly Excludes Secrets

**Severity:** INFO
**File:** `.gitignore:38-41`

**Description:** The `.gitignore` properly excludes `.env`, `.env.local`, `.env.*.local`, and `*.env`. The `.env.example` file contains only placeholder values (`change_me_in_production`, `sk_test_...`). No real secrets are committed. This is properly implemented.

---

## Security Checklist Summary

| Area | Status | Notes |
|------|--------|-------|
| Password hashing | PASS | bcryptjs, 12 rounds |
| JWT implementation | PASS | HS256, 15min access, 30d refresh, Zod-validated payload |
| Refresh token rotation | PASS | SHA-256 hashed in DB, reuse detection revokes all sessions |
| Token blacklisting | PASS | Redis-backed with TTL matching access token expiry |
| Input validation (Zod) | PASS | All tRPC procedures have Zod input schemas |
| Rate limiting | PARTIAL | Applied to auth/card/collection/deck routers, **missing on user router** |
| SQL injection | PASS | All queries via Drizzle ORM, parameterized |
| LIKE injection | FAIL | User input not escaped for LIKE wildcards |
| XSS (API-level) | PASS | tRPC returns JSON, no HTML rendering on backend |
| CSRF | N/A | API uses Bearer token auth (not cookies), CSRF not applicable |
| Secrets management | PASS | No hardcoded secrets, .env properly gitignored |
| Security headers | FAIL | No helmet middleware |
| Docker security | PASS | Non-root user, dumb-init, multi-stage build |
| PII exposure | FAIL | Public profile leaks email and phone |
| Logging | PASS | No secrets or PII in logs |

---

## Recommended Priority Order for Fixes

1. **HIGH-002** — Public profile PII leak (quick fix, high impact)
2. **HIGH-001** — LIKE injection escaping (quick fix, prevents DoS/probing)
3. **MEDIUM-001** — Add rate limiting to user router (trivial fix)
4. **MEDIUM-003** — Enforce minimum JWT secret length (one-line fix)
5. **MEDIUM-004** — Add helmet middleware (one-line fix)
6. **MEDIUM-002** — Add `jti` to JWTs (moderate refactor)
7. **LOW-002, LOW-004** — Add `.max()` to unbounded string schemas
8. **LOW-003** — Phone number format validation
