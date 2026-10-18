/**
 * Tenant scope table classifications for withTenantScope.
 *
 * @module db/tenant-scope-tables
 */

/**
 * Tables that have a tenant_id column and MUST be scoped.
 * Extend this list as new phases add tenant-scoped tables.
 */
export const TENANT_SCOPED_TABLES = new Set([
  'video_jobs',
  'video_cost_log',
  'voices',
  'video_templates',
  'tenant_storage_usage',
  'brand_kits',
  'agy_tenant_configs',
  'agy_tenant_tokens',
  'agy_agency_domains',
  'agy_audit_logs',
  'agy_policy_audit_ledger',
  'agy_governance_configs',
] as const);

/**
 * AGY tables that use agency_id as their tenant isolation key.
 */
export const AGY_TENANT_TABLES = new Set([
  'agy_tenant_configs',
  'agy_tenant_tokens',
  'agy_agency_domains',
  'agy_audit_logs',
  'agy_policy_audit_ledger',
  'agy_governance_configs',
]);

/**
 * Tables owned by Better Auth (or other global schemas) that MUST bypass injection.
 * Reads from these tables return unfiltered results — auth is handled separately.
 */
export const BYPASS_TABLES = new Set([
  'users',
  'sessions',
  'accounts',
  'verifications',
  'two_factors',
]);

/**
 * Strict mode: throw on unknown tables instead of silently scoping.
 * Enable when you want to catch typos or unregistered tenant-scoped tables.
 */
export type TenantScopeMode = 'permissive' | 'strict';
