export interface PaginatedResult<T> {
    items: T[];
    nextCursor: string | undefined;
}
/**
 * Build a paginated result from a Drizzle query array.
 * Assumes items are fetched with limit+1 to detect the next page.
 */
export declare function buildPaginatedResult<T extends {
    id: string;
}>(rows: T[], limit: number): PaginatedResult<T>;
