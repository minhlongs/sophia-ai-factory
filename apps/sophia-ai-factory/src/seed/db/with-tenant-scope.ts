/**
 * withTenantScope — Tenant-scoped D1Client wrapper
 *
 * Wraps D1Client so that selectFrom/update/delete on tenant-scoped tables
 * automatically inject `WHERE tenant_id = ?`. Insert without tenant_id throws.
 *
 * Tables without a tenant_id column (Better Auth tables) bypass injection.
 *
 * @module db/with-tenant-scope
 */

import { D1Client } from '@/seed/db/d1-client-rpc';
import { D1QueryChain } from '@/seed/db/d1-query-chain';
import { logger } from '@/seed/utils/logger-utility';

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
const AGY_TENANT_TABLES = new Set([
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
const BYPASS_TABLES = new Set([
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

export class TenantScopedClient {
  constructor(
    private readonly inner: D1Client,
    private readonly tenantId: string,
    private readonly mode: TenantScopeMode = 'strict',
  ) {}

  /**
   * Returns a D1QueryChain scoped to the current tenant.
   * - Bypass tables: returns chain as-is
   * - Scoped tables: auto-appends .eq('tenant_id', tenantId) or .eq('agency_id', tenantId)
   * - Unknown tables: permissive → scope; strict → throw
   */
  from<T = Record<string, unknown>>(table: string): D1QueryChain<T> {
    const chain = this.inner.from<T>(table);

    if (BYPASS_TABLES.has(table)) {
      return chain;
    }

    if (TENANT_SCOPED_TABLES.has(table as never)) {
      const scopeCol = AGY_TENANT_TABLES.has(table) ? 'agency_id' : 'tenant_id';
      return chain.eq(scopeCol, this.tenantId);
    }

    if (this.mode === 'strict') {
      throw new Error(
        `[withTenantScope] Unknown table "${table}" — not in TENANT_SCOPED_TABLES or BYPASS_TABLES. ` +
        `Add it to TENANT_SCOPED_TABLES if it has tenant_id, or BYPASS_TABLES if it is global.`,
      );
    }

    // Permissive mode: scope unknown tables (safe default)
    logger.warn('[withTenantScope] Scoping unknown table', { table, tenantId: this.tenantId });
    return chain.eq('tenant_id', this.tenantId);
  }

  /**
   * Insert with mandatory tenant_id/agency_id field for scoped tables.
   * Throws if tenant identifier is absent on a scoped table insert.
   */
  insertScoped(table: string, data: Record<string, unknown>): D1QueryChain {
    if (TENANT_SCOPED_TABLES.has(table as never)) {
      const scopeCol = AGY_TENANT_TABLES.has(table) ? 'agency_id' : 'tenant_id';
      const providedId = (data[scopeCol] ?? data['tenant_id']) as string | undefined;
      if (!providedId) {
        throw new Error(
          `[withTenantScope] Insert into "${table}" requires ${scopeCol}. ` +
          'Use insertScoped with tenant_id or assign it explicitly.',
        );
      }
      // Enforce tenant cannot inject a different tenant_id
      if (providedId !== this.tenantId) {
        throw new Error(
          `[withTenantScope] ${scopeCol} mismatch on insert into "${table}".`,
        );
      }
      return this.inner.from(table).insert({ ...data, [scopeCol]: this.tenantId });
    }

    return this.inner.from(table).insert({ ...data, tenant_id: this.tenantId });
  }

/** Pass-through for RPC calls (not tenant-scoped) */
rpc(fnName: string, params: Record<string, unknown> = {}) {
return this.inner.rpc(fnName, params);
}
}

/**
 * Wrap a D1Client with tenant-scope enforcement.
 *
 * Usage:
 * const tid = requireTenantId(session);
 * const db = withTenantScope(createServerClient() as unknown as D1Client, tid);
 * const jobs = await db.from('video_jobs').select('*');
 * // Automatically includes WHERE tenant_id = ?
 *
 * @param mode - 'permissive' (default) scopes unknown tables; 'strict' throws on unknown tables
 */
export function withTenantScope(
db: D1Client,
tenantId: string,
mode: TenantScopeMode = 'permissive',
): TenantScopedClient {
if (!tenantId) {
throw new Error('[withTenantScope] tenantId must be a non-empty string');
}
return new TenantScopedClient(db, tenantId, mode);
}
