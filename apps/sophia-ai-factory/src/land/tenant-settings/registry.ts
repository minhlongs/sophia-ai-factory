/**
 * Generic CRUD registry for tenant settings.
 * All operations are tenant-scoped and edge-runtime safe.
 * @module lib/tenant-settings/registry
 */

import {
  type SettingsNamespace,
  type TenantSettingRow,
  SettingsValidationError,
  SettingsNotFoundError,
} from '@/seed/tenant-settings/types';
import { NAMESPACE_DEFAULTS } from './defaults';
import { listAll, executeBulkImport, bulkExport } from './registry-bulk-ops';
import { set, deleteNamespace } from './registry-mutation-ops';

/** Retrieve the current value for a namespace, or null if not set. */
export async function get<T = unknown>(
  db: D1Database,
  tenantId: string,
  namespace: SettingsNamespace,
): Promise<T | null> {
  const row = await db
    .prepare(
      'SELECT value FROM tenant_settings WHERE tenant_id = ? AND namespace = ? LIMIT 1',
    )
    .bind(tenantId, namespace)
    .first<Pick<TenantSettingRow, 'value'>>();

  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

/** Like get(), but returns defaultValue when the row is absent. */
export async function getOrDefault<T>(
  db: D1Database,
  tenantId: string,
  namespace: SettingsNamespace,
  defaultValue?: T,
): Promise<T> {
  const existing = await get<T>(db, tenantId, namespace);
  if (existing !== null) return existing;
  if (defaultValue !== undefined) return defaultValue;
  return (NAMESPACE_DEFAULTS[namespace] as T) ?? ({} as T);
}

/**
 * Shallow-merge partial into the existing namespace value.
 * Creates the row with default + partial if not present.
 */
export async function merge<T extends Record<string, unknown>>(
  db: D1Database,
  tenantId: string,
  namespace: SettingsNamespace,
  partial: Partial<T>,
  validate?: (v: unknown) => T,
): Promise<T> {
  const current = await getOrDefault<T>(db, tenantId, namespace);
  const merged = { ...current, ...partial } as T;
  await set<T>(db, tenantId, namespace, merged, validate);
  return merged;
}

/**
 * Bulk-import settings. Validates each namespace if validator map provided.
 * Throws SettingsValidationError on first invalid namespace.
 */
export async function bulkImport(
  db: D1Database,
  tenantId: string,
  settings: Partial<Record<SettingsNamespace, unknown>>,
  validators?: Partial<Record<SettingsNamespace, (v: unknown) => unknown>>,
): Promise<void> {
  return executeBulkImport(db, tenantId, settings, set, validators);
}

export { set, deleteNamespace, listAll, bulkExport, SettingsValidationError, SettingsNotFoundError };
