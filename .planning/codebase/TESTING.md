# Testing Patterns

**Analysis Date:** 2026-03-15

## Test Framework

**Runner:**
- Vitest v2.1.0
- Config: `apps/api/vitest.config.ts`, `packages/db/vitest.config.ts`, `tools/seed/vitest.config.ts`
- Environment: Node.js (no browser simulation)

**Assertion Library:**
- Vitest built-in assertions (`.toBe()`, `.toEqual()`, `.toMatchObject()`, etc.)
- No additional assertion library — vitest provides sufficient API

**Run Commands:**
```bash
npm run test              # Run all tests once
npm run test:watch       # Watch mode (in project root, runs via Turbo)
npm run test:coverage    # Generate coverage report (v8 provider)
```

**Coverage:**
- Provider: v8 (built-in to Vitest)
- Reporters: text (console), lcov (for CI integration)
- Include: `src/**/*.ts`
- Exclude: `src/**/*.spec.ts`, `src/main.ts`, `src/index.ts`
- Target: 80% for services, 60% for routers (enforced via code review, not pre-commit)

## Test File Organization

**Location:**
- API tests: `apps/api/__tests__/` (co-located directory, not inside `src/`)
- Database tests: `packages/db/__tests__/` (if any exist)
- Naming: `[feature].service.spec.ts`, `[feature].integration.spec.ts`

**Why `__tests__/` instead of co-located:**
- Cleaner source directory structure
- All tests grouped together for easier navigation
- Vitest discovers tests via glob pattern in config (`include: ['**/*.spec.ts', '**/*.test.ts']`)

**Structure:**
```
apps/api/__tests__/
├── auth.service.spec.ts           # Unit test for AuthService
├── auth.integration.spec.ts        # End-to-end flow test
├── deck.service.spec.ts
├── card.service.spec.ts
└── trpc.middleware.spec.ts         # Tests for shared middleware
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let db: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    // Initialize mocks and service instance
    db = makeMockDb();
    service = new AuthService(db as never, redis as never, authConfig);
  });

  describe('register()', () => {
    it('should return user and accessToken on successful registration', async () => {
      // Arrange
      db._pushSelect([], []); // no existing email, no existing username
      db._pushInsert([{ id: USER_ID, ... }]); // user insert returning

      // Act
      const result = await service.register(input, mockRes);

      // Assert
      expect(result.user.id).toBe(USER_ID);
      expect(result.accessToken).toBeTruthy();
    });

    it('should throw CONFLICT when email already exists', async () => {
      db._pushSelect([{ id: USER_ID }]); // email already taken

      await expect(
        service.register({ email: 'test@test.com', ... }, mockRes),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });
});
```

**Patterns:**
- Flat structure with `describe()` for feature, nested `describe()` for methods
- AAA (Arrange-Act-Assert) pattern (comments optional if code is clear)
- Setup helpers extracted to functions above test suite (e.g., `makeMockDb()`)
- One assertion per test when possible (fail-fast, clear intent)

## Mocking

**Framework:** Vitest's built-in `vi` utility (no external mock library)

**Patterns:**

### Mock Factories
Each test file defines mock factories for its dependencies:

```typescript
function makeMockDb() {
  const selectResults: unknown[][] = [];
  let selectIdx = 0;

  const select = vi.fn().mockImplementation(() => {
    const capturedIdx = selectIdx++;
    const chain: Record<string, unknown> = {};
    chain['from'] = vi.fn().mockReturnValue(chain);
    chain['where'] = vi.fn().mockReturnValue(chain);
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
```

**Why:** Allows tests to queue multiple results for sequential queries (each `select()` call consumes next queued result).

### Drizzle ORM Mocking
Services use Drizzle chain API:
```typescript
db.select().from(users).where(...).limit(1)  // Returns Promise<T[]>
db.insert(users).values({...}).returning()   // Returns Promise<T[]>
db.update(users).set({...}).where(...)       // Returns Promise<void>
```

Mock chains return results queued via `_pushSelect()`, `_pushInsert()`, etc.

### Spy Example
```typescript
const hashSpy = vi.spyOn(bcrypt, 'hash');
await service.register({...}, mockRes);
expect(hashSpy).toHaveBeenCalledOnce();
expect(hashSpy).toHaveBeenCalledWith(PASSWORD_PLAINTEXT, 12);
```

**What to Mock:**
- Database: Always (use factory mock, never actual DB connection in tests)
- External services (Redis, bcrypt, JWT): Mock or spy
- HTTP dependencies (axios, fetch): Mock responses
- File system: Mock via fs module stubs

**What NOT to Mock:**
- Core language features (Math, crypto, Array methods)
- Business logic validation (Zod schemas — test directly with real schemas)
- Utility functions in the same module (test as part of the service)
- Type system — types are compile-time, not testable at runtime

## Fixtures and Factories

