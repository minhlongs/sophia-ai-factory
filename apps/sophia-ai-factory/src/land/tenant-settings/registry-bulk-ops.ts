/**
 * Bulk operations and listing helpers for tenant settings registry.
 * @module land/tenant-settings/registry-bulk-ops
 */

import {
  type SettingsNamespace,
  type TenantSettingRow,
  SETTINGS_NAMESPACES,
} from '@/seed/tenant-settings/types';

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

/**
 * Bulk-import settings using the provided namespace setter.
 * Validates each namespace if validator map provided.
 */
export async function executeBulkImport(
  db: D1Database,
  tenantId: string,
  settings: Partial<Record<SettingsNamespace, unknown>>,
  setFn: <T>(
    db: D1Database,
    tenantId: string,
    namespace: SettingsNamespace,
    value: T,
    validate?: (v: unknown) => T,
  ) => Promise<void>,
  validators?: Partial<Record<SettingsNamespace, (v: unknown) => unknown>>,
): Promise<void> {
  for (const [ns, value] of Object.entries(settings)) {
    const namespace = ns as SettingsNamespace;
    if (!SETTINGS_NAMESPACES.includes(namespace)) continue;
    const validator = validators?.[namespace];
    await setFn(db, tenantId, namespace, value, validator);
  }
}

/** Export all settings as a plain object (present namespaces only). */
export async function bulkExport(
  db: D1Database,
  tenantId: string,
): Promise<Partial<Record<SettingsNamespace, unknown>>> {
  return listAll(db, tenantId);
}
