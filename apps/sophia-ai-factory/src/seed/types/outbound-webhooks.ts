/**
 * Enterprise Outbound Webhooks & Event Bus — Seed Type Definitions
 *
 * Defines the foundational data models, database row contracts, and DTOs
 * for webhook endpoint subscriptions, event delivery records, and retry states.
 *
 * Layer: seed/types (Foundational primitives)
 * Dependencies: None (zero internal framework dependencies)
 *
 * @module seed/types/outbound-webhooks
 */

export type WebhookEndpointStatus = 'active' | 'disabled';

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'dead_letter';

export type StandardWebhookEvent =
  | 'video.rendered'
  | 'campaign.completed'
  | 'commission.earned'
  | 'payout.processed';

export type WebhookEventType = StandardWebhookEvent | '*' | (string & {});

/**
 * Parsed domain representation of a customer webhook endpoint subscription.
 */
export interface WebhookEndpoint {
  id: string;
  org_id: string;
  url: string;
  secret: string;
  description: string;
  events: string[];
  status: WebhookEndpointStatus;
  created_at: number;
  updated_at: number;
}

/**
 * Raw SQLite/D1 database row for webhook_endpoints table.
 */
export interface WebhookEndpointRow {
  id: string;
  org_id: string;
  url: string;
  secret: string;
  description: string;
  events: string; // JSON serialized string array, e.g. "[\"video.rendered\"]"
  status: string;
  created_at: number;
  updated_at: number;
}

/**
 * Parsed domain representation of an outbound webhook delivery attempt.
 */
export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  org_id: string;
  event: string;
  payload: string; // JSON string
  status: WebhookDeliveryStatus;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: number;
  response_code?: number | null;
  error_message?: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Raw SQLite/D1 database row for webhook_deliveries table.
 */
export interface WebhookDeliveryRow {
  id: string;
  endpoint_id: string;
  org_id: string;
  event: string;
  payload: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: number;
  response_code: number | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateWebhookEndpointInput {
  url: string;
  secret?: string;
  description?: string;
  events: string[];
}

export interface UpdateWebhookEndpointInput {
  url?: string;
  secret?: string;
  description?: string;
  events?: string[];
  status?: WebhookEndpointStatus;
}

export interface ListWebhookEndpointsOptions {
  status?: WebhookEndpointStatus;
  limit?: number;
  offset?: number;
}

export interface ListWebhookDeliveriesOptions {
  endpointId?: string;
  status?: WebhookDeliveryStatus;
  limit?: number;
  offset?: number;
}

export type WebhookErrorCode =
  | 'INVALID_WEBHOOK_URL'
  | 'EVENT_NOT_SUBSCRIBED'
  | 'DELIVERY_NOT_FOUND'
  | 'ENDPOINT_NOT_FOUND'
  | 'CROSS_TENANT_VIOLATION'
  | 'INVALID_SIGNATURE'
  | 'SIGNATURE_EXPIRED'
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'DB_UNAVAILABLE'
  | 'UNAUTHORIZED';

export interface WebhookError {
  code: WebhookErrorCode;
  message: string;
  details?: unknown;
}

export interface WebhookDispatchResult {
  deliveryId: string;
  status: WebhookDeliveryStatus;
  responseCode: number;
  attemptCount: number;
  nextAttemptAt?: number;
  errorMessage?: string | null;
}

export const DEFAULT_MAX_DELIVERY_ATTEMPTS = 5;
export const SIGNATURE_TOLERANCE_SECONDS = 300;
export const WEBHOOK_SECRET_PREFIX = 'whsec_';
export const WEBHOOK_ENDPOINT_ID_PREFIX = 'wep_';
export const WEBHOOK_DELIVERY_ID_PREFIX = 'del_';
export const BACKOFF_SCHEDULE_SECONDS = [30, 120, 600, 3600, 21600] as const;
