/**
 * Enterprise CRM & Webhook Bus — Tree Type Definitions
 *
 * Defines domain entities, database row contracts, transformation schemas,
 * and conflict resolution models for Salesforce, HubSpot, and Webhook dispatching.
 *
 * Layer: tree/integrations (Pure domain types — imports only from @/seed)
 *
 * @module tree/integrations/types
 */

// ── CRM Configurations ──────────────────────────────────────────────────────

export type CrmProvider = 'salesforce' | 'hubspot' | 'zapier' | 'custom';

export type CrmSyncDirection = 'inbound' | 'outbound' | 'bidirectional';

export interface EnterpriseCrmConfigRow {
  id: string;
  tenant_id: string;
  provider: string;
  api_endpoint: string | null;
  client_id: string | null;
  client_secret_encrypted: string | null;
  refresh_token_encrypted: string | null;
  access_token_encrypted: string | null;
  token_expires_at: number | null;
  sync_direction: string;
  is_active: number;
  field_mapping_json: string;
  created_at: number;
  updated_at: number;
}

export interface EnterpriseCrmConfig {
  id: string;
  tenantId: string;
  provider: CrmProvider;
  apiEndpoint: string | null;
  clientId: string | null;
  clientSecretEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  accessTokenEncrypted: string | null;
  tokenExpiresAt: number | null;
  syncDirection: CrmSyncDirection;
  isActive: boolean;
  fieldMapping: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertCrmConfigInput {
  id?: string;
  tenantId: string;
  provider: CrmProvider;
  apiEndpoint?: string | null;
  clientId?: string | null;
  clientSecretEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  accessTokenEncrypted?: string | null;
  tokenExpiresAt?: number | null;
  syncDirection?: CrmSyncDirection;
  isActive?: boolean;
  fieldMapping?: Record<string, string>;
}

// ── CRM Sync Events ─────────────────────────────────────────────────────────

export type CrmEntityType = 'deal' | 'opportunity' | 'contact' | 'lead' | 'invoice';

export type CrmSyncEventDirection = 'inbound' | 'outbound';

export type CrmSyncStatus = 'pending' | 'processing' | 'synced' | 'failed' | 'ignored';

export interface CrmSyncEventRow {
  id: string;
  tenant_id: string;
  crm_config_id: string;
  entity_type: string;
  entity_id: string;
  external_id: string | null;
  direction: string;
  status: string;
  payload_json: string;
  error_message: string | null;
  retry_count: number;
  next_retry_at: number | null;
  synced_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface CrmSyncEvent {
  id: string;
  tenantId: string;
  crmConfigId: string;
  entityType: CrmEntityType;
  entityId: string;
  externalId: string | null;
  direction: CrmSyncEventDirection;
  status: CrmSyncStatus;
  payload: Record<string, unknown>;
  errorMessage: string | null;
  retryCount: number;
  nextRetryAt: number | null;
  syncedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface RecordCrmSyncEventInput {
  id?: string;
  tenantId: string;
  crmConfigId: string;
  entityType: CrmEntityType;
  entityId: string;
  externalId?: string | null;
  direction: CrmSyncEventDirection;
  status?: CrmSyncStatus;
  payload: Record<string, unknown>;
  errorMessage?: string | null;
  retryCount?: number;
  nextRetryAt?: number | null;
  syncedAt?: number | null;
}

// ── Deal Model & CRM Payload Mappings ───────────────────────────────────────

export type SophiaDealStage =
  | 'new_lead'
  | 'enriching'
  | 'qualified'
  | 'demo_prepared'
  | 'demo_active'
  | 'proposal_sent'
  | 'negotiating'
  | 'closed_won'
  | 'closed_lost';

export interface SophiaDealSnapshot {
  id: string;
  leadName?: string;
  leadEmail?: string;
  leadPhone?: string | null;
  companyName: string;
  companyDomain: string;
  dealStage: SophiaDealStage;
  dealValueEstimateCents: number;
  currency: string;
  closeDate?: string | null; // YYYY-MM-DD
  notes?: string | null;
  sdrNotes?: string | null;
  updatedAt?: number;
}

export interface SalesforceOpportunityPayload {
  Sophia_Deal_Id__c?: string;
  Id?: string;
  Name: string;
  StageName: string;
  Amount?: number;
  CurrencyIsoCode?: string;
  CloseDate?: string;
  Description?: string;
  Contact_Email__c?: string;
  Contact_Phone__c?: string;
  Account_Domain__c?: string;
  LastModifiedDate?: string;
  [key: string]: unknown;
}

export interface HubSpotDealPayload {
  sophia_deal_id?: string;
  hs_object_id?: string;
  dealname: string;
  dealstage: string;
  amount?: string | number;
  deal_currency_code?: string;
  closedate?: string | number;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  company_domain?: string;
  hs_lastmodifieddate?: string | number;
  [key: string]: unknown;
}

// ── Conflict Resolution ─────────────────────────────────────────────────────

export type ConflictResolutionAction = 'apply' | 'ignore';

export interface ConflictResolutionOptions {
  hasSignedContract?: boolean;
  incomingTimestamp?: number;
  existingTimestamp?: number;
}

export interface ConflictResolutionResult {
  action: ConflictResolutionAction;
  reason: string;
  resolvedDeal: SophiaDealSnapshot;
  appliedFields: string[];
  ignoredFields: string[];
}

// ── Webhook Subscriptions & Deliveries ──────────────────────────────────────

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

// ── Row Mappers ─────────────────────────────────────────────────────────────

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
