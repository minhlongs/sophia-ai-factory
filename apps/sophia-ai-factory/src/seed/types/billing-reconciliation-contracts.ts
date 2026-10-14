/**
 * Billing Reconciliation Contracts — Seed-layer type definitions for billing reconciliation.
 * @module seed/types/billing-reconciliation-contracts
 */

export type DiscrepancyType =
  | 'missing_in_kv'
  | 'missing_in_db'
  | 'credit_mismatch'
  | 'gateway_discrepancy'
  | 'invoice_creation_failed';

export type DiscrepancySeverity = 'critical' | 'high' | 'medium' | 'low';

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

export interface ReconciliationError {
  type: 'scanning' | 'billing' | 'storage' | 'alerting';
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  timestamp: number;
}

export interface ReconciliationReport {
  id: string;
  timestamp: number;
  periodStart: number;
  periodEnd: number;
  unbilledEventsScanned: number;
  kvMeteringLogsScanned: number;
  invoicesCreated: number;
  totalAmount: number;
  currency: string;
  discrepancies: Discrepancy[];
  errors: ReconciliationError[];
  r2StorageKey: string;
  cronSchedule: string;
  workerVersion: string;
}

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

export interface ReconciliationConfig {
  timeRangeHours: number;
  eventBatchSize: number;
  kvBatchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  r2KeyPrefix: string;
  retentionDays: number;
  emitAlerts: boolean;
  alertWebhookUrl?: string;
}

export interface ReconciliationResult {
  success: boolean;
  report: ReconciliationReport;
  alertsEmitted: number;
  retriesPerformed: number;
}
