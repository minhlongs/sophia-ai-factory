/**
 * @file config-repo.ts
 * @description D1 SQLite persistence operations for enterprise CRM configs.
 * @layer tree
 */

import type { D1Database } from '@/seed/db/client';
import type {
  CrmProvider,
  EnterpriseCrmConfig,
  EnterpriseCrmConfigRow,
  UpsertCrmConfigInput,
} from '../types';
import { mapCrmConfigRow } from '../types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/**
 * Saves or updates an Enterprise CRM config for a tenant.
 */
export async function saveCrmConfig(
  db: D1Database,
  input: UpsertCrmConfigInput
): Promise<EnterpriseCrmConfig> {
  const now = Date.now();
  const id = input.id || generateId('crmcfg');
  const isActiveNum = input.isActive === false ? 0 : 1;
  const fieldMappingJson = JSON.stringify(input.fieldMapping || {});

  const query = `
    INSERT INTO enterprise_crm_configs (
      id, tenant_id, provider, api_endpoint, client_id,
      client_secret_encrypted, refresh_token_encrypted, access_token_encrypted,
      token_expires_at, sync_direction, is_active, field_mapping_json,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(tenant_id, provider) DO UPDATE SET
      api_endpoint = excluded.api_endpoint,
      client_id = excluded.client_id,
      client_secret_encrypted = excluded.client_secret_encrypted,
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      access_token_encrypted = excluded.access_token_encrypted,
      token_expires_at = excluded.token_expires_at,
      sync_direction = excluded.sync_direction,
      is_active = excluded.is_active,
      field_mapping_json = excluded.field_mapping_json,
      updated_at = excluded.updated_at
  `;

  await db
    .prepare(query)
    .bind(
      id,
      input.tenantId,
      input.provider,
      input.apiEndpoint || null,
      input.clientId || null,
      input.clientSecretEncrypted || null,
      input.refreshTokenEncrypted || null,
      input.accessTokenEncrypted || null,
      input.tokenExpiresAt || null,
      input.syncDirection || 'bidirectional',
      isActiveNum,
      fieldMappingJson,
      now,
      now
    )
    .run();

  const retrieved = await getCrmConfig(db, input.tenantId, input.provider);
  if (!retrieved) {
    throw new Error(`Failed to retrieve saved CRM config for ${input.provider}`);
  }
  return retrieved;
}

/**
 * Retrieves a CRM config by tenant and provider.
 */
export async function getCrmConfig(
  db: D1Database,
  tenantId: string,
  provider: CrmProvider
): Promise<EnterpriseCrmConfig | null> {
  const row = await db
    .prepare('SELECT * FROM enterprise_crm_configs WHERE tenant_id = ? AND provider = ?')
    .bind(tenantId, provider)
    .first<EnterpriseCrmConfigRow>();

  if (!row) return null;
  return mapCrmConfigRow(row);
}

/**
 * Lists all CRM configs for a tenant.
 */
export async function listCrmConfigs(
  db: D1Database,
  tenantId: string
): Promise<EnterpriseCrmConfig[]> {
  const result = await db
    .prepare('SELECT * FROM enterprise_crm_configs WHERE tenant_id = ? ORDER BY provider ASC')
    .bind(tenantId)
    .all<EnterpriseCrmConfigRow>();

  return (result.results || []).map(mapCrmConfigRow);
}
