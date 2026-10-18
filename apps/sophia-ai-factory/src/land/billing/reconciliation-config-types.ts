/**
 * Configuration and storage types for billing reconciliation.
 *
 * @module billing/reconciliation-config-types
 */

import type { ReconciliationReport } from './reconciliation-types';

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
