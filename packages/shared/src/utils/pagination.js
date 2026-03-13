/**
 * Build a paginated result from a Drizzle query array.
 * Assumes items are fetched with limit+1 to detect the next page.
 */
export function buildPaginatedResult(rows, limit) {
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage ? items[items.length - 1]?.id : undefined;
    return { items, nextCursor };
}
