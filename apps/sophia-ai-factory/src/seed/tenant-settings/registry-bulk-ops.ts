/**
 * Bulk listing, import, export, and deletion helpers for tenant settings registry.
 * @module seed/tenant-settings/registry-bulk-ops
 */

import {
  type SettingsNamespace,
  type TenantSettingRow,
  SETTINGS_NAMESPACES,
} from './types';

/** Delete a namespace row (resets to default on next read). */
export async function deleteNamespace(
  db: D1Database,
  tenantId: string,
  namespace: SettingsNamespace,
): Promise<void> {
  await db
    .prepare('DELETE FROM tenant_settings WHERE tenant_id = ? AND namespace = ?')
    .bind(tenantId, namespace)
    .run();
}

/** Delete ALL settings rows for a tenant (full reset). */
export async function deleteAllForTenant(
  db: D1Database,
  tenantId: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM tenant_settings WHERE tenant_id = ?')
    .bind(tenantId)
    .run();
}

/** Fetch all persisted namespaces for a tenant in a single query. */
export async function listAll(
  db: D1Database,
  tenantId: string,
): Promise<Partial<Record<SettingsNamespace, unknown>>> {
  const { results } = await db
    .prepare(
      'SELECT namespace, value FROM tenant_settings WHERE tenant_id = ?',
    )
    .bind(tenantId)
    .all<Pick<TenantSettingRow, 'namespace' | 'value'>>();

  const out: Partial<Record<SettingsNamespace, unknown>> = {};
  for (const row of results ?? []) {
    if (SETTINGS_NAMESPACES.includes(row.namespace as SettingsNamespace)) {
      try {
        out[row.namespace as SettingsNamespace] = JSON.parse(row.value);
      } catch {
        // skip malformed rows
      }
    }
  }
  return out;
}

/** Export all settings as a plain object (present namespaces only). */
export async function bulkExport(
  db: D1Database,
  tenantId: string,
): Promise<Partial<Record<SettingsNamespace, unknown>>> {
  return listAll(db, tenantId);
}
