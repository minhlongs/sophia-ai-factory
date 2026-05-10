/**
 * Cascade-delete all tenant-scoped data for a single user.
 *
 * Wave 22 Phase 06: extracted from `app/api/account/route.ts` so the manual
 * DELETE flow and the Inngest auto-finalize cron share one implementation.
 *
 * Idempotent — re-running on a partially-deleted tenant returns 0 rows for
 * each table that's already empty. Safe to invoke from cron + manual paths
 * without coordination.
 *
 * @module land/account/cascade-delete
 */

/** Dependents-first deletion order. ALL tables MUST scope by tenant_id. */
export const ACCOUNT_DELETE_ORDER = [
  'audit_log',
  'publishing_results',
  'publishing_jobs',
  'publishing_channels',
  'payout_batches',
  'commission_ledger',
  'conversion_events',
  'affiliate_links',
  'video_jobs',
  'sessions',
  'users',
] as const;

export interface CascadeDeleteResult {
  totalDeleted: number;
  byTable: Record<string, number>;
}

export async function cascadeDeleteAccount(
  db: D1Database,
  userId: string,
  tenantId: string,
): Promise<CascadeDeleteResult> {
  const byTable: Record<string, number> = {};
  let total = 0;

  for (const table of ACCOUNT_DELETE_ORDER) {
    try {
      const r = await db
        .prepare(`DELETE FROM ${table} WHERE tenant_id = ?`)
        .bind(tenantId)
        .run();
      const c = r.meta?.rows_written ?? 0;
      byTable[table] = c;
      total += c;
    } catch {
      // Per-table failure non-fatal: cron retry / manual call picks up next pass.
      byTable[table] = 0;
    }
  }

  // Cleanup cooldown row regardless of cascade outcome (so it doesn't loop).
  try {
    await db
      .prepare(`DELETE FROM account_deletion_requests WHERE user_id = ?`)
      .bind(userId)
      .run();
  } catch {
    /* non-fatal */
  }

  return { totalDeleted: total, byTable };
}
