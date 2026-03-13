# Coding Conventions

**Analysis Date:** 2026-03-11

## Naming Patterns

**Files:**
- Service files: `*.service.ts` (e.g., `user.service.ts`, `auth.service.ts`)
- Router files: `*.router.ts` (e.g., `auth.router.ts`, `card.router.ts`)
- Module files: `*.module.ts` (e.g., `auth.module.ts`, `card.module.ts`)
- Config files: `*.config.ts` stored in `src/config/` directory
- Schema files: `*.schema.ts` stored in `packages/shared/src/schemas/`
- Spec files: `*.spec.ts` or `*.test.ts` in `__tests__/` directory adjacent to `src/`

**Functions:**
- Camel case: `getProfile()`, `updateProfile()`, `createSession()`, `setRefreshCookie()`
- Verb-first pattern for operations: `register()`, `login()`, `logout()`, `refresh()`
- Private/internal helpers: camelCase prefixed with underscore in test mocks (e.g., `_pushSelect()`, `_pushInsert()`)
- Factory functions for mocks: `makeMockDb()`, `makeMockRes()`, `makeMockRedis()`

**Variables:**
- Constants: UPPER_SNAKE_CASE (e.g., `BCRYPT_ROUNDS`, `USER_ID`, `TEST_JWT_SECRET`)
- Local variables: camelCase (e.g., `existingEmail`, `updateData`, `passwordHash`)
- Test fixtures: UPPER_SNAKE_CASE with descriptive prefix (e.g., `TEST_USER_PROFILE`, `TEST_SET`, `SET_ID`)

**Types:**
- Interfaces: PascalCase, often exported with suffix (e.g., `AuthResult`, `AuthConfig`)
- Type aliases: PascalCase (e.g., `CardWithSet`)
- Zod schemas: camelCase, exported with Schema suffix (e.g., `registerSchema`, `loginSchema`)
- Types inferred from Zod: `z.infer<typeof schema>` pattern (e.g., `type RegisterInput = z.infer<typeof registerSchema>`)

**Classes:**
- PascalCase: `UserService`, `AuthService`, `CardService`, `AuthRouter`, `AuthModule`
- NestJS convention: `@Injectable()` decorator for services, `@Module()` for modules

## Code Style

**Formatting:**
- Prettier v3.0.0 configured with:
  - Print width: 100 characters
  - Tab width: 2 spaces
  - Trailing commas: all
  - Quotes: single quotes (`'`)
  - Semicolons: true
  - Arrow function parens: always (e.g., `(param) => { ... }`)
  - Line ending: LF

- Configuration file: `packages/eslint-config/.prettierrc.js`
- Run: `pnpm format` or `pnpm format:check`

**Linting:**
- ESLint with TypeScript support (flat config)
- Base config: `packages/eslint-config/base.js`
- Specializations: `nestjs.js` for API, `next.js` for web

**Key ESLint Rules:**
- `@typescript-eslint/no-explicit-any`: error (strict no `any`)
- `@typescript-eslint/no-unused-vars`: error (unused params must use `_` prefix)
- `@typescript-eslint/consistent-type-imports`: error (use type imports)
- `no-console`: warn (allow `console.warn` and `console.error`)
- `eqeqeq`: error (always use `===`, never `==`)
- `import/order`: alphabetical grouping by type (builtin → external → internal → parent → sibling → index)

## Import Organization

**Order:**
1. Node.js/runtime builtins (e.g., `import * as crypto from 'crypto'`)
2. External packages (e.g., `import { Injectable } from '@nestjs/common'`)
3. Internal absolute imports (e.g., `import { users } from '@la-grieta/db'`)
4. Relative imports (parent/sibling/index)

**Path Aliases:**
- `@la-grieta/db`: Maps to `packages/db/src/`
- `@la-grieta/shared`: Maps to `packages/shared/src/`
- `@la-grieta/tsconfig`: TypeScript base config
- `@la-grieta/eslint-config`: Linting/formatting config

**Type Imports:**
- Always use explicit `import type { ... } from '...'` for types
- Example: `import type { DbClient } from '@la-grieta/db'`

## Error Handling

