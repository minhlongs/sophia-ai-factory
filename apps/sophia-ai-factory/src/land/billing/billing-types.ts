/**
 * Billing Types for Overage Reconciliation
 * Type definitions, pricing constants, and row mapping helpers.
 * @module land/billing/billing-types
 */

import type { Tier } from '@/seed/types';
import type {
  OverageEvent,
  OverageEventRow,
  PricingTier,
  OverageBillingConfig,
} from './overage-types';

export * from './overage-types';

/**
 * Default pricing tiers for overage billing
 * BASIC: $0.10/credit, PREMIUM: $0.05/credit, ENTERPRISE: $0.03/credit, MASTER: $0.02/credit
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
