/**
 * Partner Webhook Event Bus Types & Constants
 *
 * Layer: tree (domain business logic & event schemas)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/webhook-bus/types
 */

import type { D1Database } from '@/seed/db/client';

export type PartnerWebhookEventType =
  | 'partner.client.quota_low'
  | 'partner.client.quota_depleted'
  | 'partner.client.milestone_reached'
  | 'partner.client.topup_completed'
  | 'partner.client.churn_risk';

export const PARTNER_WEBHOOK_EVENTS: readonly PartnerWebhookEventType[] = [
  'partner.client.quota_low',
  'partner.client.quota_depleted',
  'partner.client.milestone_reached',
  'partner.client.topup_completed',
  'partner.client.churn_risk',
] as const;

export const SIGNATURE_HEADER_NAME = 'X-Sophia-Signature-256';
export const DEFAULT_TOLERANCE_SECONDS = 300; // 5 minutes
export const MAX_DELIVERY_ATTEMPTS = 5;

/**
 * 5-stage base delays in milliseconds:
 * Attempt 1: 0ms (immediate)
 * Attempt 2: 30,000ms (30 seconds)
 * Attempt 3: 120,000ms (2 minutes)
 * Attempt 4: 600,000ms (10 minutes)
 * Attempt 5: 3,600,000ms (1 hour)
 */
export const BACKOFF_BASE_DELAYS_MS: readonly number[] = [
  0,
  30_000,
  120_000,
  600_000,
  3_600_000,
] as const;

export interface WebhookSignatureHeader {
  timestamp: number;
  signature: string;
}

export interface WebhookVerificationResult {
  valid: boolean;
  timestamp?: number;
  reason?: string;
  error?: string;
}

export interface DispatchPartnerWebhookOptions {
  db?: D1Database;
  endpointUrl?: string;
  secretKey?: string;
  fetchFn?: typeof fetch;
  maxAttempts?: number;
  simulateFailureForAttempts?: number;
}

export interface PartnerWebhookDeliveryResult {
  eventId: string;
  partnerId: string;
  eventType: PartnerWebhookEventType;
  delivered: boolean;
  httpStatus?: number;
  attempts: number;
  lastError?: string;
  signatureHeader?: string;
  nextRetryDelayMs?: number;
  deliveryLogId?: string;
}

export type WebhookSignatureInput =
  | string
  | { headerValue: string }
  | { signature: string; timestamp?: number };