**Test Data:**
```typescript
// Constants defined at top of file
const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PASSWORD_PLAINTEXT = 'Password123!';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD_PLAINTEXT, 1); // low rounds for speed

// Fixture objects
const TEST_USER_ROW = {
  id: USER_ID,
  email: 'juan@lagrietahonduras.com',
  username: 'juanrift',
  passwordHash: PASSWORD_HASH,
  displayName: 'Juan Rift',
  // ... all fields
};

// Factory functions for variations
function setupRegisterSuccess(overrides: Partial<{
  email: string;
  username: string;
}> = {}) {
  const returned = {
    id: USER_ID,
    email: overrides.email ?? TEST_USER_ROW.email,
    username: overrides.username ?? TEST_USER_ROW.username,
  };
  db._pushSelect([], []);       // no conflicts
  db._pushInsert([returned]);   // user insert
  return returned;
}
```

**Location:**
- Inline in `__tests__/` files
- Shared test data: consider `packages/shared/src/test-fixtures/` (not yet in use, but pattern available)

## Coverage

**Requirements:** No hard enforcement (code review gate, not pre-commit)

**View Coverage:**
```bash
npm run test:coverage
# Opens coverage/index.html in browser or prints text report
```

**Target by Layer:**
- Services: 80%+ (most business logic tested)
- Routers: 60%+ (test error paths and integration, not every edge case)
- Components: Not measured (manual testing via Storybook, E2E)

**Gap identification:**
- Run `npm run test:coverage` to find untested branches
- Focus on branches, not line coverage (a line can execute but not all conditions tested)

## Test Types

**Unit Tests:**
- Scope: Single service method or utility function
- Mocked dependencies: All external (DB, Redis, crypto)
- Location: `apps/api/__tests__/[service].service.spec.ts`
- Example: `apps/api/__tests__/auth.service.spec.ts` tests `AuthService.register()`, `.login()`, `.refresh()` in isolation

**Integration Tests:**
- Scope: Full router → service → mocked DB flow
- Exercises tRPC middleware (auth, rate limiting, logging)
- Location: `apps/api/__tests__/[feature].integration.spec.ts`
- Example: `apps/api/__tests__/auth.integration.spec.ts` tests complete auth flow (register → login → me → logout)

**E2E Tests:**
- Not used in this codebase at present
- Would test via HTTP client against running server
- Future: consider for critical flows (auth, payments)

## Common Patterns

### Async Testing
```typescript
it('should return user on valid credentials', async () => {
  db._pushSelect([TEST_USER_ROW]);

  const result = await service.login({ email, password }, mockRes);

  expect(result.user.id).toBe(USER_ID);
});

it('should throw UNAUTHORIZED when user not found', async () => {
  db._pushSelect([]); // no user

  await expect(
    service.login({ email: 'ghost@nowhere.com', password }, mockRes),
  ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
});
```

### Error Testing
Use `.toMatchObject()` to match error structure without deep equality:
```typescript
await expect(service.method()).rejects.toMatchObject({
  code: 'UNAUTHORIZED',
  message: 'Invalid credentials',
});
```

### Mock Call Verification
```typescript
// Single call verification
expect(redis.setex).toHaveBeenCalledOnce();
expect(redis.setex).toHaveBeenCalledWith(`blacklist:${token}`, TTL, '1');

// Multiple calls
expect(db.select).toHaveBeenCalledTimes(2);

// Call order (less common, prefer individual assertions)
const [firstCall, secondCall] = db.select.mock.calls;
```

### State Management Testing (useReducer)
```typescript
// From apps/web/src/hooks/use-local-game-state.ts pattern
it('should expand deck entries into playable cards with unique IDs', () => {
  const entries: LocalDeckEntry[] = [
    { cardId: 'card-1', quantity: 2, zone: 'main', card: {...} }
  ];

  const state = expandEntries(entries);

  expect(state).toHaveLength(2);
  expect(state[0].uid).not.toBe(state[1].uid); // each copy has unique uid
});
```

### Crypto & JWT Testing
```typescript
function signTestJwt(userId: string, role = 'user'): string {
  return jwt.sign({ sub: userId, role }, TEST_JWT_SECRET, { expiresIn: TEST_ACCESS_TTL });
}

it('should issue JWT with correct sub and role claims', async () => {
  const result = await service.register({...}, mockRes);

  const decoded = jwt.verify(result.accessToken, TEST_JWT_SECRET) as jwt.JwtPayload;
  expect(decoded['sub']).toBe(USER_ID);
  expect(decoded['role']).toBe('user');
});
```

### Database Transaction Testing
```typescript
it('should execute operation within transaction', async () => {
  await service.method();

  expect(db.transaction).toHaveBeenCalled();
  // Verify results from within transaction callback
});
```

## Test Maintenance

**Patterns to Avoid:**
- Time-dependent tests: Mock `Date.now()` if needed, don't use real delays
- Order-dependent tests: Each test must be independent, no shared state between tests
- Too many assertions: Keep to 1-3 assertions per test
- Brittle mocks: Use `.toMatchObject()` instead of exact equality when checking error/return shape

**When to Update Tests:**
- Service method signature changes: update call sites in tests
- New error case added: add test for the error
- Database schema change: update fixture objects
- Business logic refactor: update test expectations, not test structure

---

*Testing analysis: 2026-03-15*
