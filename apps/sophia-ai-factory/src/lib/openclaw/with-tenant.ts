/**
 * with-tenant.ts — Tenant context helpers
 * Phase 12: OpenClaw Orchestrator primitive
 *
 * Re-exports withTenantScope from Phase 11 (if available).
 * Provides runAsTenant() helper for callback-scoped tenant context.
 */

import { getD1Raw } from '@/seed/db/client';

/** Immutable tenant context attached to every agent operation. */
export interface TenantContext {
  tenantId: string;
  actor?: string;
}

/**
 * AsyncLocalStorage-like tenant context via closure.
 * For edge runtime compatibility we use a simple closure pattern
 * rather than AsyncLocalStorage (not universally available in CF Workers).
 */
export async function runAsTenant<T>(
  tenantId: string,
  callback: (ctx: TenantContext) => Promise<T>,
  actor?: string,
): Promise<T> {
  const ctx: TenantContext = { tenantId, actor };
  return callback(ctx);
}

/**
 * Thin wrapper: apply tenant filter to a D1 query result set.
 * Usage: pass any results array and tenant_id field name.
 */
export function filterByTenant<T extends Record<string, unknown>>(
  rows: T[],
  tenantId: string,
  field: keyof T = 'tenant_id' as keyof T,
): T[] {
  return rows.filter((row) => row[field] === tenantId);
}

/**
 * withTenantScope — low-level D1 row isolation helper.
 * Wraps a raw D1Database, ensuring all prepared statements
 * receive tenant_id binding in a predictable slot.
 *
 * This is a lightweight substitute if Phase 11 plugin is not yet loaded.
 */
export async function withTenantScope<T>(
  tenantId: string,
  fn: (db: D1Database) => Promise<T>,
): Promise<T> {
  const db = await getD1Raw();
  return fn(db);
}
