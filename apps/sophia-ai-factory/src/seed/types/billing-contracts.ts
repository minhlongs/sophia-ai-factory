/**
 * Billing Contracts — Seed-layer type hub for billing/payment domain.
 *
 * Contains pure type definitions shared between forest and land layers.
 * NO runtime values, NO logic, NO imports from forest/ or land/ layers.
 *
 * These types are defined here (not re-exported from land) so that
 * forest-layer modules can import them without a forest→land import violation.
 * Land-layer billing files should eventually import FROM here (Phase 07).
 *
 * @module seed/types/billing-contracts
 */

import type { Tier } from '@/types';

// ── Overage event types ───────────────────────────────────────────────────────

export interface OverageEvent {
  id: string;
  userId: string;
  licenseNonce: string;
  exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  exceededLimit: number;
  exceededCurrent: number;
  exceededBy: number;
  requestedCredits: number;
  endpoint?: string;
  serviceName?: string;
  action?: string;
  tierAtExceeded: Tier;
  externalCustomerId?: string;
  billable: boolean;
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
}

export interface OverageEventRow {
  id: string;
  user_id: string;
  license_nonce: string;
  exceeded_type: string;
  exceeded_limit: number;
  exceeded_current: number;
  exceeded_by: number;
  requested_credits: number;
  endpoint: string | null;
  service_name: string | null;
  action: string | null;
  tier_at_exceeded: string;
  external_customer_id: string | null;
  billable: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
}

// ── Dunning workflow types ────────────────────────────────────────────────────

export type DunningState = 'current' | 'past_due' | 'delinquent' | 'suspended';

export type DunningEventType =
  | 'payment_failed'
  | 'payment_succeeded'
  | 'grace_period_expired'
  | 'manual_suspend'
  | 'manual_restore';

// ── IPN payload type ──────────────────────────────────────────────────────────

export type IpnPaymentStatus =
  | 'waiting'
  | 'confirming'
  | 'confirmed'
  | 'sending'
  | 'partially_paid'
  | 'finished'
  | 'failed'
  | 'refunded'
  | 'expired';

export interface IpnPayload {
  payment_id: string;
  payment_status: IpnPaymentStatus;
  pay_address?: string;
  price_amount: number;
  price_currency: string;
  pay_amount?: number;
  pay_currency?: string;
  order_id?: string;
  order_description?: string;
  invoice_id?: string;
  actually_paid?: number;
  outcome_amount?: number;
  outcome_currency?: string;
  customer_email?: string;
}

// ── Reconciliation types ──────────────────────────────────────────────────────

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
