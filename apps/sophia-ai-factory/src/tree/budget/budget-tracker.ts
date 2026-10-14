/**
 * @module tree/budget/budget-tracker
 *
 * BudgetTracker — tenant-scoped budget governance with
 * estimate -> reserve -> reconcile -> refund flow.
 *
 * Layer rule: tree — imports seed only.
 */

import { logger } from '@/seed/utils/logger-utility';
import { BudgetMode } from './budget-modes';
import { BudgetExceededError, ApprovalRequiredError, KeyError } from './budget-errors';
import {
  EntryStatus,
  type BudgetEntry,
  type BudgetSnapshot,
  type BudgetTrackerOptions,
} from './budget-types';
import {
  round4,
  newBudgetEntryId,
  nowIso,
  persistBudgetEntryToD1,
} from './budget-tracker-persistence';

export { EntryStatus, type BudgetEntry, type BudgetSnapshot, type BudgetTrackerOptions } from './budget-types';
export { BudgetExceededError, ApprovalRequiredError, KeyError } from './budget-errors';

export class BudgetTracker {
  readonly budgetTotalUsd: number;
  readonly reservePct: number;
  readonly singleActionApprovalUsd: number;
  readonly requireApprovalForNewPaidTool: boolean;
  readonly mode: BudgetMode;
  readonly tenantId: string;
  private entries: BudgetEntry[] = [];
  private approvedTools = new Set<string>();

  constructor(tenantId: string, opts: Omit<BudgetTrackerOptions, 'tenantId'>) {
    this.tenantId = tenantId;
    this.budgetTotalUsd = opts.budgetTotalUsd;
    this.reservePct = opts.reservePct ?? 0.10;
    this.singleActionApprovalUsd = opts.singleActionApprovalUsd ?? 1.00;
    this.requireApprovalForNewPaidTool = opts.requireApprovalForNewPaidTool ?? true;
    this.mode = opts.mode ?? BudgetMode.WARN;
  }

  get budgetReservedUsd(): number {
    return this.entries
      .filter((e) => e.status === EntryStatus.RESERVED)
      .reduce((s, e) => s + e.reservedUsd, 0);
  }

  get budgetSpentUsd(): number {
    return this.entries
      .filter((e) => e.status === EntryStatus.COMPLETED || e.status === EntryStatus.FAILED)
      .reduce((s, e) => s + e.actualUsd, 0);
  }

  get budgetRemainingUsd(): number {
    return this.budgetTotalUsd - this.budgetSpentUsd - this.budgetReservedUsd;
  }

  get usableBudgetUsd(): number {
    return Math.max(0, this.budgetRemainingUsd - this.budgetTotalUsd * this.reservePct);
  }

  estimate(tool: string, operation: string, estimatedUsd: number): string {
    const entryId = newBudgetEntryId();
    const entry: BudgetEntry = {
      id: entryId, tenantId: this.tenantId, tool, operation,
      status: EntryStatus.ESTIMATED, estimatedUsd: round4(estimatedUsd),
      reservedUsd: 0, actualUsd: 0, timestamp: nowIso(),
    };
    this.entries.push(entry);
    persistBudgetEntryToD1(this.tenantId, entry);
    logger.info('[BudgetTracker] Estimated', { entryId, tool, operation, estimatedUsd: entry.estimatedUsd });
    return entryId;
  }

  reserve(entryId: string): void {
    const entry = this.find(entryId);
    const est = entry.estimatedUsd;

    if (est > this.singleActionApprovalUsd && this.mode !== BudgetMode.OBSERVE) {
      throw new ApprovalRequiredError(
        `Action costs $${est.toFixed(2)}, exceeds single-action threshold $${this.singleActionApprovalUsd.toFixed(2)}`,
      );
    }
    if (this.requireApprovalForNewPaidTool && est > 0 && !this.approvedTools.has(entry.tool) && this.mode !== BudgetMode.OBSERVE) {
      throw new ApprovalRequiredError(`First paid use of tool '${entry.tool}' requires approval`);
    }
    if (est > this.usableBudgetUsd) {
      if (this.mode === BudgetMode.CAP) {
        throw new BudgetExceededError(`Reservation $${est.toFixed(2)} exceeds usable budget $${this.usableBudgetUsd.toFixed(2)}`);
      }
      if (this.mode === BudgetMode.WARN) {
        logger.warn('[BudgetTracker] Budget overrun', { entryId, tool: entry.tool, usableBudgetUsd: this.usableBudgetUsd });
      }
    }

    entry.status = EntryStatus.RESERVED;
    entry.reservedUsd = est;
    entry.timestamp = nowIso();
    persistBudgetEntryToD1(this.tenantId, entry);
    logger.info('[BudgetTracker] Reserved', { entryId, tool: entry.tool, reservedUsd: entry.reservedUsd });
  }

  approveTool(tool: string): void {
    this.approvedTools.add(tool);
  }

  reconcile(entryId: string, actualUsd: number, success: boolean): void {
    const entry = this.find(entryId);
    entry.status = success ? EntryStatus.COMPLETED : EntryStatus.FAILED;
    entry.actualUsd = round4(actualUsd);
    entry.reservedUsd = 0;
    entry.timestamp = nowIso();
    persistBudgetEntryToD1(this.tenantId, entry);
    logger.info('[BudgetTracker] Reconciled', { entryId, tool: entry.tool, actualUsd: entry.actualUsd, success });
  }

  refund(entryId: string): void {
    const entry = this.find(entryId);
    entry.status = EntryStatus.REFUNDED;
    entry.reservedUsd = 0;
    entry.timestamp = nowIso();
    persistBudgetEntryToD1(this.tenantId, entry);
    logger.info('[BudgetTracker] Refunded', { entryId, tool: entry.tool, estimatedUsd: entry.estimatedUsd });
  }

  costSnapshot(): BudgetSnapshot {
    return {
      totalSpentUsd: round4(this.budgetSpentUsd),
      totalReservedUsd: round4(this.budgetReservedUsd),
      budgetRemainingUsd: round4(this.budgetRemainingUsd),
    };
  }

  private find(entryId: string): BudgetEntry {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) throw new KeyError(`Budget entry '${entryId}' not found`);
    return entry;
  }
}
