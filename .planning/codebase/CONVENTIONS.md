# Coding Conventions

**Analysis Date:** 2026-03-15

## Naming Patterns

**Files:**
- Services: `[feature].service.ts` (e.g., `auth.service.ts`)
- Routers: `[feature].router.ts` (e.g., `auth.router.ts`)
- Modules: `[feature].module.ts` (e.g., `auth.module.ts`)
- Components: kebab-case with `.tsx` extension (e.g., `deck-list.tsx`, `add-cards-modal.tsx`)
- Hooks: `use-[feature].ts` (e.g., `use-local-game-state.ts`)
- Schemas: `[feature].schema.ts` (e.g., `deck.schema.ts`)
- Tests: co-located with feature using `.spec.ts` suffix in `__tests__/` directory

**Functions:**
- camelCase: `registerUser()`, `buildRouter()`, `formatPrice()`
- Prefixes for specific patterns:
  - Validation: `validate*()`, `is*()`
  - Builders: `make*()`
  - Factories: `make*()` (e.g., `makeMockDb()`, `makeMockRes()`)
  - Helpers: no special prefix, used within modules

**Variables:**
- camelCase for all variables and parameters
- Constants in UPPER_SNAKE_CASE at module level (e.g., `BCRYPT_ROUNDS`, `TEST_JWT_SECRET`)
- Underscore prefix for "private" fields in tests (e.g., `_pushSelect()`, `_pushInsert()`)
- Ref suffixes for useRef hooks: `deleteTimerRef`, `textInputRef`

**Types:**
- PascalCase for all types, interfaces, and enums
- Suffix conventions:
  - Input types: `*Input` (e.g., `RegisterInput`, `CardListInput`)
  - Result types: `*Result` (e.g., `AuthResult`, `PaginatedResult`)
  - Config types: `*Config` (e.g., `AuthConfig`)
  - Schema types derived from Zod: inferred from `z.infer<typeof schema>`
  - Event/message types: no suffix (e.g., `JwtPayload`)
- Union types for variants: `'my-decks' | 'community' | 'trending'`

## Code Style

**Formatting:**
- Tool: Prettier v3
- Print width: 100 characters
- Indentation: 2 spaces, no tabs
- Quotes: Single quotes (`'`) for strings
- Semicolons: Always included
- Trailing commas: All (even in function parameters)
- Arrow parens: Always (`(x) =>` not `x =>`)
- Line endings: LF

**Run formatting:**
```bash
npm run format                # Format all files
npm run format:check          # Check formatting without changes
```

**Linting:**
- Tool: ESLint v9 with flat config
- Primary config: `packages/eslint-config/base.js`
- Framework-specific configs:
  - NestJS: `packages/eslint-config/nestjs.js`
  - Next.js: `packages/eslint-config/next.js`

**Key ESLint rules:**
- TypeScript strict: no `any`, all unused vars error (unless prefixed `_`)
- Consistent type imports: `import type { X }` (colon required, not just `import`)
- No duplicate imports: consolidate from same source
- Import order enforced: builtin → external → internal → parent → sibling → index (alphabetized, newlines between groups)
- Equality: `===` always, never `==`
- Console: only `console.warn()` and `console.error()` allowed in production code (test files exempt)
- NestJS decorator functions: allow empty constructors for DI

## Import Organization

**Order:**
1. Builtin Node modules (`import { ... } from 'node:path'`)
2. External packages (`import Express from 'express'`, `import { z } from 'zod'`)
3. Internal absolute imports (`import { AuthService } from '@la-grieta/db'`)
4. Parent relative imports (`import { ... } from '../..'`)
5. Sibling relative imports (`import { ... } from './'`)
6. Index imports (`import { ... } from '.'`)

Within each group: alphabetized case-insensitive, newlines between groups.

**Path Aliases:**
- `@la-grieta/db`: `packages/db/src/index.ts`
- `@la-grieta/shared`: `packages/shared/src/index.ts`
- `@la-grieta/r2`: `apps/api/src/infrastructure/r2.ts`
- `@/lib/*`, `@/components/*`, `@/app/*` (Next.js web app only)

**Type Imports:**
```typescript
import type { AuthResult, JwtPayload } from '@la-grieta/shared';
import type { DbClient } from '@la-grieta/db';
import { AuthService } from './auth.service';
```

## Error Handling

**Pattern:** TRPCError with explicit status codes
- Throw from services: `throw new TRPCError({ code: 'UNAUTHORIZED', message: '...' })`
- Router middleware catches and forwards to client
- No custom error classes — use TRPC error codes as the single source of truth

**Common Error Codes:**
- `UNAUTHORIZED`: Invalid credentials, missing auth
- `FORBIDDEN`: Auth insufficient (deactivated account, etc.)
- `NOT_FOUND`: Resource does not exist
- `CONFLICT`: Duplicate constraint, invalid state
- `BAD_REQUEST`: Input validation failure
- `INTERNAL_SERVER_ERROR`: Unexpected failure (DB error, etc.)

