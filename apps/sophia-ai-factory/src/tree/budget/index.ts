/**
 * @module tree/budget
 *
 * Barrel export — budget governance module.
 *
 * Re-exports the public API from `budget-tracker` and `budget-modes`.
 * Layer rule: tree — imports seed only.
 */

export { BudgetMode } from './budget-modes';
export {
  BudgetTracker,
  BudgetExceededError,
  ApprovalRequiredError,
  EntryStatus,
  type BudgetEntry,
  type BudgetSnapshot,
  type BudgetTrackerOptions,
} from './budget-tracker';
