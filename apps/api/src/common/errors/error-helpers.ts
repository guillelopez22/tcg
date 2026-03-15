/**
 * Type-safe PostgreSQL error utilities.
 *
 * Drizzle surfaces pg driver errors as plain objects (not class instances),
 * so we cannot use `instanceof`. We narrow by checking for the well-known
 * `code` field that the pg driver always sets on database errors.
 */

export interface PostgresError {
  code: string;
  detail?: string;
  constraint?: string;
  table?: string;
}

/**
 * Returns true when `err` is shaped like a pg driver error.
 * Safe to call with any `unknown` value thrown from Drizzle queries.
 */
export function isPostgresError(err: unknown): err is PostgresError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>)['code'] === 'string'
  );
}

/**
 * Returns true when `err` is a PostgreSQL unique constraint violation.
 * PostgreSQL error code 23505 = unique_violation.
 */
export function isUniqueConstraintError(err: unknown): boolean {
  return isPostgresError(err) && err.code === '23505';
}

/**
 * Safely extracts a human-readable message from any thrown value.
 * Never exposes internal postgres error details — callers must map those
 * to user-facing messages themselves.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred';
}
