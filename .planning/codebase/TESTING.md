# Testing Patterns

**Analysis Date:** 2026-03-11

## Test Framework

**Runner:**
- Vitest v2.1.0
- Config: `apps/api/vitest.config.ts`
- Environment: Node.js (not browser)
- Globals enabled: `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` available without imports

**Assertion Library:**
- Vitest built-in (matchers from Vitest/Chai)
- Methods: `expect(value).toBe()`, `expect(value).toEqual()`, `expect(fn).rejects.toMatchObject()`, etc.

**Run Commands:**
```bash
pnpm test              # Run all tests in workspace
pnpm test:coverage     # Run with coverage report (v8 provider)
cd apps/api && pnpm test          # Run API tests only
cd apps/api && pnpm test:coverage # API coverage only
```

**Coverage Configuration:**
- Provider: v8
- Reporters: text (console) + lcov (HTML report in coverage/)
- Include: `src/**/*.ts`
- Exclude: `src/**/*.spec.ts`, `src/main.ts`
- Location: `apps/api/coverage/`

## Test File Organization

**Location:**
- Spec files co-located adjacent to `src/` in `__tests__/` directory
- Structure: `apps/api/__tests__/` contains all test files
- Not split by domain (all tests in one directory, named by module)

**Naming:**
- Spec files: `*.spec.ts` (primary pattern used throughout)
- Alternative: `*.test.ts` (both are included in vitest config)
- Patterns: `user.service.spec.ts`, `auth.service.spec.ts`, `card.integration.spec.ts`

**Test Categories:**
- Unit tests: single service in isolation (e.g., `user.service.spec.ts`)
- Integration tests: full stack including router (e.g., `auth.integration.spec.ts`)
- Middleware tests: tRPC middleware behavior (e.g., `trpc.middleware.spec.ts`)
- Feature tests: cross-service interactions (e.g., `collection-deck.integration.spec.ts`)

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../src/modules/user/user.service';

// Mock factory section (always first)
function makeMockDb() { ... }

// Test fixtures section (constants and test data)
const USER_ID = 'a1b2c3d4...';
const TEST_USER_PROFILE = { id: USER_ID, ... };

// Test suite
describe('UserService', () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: UserService;

  beforeEach(() => {
    db = makeMockDb();
    service = new UserService(db as never);
  });

  describe('getProfile()', () => {
    it('should return user profile when username exists', async () => {
      db._pushSelect([TEST_USER_PROFILE]);
      const result = await service.getProfile('juanrift');
      expect(result.id).toBe(USER_ID);
    });
  });
});
```

**Standard Sections:**
1. Imports and type declarations
2. Mock factory functions (always documented with call patterns)
3. Test fixtures and constants (UPPER_SNAKE_CASE)
4. Main `describe()` suite
5. Nested `describe()` blocks per method
6. Individual `it()` test cases

**Patterns:**
- Setup: `beforeEach()` creates fresh mocks and service instance per test
- Teardown: implicit (mocks reset, no `afterEach()` needed for unit tests)
- Assertions: multiple `expect()` calls per test allowed
- Naming: `it('should [behavior] when [condition]', async () => { ... })`

## Mocking

**Framework:** Vitest `vi` module

**Patterns:**

**Mock Functions:**
```typescript
const select = vi.fn().mockImplementation(() => {
  const capturedIdx = selectIdx++;
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  return chain;
});

// Assertions on calls:
expect(db.select).toHaveBeenCalled();
expect(db.select).not.toHaveBeenCalled();
```

**Mock Return Values (Queue Pattern):**
```typescript
function makeMockDb() {
  const selectResults: unknown[][] = [];
  let selectIdx = 0;

  const select = vi.fn().mockImplementation(() => {
    const capturedIdx = selectIdx++;
    // ... chain setup ...
    chain['limit'] = vi.fn().mockImplementation(() =>
      Promise.resolve(selectResults[capturedIdx] ?? []),
    );
    return chain;
  });

  return {
    select,
    _pushSelect: (...rows: unknown[][]) => { selectResults.push(...rows); },
  };
}

// Usage:
db._pushSelect([TEST_USER_PROFILE]);
const result = await service.getProfile('username');
```

**Chainable Mock (Drizzle ORM Pattern):**
```typescript
// For query chains: .select().from().where().limit()
const select = vi.fn().mockImplementation(() => {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockImplementation(() =>
    Promise.resolve([...])
  );
  return chain;
});
```

**Thenable Chain (for terminal orderBy):**
```typescript
// For queries without .limit(): .select().from().orderBy()
chain['orderBy'] = vi.fn().mockImplementation(() => {
  const orderChain: Record<string, unknown> = {};
  orderChain['limit'] = vi.fn().mockImplementation(() =>
    Promise.resolve([...])
  );
  // Make the chain itself awaitable
  orderChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve([...]).then(onFulfilled);
  return orderChain;
});
```

## What to Mock

**Always Mock:**
- Database (`DbClient`) — all DB operations are mocked with chainable Drizzle patterns
- Redis client — operations return predictable values
- Express `Response` object for cookie setting
- bcryptjs in unit tests (use real bcrypt in integration tests)
- JWT signing/verification in unit tests

**Never Mock:**
- Zod schemas — they should validate real data
- TRPCError construction — it's part of the API contract
- Service methods being tested — test them directly
- Application startup logic

## Fixtures and Factories

**Test Data:**
```typescript
// Constants (reused across tests)
const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEST_USER_PROFILE = {
  id: USER_ID,
  email: 'juan@lagrietahonduras.com',
  username: 'juanrift',
  displayName: 'Juan Rift',
  // ... all required fields ...
};

