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

import type { Tier } from '@/seed/types';

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

export type {
  DiscrepancyType,
  DiscrepancySeverity,
  Discrepancy,
  ReconciliationError,
  ReconciliationReport,
  ReconciliationAlert,
  R2ReportMetadata,
  ReconciliationConfig,
  ReconciliationResult,
} from './billing-reconciliation-contracts';
