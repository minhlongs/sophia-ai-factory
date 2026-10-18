/**
 * Enterprise Outbound Webhooks — DTOs, Errors, and Constants
 *
 * Layer: seed/types (Foundational primitives)
 */

export type WebhookEndpointStatus = 'active' | 'disabled';

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'dead_letter';

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
