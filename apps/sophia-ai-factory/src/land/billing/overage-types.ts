/**
 * Overage billing and reconciliation interfaces.
 * @module land/billing/overage-types
 */

import type { Tier } from '@/seed/types';

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

export interface PricingTier {
  tier: Tier;
  pricePerCredit: number;
  currency: string;
}

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

export interface ReconciliationError {
  type: 'scanning' | 'calculation' | 'stripe' | 'database' | 'billing';
  message: string;
  details?: unknown;
  retryable: boolean;
}

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

export interface OverageBillingConfig {
  enableOverageBilling: boolean;
  autoCreateInvoiceItems: boolean;
  maxRetryAttempts: number;
  retryDelayMs: number;
}
