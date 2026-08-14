/**
 * @module tree/budget/budget-errors
 *
 * Custom error classes for the budget tracking system.
 * Separated from budget-tracker.ts for file size management.
 */

/**
 * Thrown when a budget reservation would exceed the monthly cap.
 */
export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

/**
 * Thrown when a single action exceeds the approval threshold.
 * Requires explicit user approval before proceeding.
 */
export class ApprovalRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalRequiredError';
  }
}

/**
 * Keyed error for missing budget entries.
 */
export class KeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyError';
  }
}
