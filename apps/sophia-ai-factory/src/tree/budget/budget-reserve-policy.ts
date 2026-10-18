/**
 * @module tree/budget/budget-reserve-policy
 *
 * Reservation policy enforcement for BudgetTracker.
 * Layer rule: tree — imports seed only.
 */

import { logger } from '@/seed/utils/logger-utility';
import { BudgetMode } from './budget-modes';
import { BudgetExceededError, ApprovalRequiredError } from './budget-errors';
import type { BudgetEntry } from './budget-types';

export interface ReservePolicyContext {
  readonly entry: BudgetEntry;
  readonly singleActionApprovalUsd: number;
  readonly requireApprovalForNewPaidTool: boolean;
  readonly approvedTools: ReadonlySet<string>;
  readonly usableBudgetUsd: number;
  readonly mode: BudgetMode;
}

export function enforceReservePolicy(ctx: ReservePolicyContext): void {
  const {
    entry,
    singleActionApprovalUsd,
    requireApprovalForNewPaidTool,
    approvedTools,
    usableBudgetUsd,
    mode,
  } = ctx;
  const est = entry.estimatedUsd;

  if (est > singleActionApprovalUsd && mode !== BudgetMode.OBSERVE) {
    throw new ApprovalRequiredError(
      `Action costs $${est.toFixed(2)}, exceeds single-action threshold $${singleActionApprovalUsd.toFixed(2)}`,
    );
  }
  if (
    requireApprovalForNewPaidTool &&
    est > 0 &&
    !approvedTools.has(entry.tool) &&
    mode !== BudgetMode.OBSERVE
  ) {
    throw new ApprovalRequiredError(`First paid use of tool '${entry.tool}' requires approval`);
  }
  if (est > usableBudgetUsd) {
    if (mode === BudgetMode.CAP) {
      throw new BudgetExceededError(
        `Reservation $${est.toFixed(2)} exceeds usable budget $${usableBudgetUsd.toFixed(2)}`,
      );
    }
    if (mode === BudgetMode.WARN) {
      logger.warn('[BudgetTracker] Budget overrun', {
        entryId: entry.id,
        tool: entry.tool,
        usableBudgetUsd,
      });
    }
  }
}
