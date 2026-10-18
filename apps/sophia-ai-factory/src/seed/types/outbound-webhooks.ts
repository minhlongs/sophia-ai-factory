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

import type {
  WebhookEndpointStatus,
  WebhookDeliveryStatus,
} from './outbound-webhooks-dtos';

export type {
  WebhookEndpointStatus,
  WebhookDeliveryStatus,
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
  ListWebhookEndpointsOptions,
  ListWebhookDeliveriesOptions,
  WebhookErrorCode,
  WebhookError,
  WebhookDispatchResult,
} from './outbound-webhooks-dtos';

export {
  DEFAULT_MAX_DELIVERY_ATTEMPTS,
  SIGNATURE_TOLERANCE_SECONDS,
  WEBHOOK_SECRET_PREFIX,
  WEBHOOK_ENDPOINT_ID_PREFIX,
  WEBHOOK_DELIVERY_ID_PREFIX,
  BACKOFF_SCHEDULE_SECONDS,
} from './outbound-webhooks-dtos';

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