**Patterns:**
- Use `TRPCError` from `@trpc/server` for API endpoint errors
- Include error code and user-friendly message: `new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })`
- Common codes: `'NOT_FOUND'`, `'CONFLICT'`, `'UNAUTHORIZED'`, `'FORBIDDEN'`, `'INTERNAL_SERVER_ERROR'`

**Database Errors:**
- Wrap database operations in try-catch for constraint violations
- Helper: `isUniqueConstraintError(err)` checks PostgreSQL constraint violations (code 23505)
- Throw user-facing TRPCError rather than raw database errors

**Validation:**
- Use Zod schemas for all API input validation
- Route inputs: `.input(schema)` in tRPC procedure definition
- Zod provides automatic type inference: `type RegisterInput = z.infer<typeof registerSchema>`

**Async/Await:**
- All async operations use async/await (not `.then()` chains)
- Functions marked with `async` keyword
- Operations await before processing results

## Logging

**Framework:** `console` (no logger library)

**Patterns:**
- Info: `console.log()` for startup messages and tRPC logging
- Warnings: `console.warn()` for recoverable issues (linting allows)
- Errors: `console.error()` for fatal issues (linting allows)

**tRPC Logging:**
- Built into `TrpcService`: logs procedure name, type (query/mutation), result status, duration in ms
- Example: `console.log('[tRPC] auth.register mutation — ok (120ms)')`

## Comments

**When to Comment:**
- Complex mock setups: describe call patterns and Drizzle chains (see test files)
- Business logic: explain why a decision was made (not what the code does)
- Section dividers: use comment blocks (`// -----------`)

**JSDoc/TSDoc:**
- Optional but encouraged for public exports
- Not required for private test helpers
- Example patterns in mock factories in spec files

**Test File Structure:**
- Always include mock factory documentation above function showing expected call patterns
- Example from `user.service.spec.ts`:
  ```
  /**
   * Drizzle chain mock for UserService.
   *
   * Call patterns:
   *   getProfile:    db.select({...}).from(users).where(...).limit(1)
   */
  ```

## Function Design

**Size:**
- Services: functions typically 20-100 lines
- Keep database queries focused: one operation per function (select, insert, update, delete)
- Extract complex conditional logic into helper functions

**Parameters:**
- Injectable dependencies: declared in constructor
- Route input: single `input` parameter of validated type
- Context: passed as second parameter in tRPC routers (includes `ctx.userId`, `ctx.req`, `ctx.res`)
- Use destructuring for object parameters

**Return Values:**
- Services return fully typed objects (inferred from Zod or explicit types)
- Throw errors rather than return null/undefined
- Use optional properties sparingly; prefer explicit empty arrays or throw

**Example:**
```typescript
async list(input: CardListInput): Promise<PaginatedResult<Card>> {
  const conditions = [];
  // Build query conditions
  const rows = await this.db.select(...).from(...).where(...);
  return { items: rows, nextCursor: ... };
}
```

## Module Design

**Exports:**
- Classes: export with `export class ClassName { ... }`
- Types: export with `export type TypeName = ...` or `export interface InterfaceName { ... }`
- Schemas: export const schema, then export type (inferred)
- Barrel files: not used; import directly from source

**Example:**
```typescript
export const registerSchema = z.object({ ... });
export type RegisterInput = z.infer<typeof registerSchema>;

export class AuthService {
  async register(input: RegisterInput): Promise<...> { ... }
}
```

**Service Architecture:**
- One service per domain (UserService, AuthService, CardService)
- Services injected into routers
- Routers handle tRPC procedure setup; services handle business logic
- Database client injected as dependency

## Strict Mode Enforcement

**TypeScript Compiler Options:**
- `strict: true` — all type checking enabled
- `esModuleInterop: true` — CommonJS compatibility
- `skipLibCheck: true` — skip node_modules type checking (speed)
- `forceConsistentCasingInFileNames: true` — prevent import casing issues

**No Escape Hatches:**
- `noExplicitAny` rule enforces types everywhere
- `noUnusedVars` enforced; prefix unused params with `_`
- All new code must be strictly typed

---

*Convention analysis: 2026-03-11*
