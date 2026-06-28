/**
 * Shared types for Sophia outbound webhook system.
 * @module lib/webhooks/types
 */

/** All supported event names for webhook subscriptions */
export type WebhookEvent =
  | 'mission.completed'
  | 'video.ready'
  | 'payment.received'
  | 'error.threshold'
  | 'affiliate.discovered'
  | 'webhook.test';

/** Webhook endpoint record as stored in D1 */
export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  url: string;
  /** HMAC secret — returned ONLY on create, never again */
  secret?: string;
  /** JSON-serialized array of WebhookEvent names */
  events: WebhookEvent[];
  active: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  failureCount: number;
}

/** Status values for a delivery attempt */
export type AttemptStatus = 'pending' | 'success' | 'failed' | 'dead_letter';

/** Webhook delivery attempt record */
export interface WebhookAttempt {
  id: string;
  endpointId: string;
  tenantId: string;
  event: WebhookEvent;
  /** JSON-serialized payload sent */
  payload: string;
  attemptNum: number;
  status: AttemptStatus;
  httpStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  nextRetryAt?: string;
  createdAt: string;
  completedAt?: string;
}

/** Generic payload envelope sent to the subscriber */
export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  tenantId: string;
  timestamp: string;
  data: Record<string, unknown>;
}
