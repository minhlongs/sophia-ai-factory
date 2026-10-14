/**
 * Enterprise CRM & Webhook Row Mappers
 * Layer: tree/integrations
 */

import type {
  CrmEntityType,
  CrmProvider,
  CrmSyncDirection,
  CrmSyncEvent,
  CrmSyncEventDirection,
  CrmSyncEventRow,
  CrmSyncStatus,
  EnterpriseCrmConfig,
  EnterpriseCrmConfigRow,
} from './crm';
import type {
  WebhookDeliveryLog,
  WebhookDeliveryLogRow,
  WebhookDeliveryStatus,
  WebhookSubscription,
  WebhookSubscriptionRow,
} from './webhooks';

export function mapCrmConfigRow(row: EnterpriseCrmConfigRow): EnterpriseCrmConfig {
  let fieldMapping: Record<string, string> = {};
  try {
    fieldMapping = JSON.parse(row.field_mapping_json || '{}') as Record<string, string>;
  } catch {
    fieldMapping = {};
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    provider: row.provider as CrmProvider,
    apiEndpoint: row.api_endpoint,
    clientId: row.client_id,
    clientSecretEncrypted: row.client_secret_encrypted,
    refreshTokenEncrypted: row.refresh_token_encrypted,
    accessTokenEncrypted: row.access_token_encrypted,
    tokenExpiresAt: row.token_expires_at,
    syncDirection: row.sync_direction as CrmSyncDirection,
    isActive: Boolean(row.is_active),
    fieldMapping,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCrmSyncEventRow(row: CrmSyncEventRow): CrmSyncEvent {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload_json || '{}') as Record<string, unknown>;
  } catch {
    payload = {};
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    crmConfigId: row.crm_config_id,
    entityType: row.entity_type as CrmEntityType,
    entityId: row.entity_id,
    externalId: row.external_id,
    direction: row.direction as CrmSyncEventDirection,
    status: row.status as CrmSyncStatus,
    payload,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    nextRetryAt: row.next_retry_at,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWebhookSubscriptionRow(row: WebhookSubscriptionRow): WebhookSubscription {
  let eventTypes: string[] = [];
  try {
    eventTypes = JSON.parse(row.event_types || '[]') as string[];
  } catch {
    eventTypes = [];
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    endpointUrl: row.endpoint_url,
    secretKey: row.secret_key,
    eventTypes,
    isActive: Boolean(row.is_active),
    description: row.description,
    failureCount: row.failure_count,
    lastDeliveryAt: row.last_delivery_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWebhookDeliveryLogRow(row: WebhookDeliveryLogRow): WebhookDeliveryLog {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload_json || '{}') as Record<string, unknown>;
  } catch {
    payload = {};
  }

  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    eventType: row.event_type,
    payload,
    signature: row.signature,
    httpStatus: row.http_status,
    responseBody: row.response_body,
    durationMs: row.duration_ms,
    status: row.status as WebhookDeliveryStatus,
    attemptNumber: row.attempt_number,
    createdAt: row.created_at,
  };
}
