/**
 * Billing Types for Overage Reconciliation
 *
 * Type definitions for overage billing, Stripe integration,
 * Polar.sh metered billing, and quota exceeded event reconciliation
 */

import type { Tier } from '@/types';

/**
 * Overage event from database
 */
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

/**
 * Overage event database row
 */
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

/**
 * Pricing tier configuration
 */
export interface PricingTier {
  tier: Tier;
  pricePerCredit: number;
  currency: string;
}

/**
 * Overage charge calculation
 */
export interface OverageCharge {
  userId: string;
  licenseNonce: string;
  tier: Tier;
  overageCredits: number;
  pricePerCredit: number;
  totalCharge: number;
  currency: string;
  eventCount: number;
  periodStart: number;
  periodEnd: number;
  externalCustomerId?: string;
}

/**
 * Stripe invoice item for overage charge
 */
export interface StripeInvoiceItem {
  customer: string;
  price_data: {
    currency: string;
    product_data: {
      name: string;
      description: string;
      metadata: {
        license_nonce: string;
        tier: string;
        period_start: string;
        period_end: string;
      };
    };
    unit_amount: number;
    recurring?: {
      interval: 'month' | 'year';
    };
  };
  quantity: number;
  metadata: {
    license_nonce: string;
    overage_credits: string;
    period_start: string;
    period_end: string;
    event_count: string;
  };
  idempotency_key: string;
}

/**
 * Reconciliation result
 */
export interface ReconciliationResult {
  success: boolean;
  scannedEvents: number;
  unbilledEvents: number;
  billableEvents: number;
  totalOverageCredits: number;
  totalCharge: number;
  currency: string;
  charges: OverageCharge[];
  invoiceItemsCreated: number;
  eventsMarkedAsBilled: number;
  errors: ReconciliationError[];
}

/**
 * Reconciliation error
 */
export interface ReconciliationError {
  type: 'scanning' | 'calculation' | 'stripe' | 'database' | 'billing';
  message: string;
  details?: unknown;
  retryable: boolean;
}

/**
 * Unbilled overage events grouped by user
 */
export interface UnbilledEventsByUser {
  userId: string;
  licenseNonce: string;
  tier: Tier;
  externalCustomerId?: string;
  events: OverageEvent[];
  totalOverageCredits: number;
  periodStart: number;
  periodEnd: number;
}

/**
 * Configuration for overage billing
 */
export interface OverageBillingConfig {
  enableOverageBilling: boolean;
  autoCreateInvoiceItems: boolean;
  maxRetryAttempts: number;
  retryDelayMs: number;
}

/**
 * Default pricing tiers for overage billing
 * BASIC: $0.10/credit, PREMIUM: $0.05/credit, ENTERPRISE: $0.03/credit
 */
export const PRICING_TIERS: Record<Tier, PricingTier> = {
  BASIC: {
    tier: 'BASIC',
    pricePerCredit: 0.1,
    currency: 'USD',
  },
  PREMIUM: {
    tier: 'PREMIUM',
    pricePerCredit: 0.05,
    currency: 'USD',
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    pricePerCredit: 0.03,
    currency: 'USD',
  },
  MASTER: {
    tier: 'MASTER',
    pricePerCredit: 0.02,
    currency: 'USD',
  },
};

/**
 * Default configuration
 */
export const DEFAULT_OVERAGE_BILLING_CONFIG: OverageBillingConfig = {
  enableOverageBilling: true,
  autoCreateInvoiceItems: true,
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
};

/**
 * Map database row to OverageEvent
 */
export function mapOverageEventRow(row: OverageEventRow): OverageEvent {
  return {
    id: row.id,
    userId: row.user_id,
    licenseNonce: row.license_nonce,
    exceededType: row.exceeded_type as OverageEvent['exceededType'],
    exceededLimit: row.exceeded_limit,
    exceededCurrent: row.exceeded_current,
    exceededBy: row.exceeded_by,
    requestedCredits: row.requested_credits,
    endpoint: row.endpoint ?? undefined,
    serviceName: row.service_name ?? undefined,
    action: row.action ?? undefined,
    tierAtExceeded: row.tier_at_exceeded as Tier,
    externalCustomerId: row.external_customer_id ?? undefined,
    billable: row.billable,
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Generate idempotency key for Stripe invoice item
 */
export function generateIdempotencyKey(
  licenseNonce: string,
  periodStart: number,
  periodEnd: number
): string {
  return `overage-${licenseNonce}-${periodStart}-${periodEnd}`;
}

/**
 * Polar.sh billing types for metered usage
 */
export interface PolarBillingConfig {
  enabled: boolean;
  meterSlugCredits: string;
  meterSlugRequests: string;
  syncEnabled: boolean;
}

/**
 * Polar usage record for syncing
 */
export interface PolarUsageRecord {
  customerId: string;
  meterSlug: string;
  quantity: number;
  timestamp: number;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

/**
 * Polar billing sync result
 */
export interface PolarBillingResult {
  success: boolean;
  recordsSynced: number;
  recordsFailed: number;
  errors: string[];
}

/**
 * Polar invoice item for one-time charges
 */
export interface PolarInvoiceItem {
  customerId: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}

/**
 * Default Polar billing configuration
 */
export const DEFAULT_POLAR_BILLING_CONFIG: PolarBillingConfig = {
  enabled: process.env.POLAR_ACCESS_TOKEN ? true : false,
  meterSlugCredits: 'api_credits',
  meterSlugRequests: 'api_requests',
  syncEnabled: true,
};
