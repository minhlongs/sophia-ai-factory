/**
 * @module tree/budget/budget-tracker
 *
 * BudgetTracker — tenant-scoped budget governance with
 * estimate → reserve → reconcile → refund flow.
 *
 * Persists state to the D1 `memory_kv` table (tenant-scoped by
 * `tenant_id` + `type = 'budget'`).  In-memory entries are the
 * source of truth for the current process; D1 is the durable store.
 *
 * Layer rule: tree — imports seed only.
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { BudgetMode } from './budget-modes';

// ── Domain types ──────────────────────────────────────────────────────────────

/** Status of a single budget entry through its lifecycle. */
export enum EntryStatus {
  ESTIMATED = 'estimated',
  RESERVED = 'reserved',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/** Shape of a budget entry as stored in D1. */
export interface BudgetEntry {
  id: string;
  tenantId: string;
  tool: string;
  operation: string;
  status: EntryStatus;
  estimatedUsd: number;
  reservedUsd: number;
  actualUsd: number;
  timestamp: string;
}

/** Snapshot of budget totals returned by `costSnapshot()`. */
export interface BudgetSnapshot {
  totalSpentUsd: number;
  totalReservedUsd: number;
  budgetRemainingUsd: number;
}

/** Options accepted by the BudgetTracker constructor. */
export interface BudgetTrackerOptions {
  /** Total budget ceiling in USD. */
  budgetTotalUsd: number;
  /** Fraction of total held back as reserve buffer (default 0.10 = 10 %). */
  reservePct?: number;
  /** Single-action USD threshold that triggers ApprovalRequiredError. */
  singleActionApprovalUsd?: number;
  /** When true, first paid use of any tool requires `approveTool()` first. */
  requireApprovalForNewPaidTool?: boolean;
  /** Enforcement policy (default WARN). */
  mode?: BudgetMode;
}

// ── Custom errors ─────────────────────────────────────────────────────────────

/** Raised when a reservation would exceed usable budget in CAP mode. */
export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

/** Raised when an action needs explicit approval before proceeding. */
export class ApprovalRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalRequiredError';
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** D1 `type` discriminator for budget rows in `memory_kv`. */
const BUDGET_KV_TYPE = 'budget';

// ── BudgetTracker ─────────────────────────────────────────────────────────────

/**
 * Tracks estimated, reserved, and actual costs per tenant.
 *
 * Budget lifecycle:
 *   1. `estimate()`  — record a pre-flight cost estimate, returns entryId
 *   2. `reserve()`   — lock the estimated amount (may throw)
 *   3. `reconcile()` — record actual spend, clear reservation
 *   4. `refund()`    — cancel a reservation without execution
 *
 * All mutating methods persist to D1 after the in-memory update.
 */
export class BudgetTracker {
  // ── Config ────────────────────────────────────────────────────────────────

  readonly budgetTotalUsd: number;
  readonly reservePct: number;
  readonly singleActionApprovalUsd: number;
  readonly requireApprovalForNewPaidTool: boolean;
  readonly mode: BudgetMode;
  readonly tenantId: string;

  // ── State ─────────────────────────────────────────────────────────────────

  private entries: BudgetEntry[] = [];
  private approvedTools: Set<string> = new Set();

  // ── D1 accessor (lazy, per-operation) ─────────────────────────────────────

  private getDb: () => ReturnType<typeof getD1> = getD1;

  // ── Constructor ───────────────────────────────────────────────────────────

  /**
   * Create a BudgetTracker for a specific tenant.
   *
   * @param tenantId — unique org/account identifier (used for D1 scoping)
   * @param opts — budget configuration
   */
  constructor(tenantId: string, opts: BudgetTrackerOptions) {
    this.tenantId = tenantId;
    this.budgetTotalUsd = opts.budgetTotalUsd;
    this.reservePct = opts.reservePct ?? 0.1;
    this.singleActionApprovalUsd = opts.singleActionApprovalUsd ?? 0.5;
    this.requireApprovalForNewPaidTool = opts.requireApprovalForNewPaidTool ?? true;
    this.mode = opts.mode ?? BudgetMode.WARN;
  }

  // ── Computed budget properties ────────────────────────────────────────────

  /** Sum of `reservedUsd` across all RESERVED entries. */
  get budgetReservedUsd(): number {
    return this.entries
      .filter((e) => e.status === EntryStatus.RESERVED)
      .reduce((sum, e) => sum + e.reservedUsd, 0);
  }

  /** Sum of `actualUsd` across COMPLETED + FAILED entries. */
  get budgetSpentUsd(): number {
    return this.entries
      .filter((e) => e.status === EntryStatus.COMPLETED || e.status === EntryStatus.FAILED)
      .reduce((sum, e) => sum + e.actualUsd, 0);
  }

