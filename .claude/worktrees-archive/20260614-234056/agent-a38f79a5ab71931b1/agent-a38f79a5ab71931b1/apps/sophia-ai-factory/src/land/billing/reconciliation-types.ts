/**
 * Reconciliation Types for Phase 6 Billing Integration
 *
 * Type definitions for billing reconciliation between KV metering logs,
 * database usage events, and RaaS Gateway logs.
 *
 * @module billing/reconciliation-types
 */

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

/**
 * R2 report metadata for listing
 */
export interface R2ReportMetadata {
  key: string;
  uploaded: Date;
  size: number;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  customMetadata?: {
    reportType?: string;
    periodStart?: string;
    periodEnd?: string;
    totalAmount?: string;
  };
}

/**
 * Configuration for reconciliation runner
 */
export interface ReconciliationConfig {
  // Time range
  timeRangeHours: number;
  // Batch sizes
  eventBatchSize: number;
  kvBatchSize: number;
  // Retry
  maxRetries: number;
  retryDelayMs: number;
  // Storage
  r2KeyPrefix: string;
  retentionDays: number;
  // Alerting
  emitAlerts: boolean;
  alertWebhookUrl?: string;
}

/**
 * Default reconciliation configuration
 */
export const DEFAULT_RECONCILIATION_CONFIG: ReconciliationConfig = {
  timeRangeHours: 24, // Sync last 24 hours
  eventBatchSize: 100,
  kvBatchSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
  r2KeyPrefix: 'reports/reconciliation-',
  retentionDays: 90,
  emitAlerts: true,
};

/**
 * Result from reconciliation runner
 */
export interface ReconciliationResult {
  success: boolean;
  report: ReconciliationReport;
  alertsEmitted: number;
  retriesPerformed: number;
}
