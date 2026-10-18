/**
 * Generic CRUD registry for tenant settings.
 * All operations are tenant-scoped and edge-runtime safe.
 * @module lib/tenant-settings/registry
 */

import {
  type SettingsNamespace,
  type TenantSettingRow,
  SETTINGS_NAMESPACES,
  SettingsValidationError,
} from './types';
import { NAMESPACE_DEFAULTS } from './defaults';
import { deleteNamespace, deleteAllForTenant, listAll, bulkExport } from './registry-bulk-ops';

export { deleteNamespace, deleteAllForTenant, listAll, bulkExport };

function generateId(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const rand = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  return `ts_${Date.now().toString(36)}_${rand}`;
}

/** Retrieve the current value for a namespace, or null if not set. */
export async function get<T = unknown>(
  db: D1Database,
  tenantId: string,
  namespace: SettingsNamespace,
): Promise<T | null> {
  const row = await db
    .prepare('SELECT value FROM tenant_settings WHERE tenant_id = ? AND namespace = ? LIMIT 1')
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
 * Upsert a namespace value (replace entire blob).
 * Optionally runs a Zod/custom validator before persisting.
 */
export async function set<T>(
  db: D1Database,
  tenantId: string,
  namespace: SettingsNamespace,
  value: T,
  validate?: (v: unknown) => T,
): Promise<void> {
  let finalValue = value;
  if (validate) {
    try {
      finalValue = validate(value);
    } catch (err) {
      throw new SettingsValidationError(
        namespace,
        err instanceof Error ? err.message : String(err),
        err,
      );
    }
  }

  const now = new Date().toISOString();
  const serialized = JSON.stringify(finalValue);

  await db
    .prepare(
      `INSERT INTO tenant_settings (id, tenant_id, namespace, value, schema_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(tenant_id, namespace) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(generateId(), tenantId, namespace, serialized, now, now)
    .run();
}

/** Shallow-merge partial into the existing namespace value. */
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

/** Bulk-import settings. Validates each namespace if validator map provided. */
export async function bulkImport(
  db: D1Database,
  tenantId: string,
  settings: Partial<Record<SettingsNamespace, unknown>>,
  validators?: Partial<Record<SettingsNamespace, (v: unknown) => unknown>>,
): Promise<void> {
  for (const [ns, value] of Object.entries(settings)) {
    const namespace = ns as SettingsNamespace;
    if (!SETTINGS_NAMESPACES.includes(namespace)) continue;
    const validator = validators?.[namespace];
    await set(db, tenantId, namespace, value, validator);
  }
}