// Inline factories for test-specific data
const updated = { ...TEST_USER_PROFILE, displayName: 'New Name' };
db._pushUpdate([updated]);
```

**Helper Functions:**
```typescript
function makeCard(overrides: Partial<{
  id: string;
  name: string;
}> = {}): Card {
  return {
    id: overrides.id ?? 'card-uuid-...',
    name: overrides.name ?? 'Default Card',
    // ... defaults ...
  };
}
```

**Location:**
- Test fixtures: top-level constants in `__tests__/filename.spec.ts`
- Shared fixtures: not extracted (keep fixtures close to tests that use them)
- Real data: card data loaded from `riftbound-tcg-data/` only in integration/e2e tests

## Coverage

**Requirements:** No minimum enforced in `vitest.config.ts`, but CLAUDE.md specifies:
- Services: minimum 80% coverage
- Controllers/Routers: minimum 60% coverage

**View Coverage:**
```bash
cd apps/api
pnpm test:coverage
# Opens coverage report in HTML at coverage/index.html
```

**Coverage Gaps (Deliberately Untested):**
- Integration tests that require real database/Redis
- Error handling for network timeouts (difficult to mock reliably)
- Third-party library behavior (assume it works)

## Test Types

**Unit Tests:**
- Scope: Single service in isolation with mocked dependencies
- Files: `*.service.spec.ts` (e.g., `user.service.spec.ts`)
- Examples: `UserService.getProfile()`, `CardService.list()`, `AuthService.register()`
- Approach: Mock DB/Redis, test business logic, error handling, edge cases
- Typical size: 100-300 lines per service

**Integration Tests:**
- Scope: Full stack (router → service → mocked DB) including tRPC middleware
- Files: `*.integration.spec.ts` (e.g., `auth.integration.spec.ts`)
- Examples: `auth.integration.spec.ts` (register → login → me → logout flow)
- Approach: Build complete router, create mocked context, test end-to-end behavior
- Typical size: 200-400 lines per flow

**Feature Tests:**
- Scope: Cross-domain interactions (e.g., collection + deck)
- Files: `domain1-domain2.integration.spec.ts`
- Examples: `collection-deck.integration.spec.ts`
- Approach: Test how multiple services interact through mocked DB

**E2E Tests:**
- Status: Not used (too heavy for card sync scenarios)
- Alternative: Integration tests cover most scenarios

## Common Patterns

**Async Testing:**
```typescript
it('should return user profile when username exists', async () => {
  db._pushSelect([TEST_USER_PROFILE]);

  const result = await service.getProfile('juanrift');

  expect(result.id).toBe(USER_ID);
});

// For rejected promises:
await expect(
  service.getProfile('nonexistentuser')
).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'User not found' });
```

**Error Testing:**
```typescript
it('should throw NOT_FOUND when user does not exist', async () => {
  db._pushSelect([]); // Empty result

  await expect(
    service.getProfile('nonexistentuser')
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'User not found',
  });
});
```

**Multiple Assertions:**
```typescript
it('should include all required profile fields', async () => {
  db._pushSelect([TEST_USER_PROFILE]);
  const result = await service.getProfile('juanrift');

  const required = ['id', 'email', 'username', 'displayName', ...];
  for (const field of required) {
    expect(result).toHaveProperty(field);
  }
});
```

**Testing Field Preservation:**
```typescript
it('should only update explicitly provided fields', async () => {
  const updated = { ...TEST_USER_PROFILE, city: 'Choluteca' };
  db._pushUpdate([updated]);

  const result = await service.updateProfile(USER_ID, { city: 'Choluteca' });

  expect(result.city).toBe('Choluteca');
  expect(result.bio).toBe(TEST_USER_PROFILE.bio); // unchanged
});
```

**Testing that Methods Are NOT Called:**
```typescript
it('should NOT call db.update when input is empty', async () => {
  db._pushSelect([TEST_USER_PROFILE]);

  await service.updateProfile(USER_ID, {});

  expect(db.update).not.toHaveBeenCalled();
});
```

## Test Execution Details

**Globals:** All test functions available without imports (configured in vitest.config.ts)

**Isolation:** Each test runs independently:
- Fresh `makeMockDb()` instance per `beforeEach()`
- Fresh service instance with new mocks
- No shared state between tests

**Async Handling:** All async operations use `await` with Vitest's automatic async detection

**File Resolution:** TypeScript aliases work in tests (configured in `vitest.config.ts`):
- `@la-grieta/db` → `packages/db/src/index.ts`
- `@la-grieta/shared` → `packages/shared/src/index.ts`

---

*Testing analysis: 2026-03-11*
