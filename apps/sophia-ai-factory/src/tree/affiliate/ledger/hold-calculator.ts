/**
 * Anti-Fraud Hold Timing Calculations
 *
 * @module tree/affiliate/ledger/hold-calculator
 */

/**
 * Calculates exact millisecond timestamp when 14-day anti-fraud hold matures.
 */
export function calculatePayableAt(attributedAtMs: number, holdDays = 14): number {
  return attributedAtMs + holdDays * 86400 * 1000;
}
