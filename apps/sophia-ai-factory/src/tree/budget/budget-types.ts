/**
 * @module tree/budget/budget-types
 *
 * Type definitions for the budget tracking system.
 * Extracted from budget-tracker.ts for file size management.
 *
 * Layer rule: tree — imports seed only.
 */

import { BudgetMode } from './budget-modes';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  /** Tenant identifier for D1 persistence. */
  tenantId: string;
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
