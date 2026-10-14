/**
 * Webhook Subscriptions, Deliveries & Bus Contracts
 * Layer: tree/integrations
 */

export interface WebhookSubscriptionRow {
  id: string;
  tenant_id: string;
  endpoint_url: string;
  secret_key: string;
  event_types: string;
  is_active: number;
  description: string | null;
  failure_count: number;
  last_delivery_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface WebhookSubscription {
  id: string;
  tenantId: string;
  endpointUrl: string;
  secretKey: string;
  eventTypes: string[];
  isActive: boolean;
  description: string | null;
  failureCount: number;
  lastDeliveryAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWebhookSubscriptionInput {
  id?: string;
  tenantId: string;
  endpointUrl: string;
  secretKey?: string;
  eventTypes: string[];
  isActive?: boolean;
  description?: string | null;
}

export interface UpdateWebhookSubscriptionInput {
  endpointUrl?: string;
  secretKey?: string;
  eventTypes?: string[];
  isActive?: boolean;
  description?: string | null;
}

export type WebhookDeliveryStatus = 'success' | 'failed' | 'retrying';

export interface WebhookDeliveryLogRow {
  id: string;
  subscription_id: string;
  event_type: string;
  payload_json: string;
  signature: string;
  http_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  status: string;
  attempt_number: number;
  created_at: number;
}

export interface WebhookDeliveryLog {
  id: string;
  subscriptionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  signature: string;
  httpStatus: number | null;
  responseBody: string | null;
  durationMs: number | null;
  status: WebhookDeliveryStatus;
  attemptNumber: number;
  createdAt: number;
}

export interface WebhookSignResult {
  signatureHeader: string;
  timestampSeconds: number;
  signatureHex: string;
  signedPayload: string;
}

export interface WebhookVerificationResult {
  valid: boolean;
  reason?: string;
  timestampSeconds?: number;
}

export interface WebhookDispatchResult {
  deliveryId: string;
  subscriptionId: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  httpStatus: number | null;
  responseBody: string | null;
  durationMs: number;
  attemptNumber: number;
  nextRetryAt: number | null;
  signature: string;
  errorMessage?: string | null;
}
