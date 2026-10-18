/**
 * Tenant Settings Registry Mutation Helpers
 *
 * Upsert and delete helpers for tenant-scoped settings namespaces.
 * @module land/tenant-settings/registry-mutation-ops
 */

import {
  type SettingsNamespace,
  SettingsValidationError,
} from '@/seed/tenant-settings/types';

/** Generates a simple unique ID (timestamp + random, no external dep). */
function generateId(): string {
  return `ts_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
       ON CONFLICT(tenant_id, namespace) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
    )
    .bind(generateId(), tenantId, namespace, serialized, now, now)
    .run();
}

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
