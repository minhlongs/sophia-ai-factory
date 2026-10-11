/**
 * Determine if an error is permanent (non-recoverable) vs transient.
 * Transient errors (network, timeout) should NOT go to DLQ — NOWPayments
 * will retry automatically. Permanent errors need manual intervention.
 * @module land/billing/ipn-handlers/error-classification
 */

export function isPermanentFailure(err: Error): boolean {
  const permanentPatterns = [
    /UNIQUE constraint/i,
    /NOT NULL constraint/i,
    /FOREIGN KEY constraint/i,
    /no such table/i,
    /schema mismatch/i,
    /invalid payload/i,
    /validation/i,
    /zod/i,
    /no such column/i,
    /datatype mismatch/i,
  ];
  return permanentPatterns.some((pattern) => pattern.test(err.message));
}
