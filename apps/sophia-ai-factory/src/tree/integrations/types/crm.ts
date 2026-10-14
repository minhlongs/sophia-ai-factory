/**
 * Enterprise CRM Configuration & Sync Events Types
 * Layer: tree/integrations
 */

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
