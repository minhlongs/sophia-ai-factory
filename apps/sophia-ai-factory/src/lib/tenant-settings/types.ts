/**
 * Core types for the tenant-settings framework.
 * All features that need per-tenant configuration consume from this module.
 * @module lib/tenant-settings/types
 */

/** All valid setting namespaces. Extend this union as new features land. */
export type SettingsNamespace =
  | 'branding'
  | 'scoring'
  | 'geo'
  | 'cron'
  | 'channels'
  | 'mcp'
  | 'webhooks-defaults'
  | 'storage'
  | 'misc';

/** All namespace values as array (for validation + iteration). */
export const SETTINGS_NAMESPACES: SettingsNamespace[] = [
  'branding',
  'scoring',
  'geo',
  'cron',
  'channels',
  'mcp',
  'webhooks-defaults',
  'storage',
  'misc',
];

/** Hydrated representation of a single tenant setting row. */
export interface TenantSetting<T = unknown> {
  tenantId: string;
  namespace: SettingsNamespace;
  value: T;
  schemaVersion: number;
  updatedAt: string;
}

/** Raw DB row shape (snake_case mirrors D1 column names). */
export interface TenantSettingRow {
  id: string;
  tenant_id: string;
  namespace: string;
  value: string;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

/** Thrown when Zod (or custom) validator rejects the incoming value. */
export class SettingsValidationError extends Error {
  constructor(
    public readonly namespace: SettingsNamespace,
    message: string,
    public readonly details?: unknown,
  ) {
    super(`[tenant-settings] Validation failed for namespace "${namespace}": ${message}`);
    this.name = 'SettingsValidationError';
  }
}

/** Thrown when a namespace is required but no row exists and no default supplied. */
export class SettingsNotFoundError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly namespace: SettingsNamespace,
  ) {
    super(
      `[tenant-settings] No setting found for tenant "${tenantId}", namespace "${namespace}"`,
    );
    this.name = 'SettingsNotFoundError';
  }
}
