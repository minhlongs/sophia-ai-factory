/**
 * @module tree/budget/budget-tracker
 *
 * BudgetTracker — tenant-scoped budget governance with
 * estimate -> reserve -> reconcile -> refund flow.
 *
 * Persists state to the D1 `memory_kv` table (tenant-scoped by
 * `tenant_id` + `type = 'budget'`).  In-memory entries are the
 * source of truth for the current process; D1 is the durable store.
 *
 * Layer rule: tree — imports seed only.
 */

import { getD1Sync } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { BudgetMode } from './budget-modes';
import { BudgetExceededError, ApprovalRequiredError, KeyError } from './budget-errors';
import {
  EntryStatus,
  type BudgetEntry,
  type BudgetSnapshot,
  type BudgetTrackerOptions,
} from './budget-types';

// ── Re-exports ────────────────────────────────────────────────────────────────
export { EntryStatus, type BudgetEntry, type BudgetSnapshot, type BudgetTrackerOptions } from './budget-types';
export { BudgetExceededError, ApprovalRequiredError, KeyError } from './budget-errors';

/** Round a number to 4 decimal places. */
function round4(v: number): number { return Math.round(v * 10_000) / 10_000; }

// ── Main class ────────────────────────────────────────────────────────────────

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

  // ── Computed properties ─────────────────────────────────────────────────────

  /** Sum of `reservedUsd` across RESERVED entries. */
  get budgetReservedUsd(): number {
    return this.entries.filter((e) => e.status === EntryStatus.RESERVED)
      .reduce((s, e) => s + e.reservedUsd, 0);
  }

  /** Sum of `actualUsd` across COMPLETED + FAILED entries. */
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

  // ── Core operations ─────────────────────────────────────────────────────────

  /** Record a pre-flight cost estimate. Returns entry ID. */
  estimate(tool: string, operation: string, estimatedUsd: number): string {
    const entryId = this.newId();
    const entry: BudgetEntry = {
      id: entryId, tenantId: this.tenantId, tool, operation,
      status: EntryStatus.ESTIMATED, estimatedUsd: round4(estimatedUsd),
      reservedUsd: 0, actualUsd: 0, timestamp: this.now(),
    };
    this.entries.push(entry);
    this.persistEntry(entry);
    logger.info('[BudgetTracker] Estimated', { entryId, tool, operation, estimatedUsd: entry.estimatedUsd });
    return entryId;
  }

  /** Reserve budget for a previously estimated entry. */
  reserve(entryId: string): void {
    const entry = this.find(entryId);
    const est = entry.estimatedUsd;

    if (est > this.singleActionApprovalUsd && this.mode !== BudgetMode.OBSERVE) {
      throw new ApprovalRequiredError(
        `Action costs $${est.toFixed(2)}, exceeds single-action threshold $${this.singleActionApprovalUsd.toFixed(2)}`,
      );
    }
    if (this.requireApprovalForNewPaidTool && est > 0 && !this.approvedTools.has(entry.tool)
        && this.mode !== BudgetMode.OBSERVE) {
      throw new ApprovalRequiredError(`First paid use of tool '${entry.tool}' requires approval`);
    }
    if (est > this.usableBudgetUsd) {
      if (this.mode === BudgetMode.CAP) {
        throw new BudgetExceededError(
          `Reservation $${est.toFixed(2)} exceeds usable budget $${this.usableBudgetUsd.toFixed(2)}`,
        );
      }
      if (this.mode === BudgetMode.WARN) {
        logger.warn('[BudgetTracker] Budget overrun', { entryId, tool: entry.tool, usableBudgetUsd: this.usableBudgetUsd });
      }
    }

    entry.status = EntryStatus.RESERVED;
    entry.reservedUsd = est;
    entry.timestamp = this.now();
    this.persistEntry(entry);
    logger.info('[BudgetTracker] Reserved', { entryId, tool: entry.tool, reservedUsd: entry.reservedUsd });
  }

  /** Mark a tool as approved for paid operations. */
  approveTool(tool: string): void { this.approvedTools.add(tool); }

  /** Reconcile actual spend after tool execution completes or fails. */
  reconcile(entryId: string, actualUsd: number, success: boolean): void {
    const entry = this.find(entryId);
    entry.status = success ? EntryStatus.COMPLETED : EntryStatus.FAILED;
    entry.actualUsd = round4(actualUsd);
    entry.reservedUsd = 0;
    entry.timestamp = this.now();
    this.persistEntry(entry);
    logger.info('[BudgetTracker] Reconciled', { entryId, tool: entry.tool, actualUsd: entry.actualUsd, success });
  }

  /** Cancel a reservation without executing the operation. */
  refund(entryId: string): void {
    const entry = this.find(entryId);
    entry.status = EntryStatus.REFUNDED;
    entry.reservedUsd = 0;
    entry.timestamp = this.now();
    this.persistEntry(entry);
    logger.info('[BudgetTracker] Refunded', { entryId, tool: entry.tool, estimatedUsd: entry.estimatedUsd });
  }

  costSnapshot(): BudgetSnapshot {
    return {
      totalSpentUsd: round4(this.budgetSpentUsd),
      totalReservedUsd: round4(this.budgetReservedUsd),
      budgetRemainingUsd: round4(this.budgetRemainingUsd),
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private getDb() { try { return getD1Sync(); } catch { return null; } }

  private find(entryId: string): BudgetEntry {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) throw new KeyError(`Budget entry '${entryId}' not found`);
    return entry;
  }

  private newId(): string { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }

  private now(): string { return new Date().toISOString(); }

  private persistEntry(entry: BudgetEntry): void {
    try {
      const db = this.getDb();
      if (!db) return;
      const keyName = `entry:${entry.id}`;
      const valueJson = JSON.stringify(entry);
      const now = Date.now();
      db.prepare(
        `INSERT INTO memory_kv (id, tenant_id, type, key_name, value_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(tenant_id, type, key_name) DO UPDATE SET value_json = ?5, updated_at = ?7`,
      ).bind(crypto.randomUUID(), this.tenantId, 'budget', keyName, valueJson, now, now).run();
    } catch (err) {
      logger.error('[BudgetTracker] persistEntry failed', { entryId: entry.id, error: getErrorMessage(err) });
    }
  }
}