  /** Total minus spent minus reserved. */
  get budgetRemainingUsd(): number {
    return this.budgetTotalUsd - this.budgetSpentUsd - this.budgetReservedUsd;
  }

  /** Remaining minus the reserve holdback buffer. */
  get usableBudgetUsd(): number {
    const holdback = this.budgetTotalUsd * this.reservePct;
    return Math.max(0, this.budgetRemainingUsd - holdback);
  }

  // ── Core operations ───────────────────────────────────────────────────────

  /**
   * Record a pre-flight cost estimate.
   *
   * @param tool — tool identifier (e.g. `openrouter`, `elevenlabs`)
   * @param operation — operation name (e.g. `chat`, `tts`)
   * @param estimatedUsd — estimated cost in USD
   * @returns entry ID for subsequent reserve/reconcile/refund calls
   */
  estimate(tool: string, operation: string, estimatedUsd: number): string {
    const entryId = this.newId();
    const entry: BudgetEntry = {
      id: entryId,
      tenantId: this.tenantId,
      tool,
      operation,
      status: EntryStatus.ESTIMATED,
      estimatedUsd: round4(estimatedUsd),
      reservedUsd: 0,
      actualUsd: 0,
      timestamp: this.now(),
    };
    this.entries.push(entry);
    this.persistEntry(entry);
    logger.info('[BudgetTracker] Estimated', {
      entryId,
      tool,
      operation,
      estimatedUsd: entry.estimatedUsd,
      tenantId: this.tenantId,
    });
    return entryId;
  }

  /**
   * Reserve budget for a previously estimated entry.
   *
   * Throws `BudgetExceededError` in CAP mode when the reservation
   * would exceed usable budget.  Throws `ApprovalRequiredError` when
   * the action exceeds the single-action threshold or when a new paid
   * tool needs explicit approval.
   *
   * @param entryId — ID returned by `estimate()`
   * @throws {BudgetExceededError} in CAP mode on overrun
   * @throws {ApprovalRequiredError} when approval is required
   */
  reserve(entryId: string): void {
    const entry = this.find(entryId);
    const estimated = entry.estimatedUsd;

    // ── Single-action approval threshold ───────────────────────────────────
    if (estimated > this.singleActionApprovalUsd) {
      if (this.mode !== BudgetMode.OBSERVE) {
        throw new ApprovalRequiredError(
          `Action costs $${estimated.toFixed(2)}, exceeds ` +
            `single-action threshold $${this.singleActionApprovalUsd.toFixed(2)}`,
        );
      }
    }

    // ── New paid tool approval ──────────────────────────────────────────────
    if (this.requireApprovalForNewPaidTool && estimated > 0) {
      if (!this.approvedTools.has(entry.tool)) {
        if (this.mode !== BudgetMode.OBSERVE) {
          throw new ApprovalRequiredError(
            `First paid use of tool '${entry.tool}' requires approval`,
          );
        }
      }
    }

    // ── Budget ceiling check ────────────────────────────────────────────────
    if (estimated > this.usableBudgetUsd) {
      if (this.mode === BudgetMode.CAP) {
        throw new BudgetExceededError(
          `Reservation of $${estimated.toFixed(2)} exceeds usable budget ` +
            `$${this.usableBudgetUsd.toFixed(2)}`,
        );
      }
      if (this.mode === BudgetMode.WARN) {
        logger.warn('[BudgetTracker] Budget overrun (WARN mode)', {
          entryId,
          tool: entry.tool,
          estimatedUsd: estimated,
          usableBudgetUsd: this.usableBudgetUsd,
          tenantId: this.tenantId,
        });
      }
    }

    // ── Apply reservation ───────────────────────────────────────────────────
    entry.status = EntryStatus.RESERVED;
    entry.reservedUsd = estimated;
    entry.timestamp = this.now();
    this.persistEntry(entry);

    logger.info('[BudgetTracker] Reserved', {
      entryId,
      tool: entry.tool,
      operation: entry.operation,
      reservedUsd: entry.reservedUsd,
      usableBudgetUsd: this.usableBudgetUsd,
      tenantId: this.tenantId,
    });
  }

  /**
   * Mark a tool as approved for paid operations.
   *
   * Call this after the user approves a new paid tool via UI/webhook.
   *
   * @param tool — tool identifier to approve
   */
  approveTool(tool: string): void {
    this.approvedTools.add(tool);
    logger.info('[BudgetTracker] Tool approved', { tool, tenantId: this.tenantId });
  }

