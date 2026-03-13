/**
 * Escapes special characters in a user-provided string for safe use in
 * SQL LIKE / ILIKE patterns. Drizzle parameterizes the value, so this is
 * not about SQL injection — it prevents users from crafting expensive
 * wildcard patterns by treating `%`, `_`, and `\` as literals.
 */
export function escapeLike(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
