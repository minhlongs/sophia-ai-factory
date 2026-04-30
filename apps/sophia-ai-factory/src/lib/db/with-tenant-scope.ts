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

import { D1Client } from './d1-client-rpc';
import { D1QueryChain } from './d1-query-chain';

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
] as const);

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

export class TenantScopedClient {
  constructor(
    private readonly inner: D1Client,
    private readonly tenantId: string,
  ) {}

  /**
   * Returns a D1QueryChain scoped to the current tenant.
   * For scoped tables: auto-appends .eq('tenant_id', tenantId).
   * For bypass tables: returns the chain as-is.
   * For unknown tables: defaults to scope injection (safe default).
   */
  from<T = Record<string, unknown>>(table: string): D1QueryChain<T> {
    const chain = this.inner.from<T>(table);

    if (BYPASS_TABLES.has(table)) {
      return chain;
    }

    // All other tables (including scoped + unknown) get tenant filter
    return chain.eq('tenant_id', this.tenantId);
  }

  /**
   * Insert with mandatory tenant_id field for scoped tables.
   * Throws if tenant_id is absent on a scoped table insert.
   */
  insertScoped(table: string, data: Record<string, unknown>): D1QueryChain {
    if (TENANT_SCOPED_TABLES.has(table as never)) {
      if (!('tenant_id' in data) || !data['tenant_id']) {
        throw new Error(
          `[withTenantScope] Insert into "${table}" requires tenant_id. ` +
          'Use insertScoped with tenant_id or assign it explicitly.'
        );
      }
      // Enforce tenant cannot inject a different tenant_id
      if (data['tenant_id'] !== this.tenantId) {
        throw new Error(
          `[withTenantScope] tenant_id mismatch on insert into "${table}".`
        );
      }
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
 *   const tid = requireTenantId(session);
 *   const db = withTenantScope(createServerClient() as unknown as D1Client, tid);
 *   const jobs = await db.from('video_jobs').select('*');
 *   // Automatically includes WHERE tenant_id = ?
 */
export function withTenantScope(db: D1Client, tenantId: string): TenantScopedClient {
  if (!tenantId) {
    throw new Error('[withTenantScope] tenantId must be a non-empty string');
  }
  return new TenantScopedClient(db, tenantId);
}
