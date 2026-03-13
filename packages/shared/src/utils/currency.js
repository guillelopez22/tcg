/**
 * Format a price in cents to a display string.
 * e.g. 1500 -> "$15.00"
 */
export function formatCents(cents, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
    }).format(cents / 100);
}
/**
 * Convert a dollar amount (float) to integer cents.
 * e.g. 15.00 -> 1500
 */
export function dollarsToCents(dollars) {
    return Math.round(dollars * 100);
}
/**
 * Convert cents to dollars as a float.
 * e.g. 1500 -> 15.00
 */
export function centsToDollars(cents) {
    return cents / 100;
}
