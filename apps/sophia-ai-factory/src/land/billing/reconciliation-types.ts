/**
 * Reconciliation Types for Phase 6 Billing Integration
 *
 * Type definitions for billing reconciliation between KV metering logs,
 * database usage events, and RaaS Gateway logs.
 *
 * @module billing/reconciliation-types
 */

export {
  type R2ReportMetadata,
  type ReconciliationConfig,
  DEFAULT_RECONCILIATION_CONFIG,
  type ReconciliationResult,
} from './reconciliation-config-types';

/**
 * Reconciliation report stored in R2
 */
export interface ReconciliationReport {
  id: string;
  timestamp: number;
  periodStart: number;
  periodEnd: number;
  // Scan results
  unbilledEventsScanned: number;
  kvMeteringLogsScanned: number;
  // Billing results
  invoicesCreated: number;
  totalAmount: number;
  currency: string;
  // Discrepancies
  discrepancies: Discrepancy[];
  // Errors
  errors: ReconciliationError[];
  // Storage
  r2StorageKey: string;
  // Metadata
  cronSchedule: string;
  workerVersion: string;
}

/**
 * Discrepancy between data sources
 */
export interface Discrepancy {
  type: DiscrepancyType;
  severity: DiscrepancySeverity;
  eventId?: string;
  licenseNonce: string;
  userId: string;
  details: {
    expected?: number;
    actual?: number;
    source?: string;
    description?: string;
  };
  timestamp: number;
}

/**
 * Types of discrepancies
 */
export type DiscrepancyType =
  | 'missing_in_kv'
  | 'missing_in_db'
  | 'credit_mismatch'
  | 'gateway_discrepancy'
  | 'invoice_creation_failed';

/**
 * Severity levels for discrepancies
 */
export type DiscrepancySeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Reconciliation error record
 */
export interface ReconciliationError {
  type: 'scanning' | 'billing' | 'storage' | 'alerting';
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  timestamp: number;
}

/**
 * Alert payload for reconciliation events
 */
export interface ReconciliationAlert {
  type: 'discrepancy_detected' | 'billing_failed' | 'report_generated';
  severity: 'critical' | 'high' | 'medium' | 'info';
  licenseNonce: string;
  userId: string;
  details: {
    discrepancyType?: DiscrepancyType;
    eventId?: string;
    expectedCredits?: number;
    actualCredits?: number;
    errorMessage?: string;
    description?: string;
  };
  timestamp: number;
  reportId?: string;
}
