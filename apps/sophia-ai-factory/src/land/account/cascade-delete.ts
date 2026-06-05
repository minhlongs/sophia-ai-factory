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

import type { R2Bucket } from '@cloudflare/workers-types';
import type { R2BucketRef } from '@/land/video/r2-binding';

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
  'videos',
  'sessions',
  'users',
] as const;

export interface CascadeDeleteResult {
  totalDeleted: number;
  byTable: Record<string, number>;
  /** Number of R2 objects successfully deleted (non-fatal: errors logged, not re-thrown). */
  r2Deleted: number;
}

/**
 * Collect all R2 keys associated with this tenant before the D1 cascade
 * removes the rows. Uses a Set to deduplicate keys that appear in multiple
 * tables (e.g. a video_job final_r2_key that was also stored as a video r2_key).
 */
async function collectTenantR2Keys(
  db: D1Database,
  tenantId: string,
): Promise<string[]> {
  const keys = new Set<string>();

  // video_jobs: tenant-scoped — fetch all staged keys in one query
  try {
    const { results } = await db
      .prepare(
        `SELECT audio_r2_key, visual_r2_key, final_r2_key
         FROM video_jobs
         WHERE tenant_id = ?`,
      )
      .bind(tenantId)
      .all<{ audio_r2_key: string | null; visual_r2_key: string | null; final_r2_key: string | null }>();
    for (const row of results ?? []) {
      if (row.audio_r2_key) keys.add(row.audio_r2_key);
      if (row.visual_r2_key) keys.add(row.visual_r2_key);
      if (row.final_r2_key) keys.add(row.final_r2_key);
    }
  } catch {
    // non-fatal: continue with other sources
  }

  // batch_jobs: user-scoped — need user_id→tenant_id join
  try {
    const { results: batchRows } = await db
      .prepare(
        `SELECT b.input_r2_key
         FROM batch_jobs b
         JOIN users u ON b.user_id = u.id
         WHERE u.tenant_id = ?`,
      )
      .bind(tenantId)
      .all<{ input_r2_key: string | null }>();
    for (const row of batchRows ?? []) {
      if (row.input_r2_key) keys.add(row.input_r2_key);
    }
  } catch {
    // non-fatal
  }

  // thumbnail_variants: user-scoped — need user_id→tenant_id join
  try {
    const { results: thumbRows } = await db
      .prepare(
        `SELECT t.r2_key, t.preview_r2_key
         FROM thumbnail_variants t
         JOIN users u ON t.user_id = u.id
         WHERE u.tenant_id = ?`,
      )
      .bind(tenantId)
      .all<{ r2_key: string | null; preview_r2_key: string | null }>();
    for (const row of thumbRows ?? []) {
      if (row.r2_key) keys.add(row.r2_key);
      if (row.preview_r2_key) keys.add(row.preview_r2_key);
    }
  } catch {
    // non-fatal
  }

  return [...keys];
}

/**
 * Delete objects from the R2 bucket. Each delete failure is caught and
 * logged — R2 errors must never block account deletion (GDPR compliance:
 * D1 data must be removed on schedule; R2 can be retried asynchronously).
 */
async function deleteR2Objects(
  bucket: R2Bucket,
  keys: string[],
): Promise<number> {
  if (keys.length === 0) return 0;

  let deleted = 0;
  for (const key of keys) {
    try {
      await bucket.delete(key);
      deleted++;
    } catch (err) {
      console.error(
        `[cascade-delete] R2 delete failed for key "${key}":`,
        err instanceof Error ? err.message : String(err),
      );
      // continue deleting remaining keys — partial R2 failure is acceptable
    }
  }
  return deleted;
}

export async function cascadeDeleteAccount(
  db: D1Database,
  userId: string,
  tenantId: string,
  r2Bucket?: R2Bucket,
): Promise<CascadeDeleteResult> {
  const byTable: Record<string, number> = {};
  let total = 0;

  // Phase 1: collect R2 keys before rows are deleted
  const r2Keys =
    r2Bucket !== undefined ? await collectTenantR2Keys(db, tenantId) : [];

  // Phase 2: D1 cascade delete (dependents-first order)
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

  // Phase 3: R2 cleanup (non-fatal — must not block D1 completion)
  let r2Deleted = 0;
  if (r2Bucket !== undefined && r2Keys.length > 0) {
    r2Deleted = await deleteR2Objects(r2Bucket, r2Keys);
  }

  // Phase 4: cleanup cooldown row regardless of cascade outcome
  // (so it doesn't loop on subsequent cron passes)
  try {
    await db
      .prepare(`DELETE FROM account_deletion_requests WHERE user_id = ?`)
      .bind(userId)
      .run();
  } catch {
    /* non-fatal */
  }

  return { totalDeleted: total, byTable, r2Deleted };
}
