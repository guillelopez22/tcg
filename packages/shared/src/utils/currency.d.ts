/**
 * Format a price in cents to a display string.
 * e.g. 1500 -> "$15.00"
 */
export declare function formatCents(cents: number, currency?: string): string;
/**
 * Convert a dollar amount (float) to integer cents.
 * e.g. 15.00 -> 1500
 */
export declare function dollarsToCents(dollars: number): number;
/**
 * Convert cents to dollars as a float.
 * e.g. 1500 -> 15.00
 */
export declare function centsToDollars(cents: number): number;
