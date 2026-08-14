/**
 * Currency formatting utilities
 */

/**
 * Format cents to currency string
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Parse currency string to cents
 */
export function parseCurrencyToCents(amount: number, _currency: string = 'USD'): number {
  return Math.round(amount * 100);
}