**Error Message Consistency:**
- User-facing: clear, actionable (e.g., "Invalid credentials")
- Never expose implementation details (DB column names, internal IDs)
- Validation errors delegate to Zod, which includes field-level messages

**Example from** `apps/api/src/modules/auth/auth.service.ts`:
```typescript
if (!user) {
  throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
}
if (!user.isActive) {
  throw new TRPCError({ code: 'FORBIDDEN', message: 'Account is deactivated' });
}
```

## Logging

**Framework:** `console` (no dedicated logger library)

**Rules:**
- Only `console.warn()` and `console.error()` in production code
- Never log passwords, tokens, or PII
- Use sparingly — prefer returning structured errors
- Test files (`*.spec.ts`, `__tests__/**`): console allowed without restriction

**Pattern:**
```typescript
// OK in service
console.error('Failed to update user:', userId, error);

// Not OK
console.log('User password hash:', passwordHash); // Never log secrets
```

## Comments

**When to Comment:**
- Explain *why*, not *what* — the code shows what it does
- Clarify non-obvious business logic (e.g., "Grace period for concurrent tab refresh races")
- Document edge cases and workarounds
- Mark test-specific assumptions (see testing patterns)

**JSDoc/TSDoc:**
- Used minimally — primarily for exported functions in services
- Document return types and parameters when not obvious from signature
- Example from tests: `/** Drizzle-style chainable mock. */`

**Example from** `apps/api/src/modules/auth/auth.service.ts`:
```typescript
// Grace period for concurrent tab refresh races (30 seconds)
const REFRESH_GRACE_PERIOD_MS = 30_000;

function isUniqueConstraintError(err: unknown): boolean {
  // PostgreSQL error code 23505 = unique constraint violation
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>)['code'] === '23505'
  );
}
```

## Function Design

**Size:**
- Prefer small, single-responsibility functions (< 50 lines)
- Use helper functions to extract logic (e.g., `isUniqueConstraintError()`)
- Break complex procedures into named steps

**Parameters:**
- Prefer options objects over long parameter lists
- Use type-driven design: if signature is complex, the domain model needs refinement
- Never use rest parameters (`...args`) unless explicitly needed

**Return Values:**
- Always be explicit about return type (no implicit `any`)
- Return `Promise<T>` for async functions (never `Promise<T | undefined>` — handle undefined as error or false case)
- Use discriminated unions for complex returns (e.g., `{ success: true, user: ... } | { success: false, error: ... }`)

**Example from** `apps/api/src/modules/auth/auth.service.ts`:
```typescript
async register(input: RegisterInput, res: Response): Promise<AuthResult> {
  // Check preconditions, throw errors, return success case only
  return { user, accessToken };
}
```

## Module Design

**Exports:**
- Each module file exports one primary thing (service, router, constant)
- Use barrel files (`index.ts`) only for cross-module interfaces needed by multiple consumers

**Barrel Files:**
- Used in `packages/shared/src/index.ts` to re-export all schemas and types
- Used in `packages/db/src/index.ts` to re-export Drizzle ORM and types
- Not overused — most modules are imported directly

**Module Structure (NestJS):**
```typescript
// pattern used in apps/api/src/modules/auth/

auth.service.ts    // Business logic, pure functions, DB queries
auth.router.ts     // tRPC endpoint definitions, input validation, error handling
auth.module.ts     // NestJS module wiring
```

## Zod Schemas as Source of Truth

**Pattern:**
- Define input schemas in `packages/shared/src/schemas/`
- Infer types from schemas: `type RegisterInput = z.infer<typeof registerSchema>`
- Use same schema for validation in router `.input(schema)`
- Schema is the contract between client and server

**Example from** `packages/shared/src/schemas/deck.schema.ts`:
```typescript
export const deckCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().default(false),
  coverCardId: z.string().uuid().optional(),
  cards: z.array(deckCardEntrySchema).max(63).optional(),
});

export type DeckCreateInput = z.infer<typeof deckCreateSchema>;
```

## React Component Patterns

**Naming:**
- Exported components: PascalCase (e.g., `DeckList`, `AddCardsModal`)
- Sub-components (function within file): PascalCase with clear scope
- Use `'use client'` at top of file for client-side components

**Hooks:**
- Custom hooks use `use*` convention: `useLocalGameState()`, `useAuth()`
- Prefer React hooks (useState, useReducer, useEffect) over external state managers
- Extract logic into custom hooks when reused across components

**Example from** `apps/web/src/app/(dashboard)/decks/deck-list.tsx`:
```typescript
'use client';

export function DeckList() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DeckTab>('my-decks');
  const trpc = trpc.useUtils();
}
```

---

*Convention analysis: 2026-03-15*
