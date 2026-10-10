/**
 * Validates and safely casts an integer cents value.
 * Disallows negative values, non-integers, and NaN.
 */
export function sanitizeCents(cents: number): number {
  if (typeof cents !== 'number' || Number.isNaN(cents) || !Number.isFinite(cents)) {
    throw new Error(`Invalid monetary amount: expected finite number, received ${cents}`);
  }
  if (cents < 0) {
    throw new Error(`Monetary amount cannot be negative: received ${cents}`);
  }
  return Math.round(cents);
}