  /**
   * Reconcile actual spend after tool execution completes or fails.
   *
   * Clears the reservation and records the actual cost.  Status becomes
   * COMPLETED on success or FAILED on failure.
   *
   * @param entryId — ID from `estimate()`
   * @param actualUsd — actual cost incurred in USD
   * @param success — whether the operation completed successfully
   */
  reconcile(entryId: string, actualUsd: number, success: boolean): void {
    const entry = this.find(entryId);
    entry.status = success ? EntryStatus.COMPLETED : EntryStatus.FAILED;
    entry.actualUsd = round4(actualUsd);
    entry.reservedUsd = 0;
    entry.timestamp = this.now();
    this.persistEntry(entry);

    logger.info('[BudgetTracker] Reconciled', {
      entryId,
      tool: entry.tool,
      operation: entry.operation,
      actualUsd: entry.actualUsd,
      success,
      budgetSpentUsd: this.budgetSpentUsd,
      tenantId: this.tenantId,
    });
  }

  /**
   * Cancel a reservation without executing the operation.
   *
   * Releases the reserved amount back to usable budget.
   *
   * @param entryId — ID from `estimate()`
   */
  refund(entryId: string): void {
    const entry = this.find(entryId);
    entry.status = EntryStatus.REFUNDED;
    entry.reservedUsd = 0;
    entry.timestamp = this.now();
    this.persistEntry(entry);

    logger.info('[BudgetTracker] Refunded', {
      entryId,
      tool: entry.tool,
      operation: entry.operation,
      estimatedUsd: entry.estimatedUsd,
      tenantId: this.tenantId,
    });
  }

  // ── Observability ─────────────────────────────────────────────────────────

  /**
   * Return a point-in-time budget snapshot.
   */
  costSnapshot(): BudgetSnapshot {
    return {
      totalSpentUsd: round4(this.budgetSpentUsd),
      totalReservedUsd: round4(this.budgetReservedUsd),
      budgetRemainingUsd: round4(this.budgetRemainingUsd),
    };
  }

  // ── D1 persistence ────────────────────────────────────────────────────────

  /**
   * Load persisted budget entries from D1 for this tenant.
   *
   * Safe to call multiple times — duplicates are deduplicated by ID.
   */
  async loadFromD1(): Promise<void> {
    try {
      const db = this.getDb();
      if (!db) {
        logger.warn('[BudgetTracker] D1 unavailable — skipping load');
        return;
      }

      const result = await db
        .prepare(
          `SELECT id, tenant_id, type, key_name, value_json
           FROM memory_kv
           WHERE tenant_id = ?1 AND type = ?2`,
        )
        .bind(this.tenantId, BUDGET_KV_TYPE)
        .all<{
          id: string;
          tenant_id: string;
          type: string;
          key_name: string;
          value_json: string;
        }>();

      const rows = result.results ?? [];
      const seen = new Set(this.entries.map((e) => e.id));
      let loaded = 0;

      for (const row of rows) {
        try {
          const entry = JSON.parse(row.value_json) as BudgetEntry;
          // Validate shape before accepting
          if (entry.id && entry.tool && entry.status) {
            if (!seen.has(entry.id)) {
              this.entries.push(entry);
              seen.add(entry.id);
              loaded++;
            }
          }
        } catch {
          logger.warn('[BudgetTracker] Skipping corrupt D1 row', { rowId: row.id });
        }
      }

      logger.info('[BudgetTracker] Loaded from D1', {
        tenantId: this.tenantId,
        entriesLoaded: loaded,
        totalEntries: this.entries.length,
      });
    } catch (err) {
      logger.error('[BudgetTracker] loadFromD1 failed', {
        tenantId: this.tenantId,
        error: getErrorMessage(err),
      });
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /** Find an entry by ID or throw KeyError. */
  private find(entryId: string): BudgetEntry {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) {
      throw new KeyError(`Budget entry '${entryId}' not found`);
    }
    return entry;
  }

  /** Generate a short unique ID (12 hex chars). */
  private newId(): string {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }

  /** UTC ISO-8601 timestamp. */
  private now(): string {
    return new Date().toISOString();
  }

  /**
   * Upsert a single entry into D1 `memory_kv`.
   *
   * Key: `entry:{entryId}` — allows direct lookup by entry ID.
   */
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
         ON CONFLICT(tenant_id, type, key_name) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at`,
      )
        .bind(
          `${this.tenantId}:${BUDGET_KV_TYPE}:${keyName}`,
          this.tenantId,
          BUDGET_KV_TYPE,
          keyName,
          valueJson,
          now,
          now,
        )
        .run();
    } catch (err) {
      logger.error('[BudgetTracker] persistEntry failed', {
        entryId: entry.id,
        tenantId: this.tenantId,
        error: getErrorMessage(err),
      });
    }
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Round a number to 4 decimal places. */
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Keyed error for missing budget entries. */
class KeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyError';
  }
}
