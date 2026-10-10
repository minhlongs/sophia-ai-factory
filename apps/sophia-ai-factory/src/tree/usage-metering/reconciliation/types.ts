/**
 * Usage Reconciliation Types & Constants
 *
 * @module tree/usage-metering/reconciliation/types
 */

export const HANDLER_COUNTER_PREFIX = 'usage:handler:counter:';

export const HANDLER_COUNTER_TTL_SECONDS = 25 * 3600;

export const DEFAULT_DISCREPANCY_THRESHOLD = 0.25;

export interface ReconciliationResult {
  /** Tenant ID checked */
  tenantId: string;
  /** UTC date window checked (YYYYMMDD) */
  window: string;
  /** Handler invocations recorded in KV */
  handlerInvocations: number;
  /** Rows in usage_events for this tenant + window */
  usageEventCount: number;
  /** Ratio: 1 - (min/max). 0 = perfect match */
  discrepancyRatio: number;
  /** Whether discrepancy exceeds threshold */
  alert: boolean;
  /** Human-readable explanation */
  message: string;
}

export interface ReconcileOptions {
  /** Discrepancy ratio threshold (0–1). Default: 0.25 (25%) */
  threshold?: number;
  /** UTC date window to check (YYYYMMDD). Default: today */
  window?: string;
  /** Specific tenant IDs to check. Default: all with KV counter keys */
  tenantIds?: string[];
}
