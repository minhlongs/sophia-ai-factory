/**
 * @module tree/budget/budget-modes
 *
 * BudgetMode — enforcement policy for budget governance.
 *
 * | Mode     | Behaviour                                              |
 * |----------|--------------------------------------------------------|
 * | WARN     | Log overruns but never block execution                 |
 * | CAP      | Block execution when budget would be exceeded          |
 * | OBSERVE  | No enforcement at all — purely informational           |
 */

/**
 * Enforcement policy applied when a budget check fails.
 */
export enum BudgetMode {
  /** Log warnings on overrun; never block execution. */
  WARN = 'WARN',
  /** Block execution when the reservation would exceed usable budget. */
  CAP = 'CAP',
  /** No enforcement — record events for observability only. */
  OBSERVE = 'OBSERVE',
}
