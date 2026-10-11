import type { R2Bucket, D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type { R2DeleteSummary } from './types';

/**
 * Collect all R2 keys associated with this tenant before the D1 cascade
 * removes the rows. Uses a Set to deduplicate keys that appear in multiple
 * tables (e.g. a video_job final_r2_key that was also stored as a video r2_key).
 */
export async function collectTenantR2Keys(
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
 * Delete objects from the R2 bucket with retry. Each delete failure is retried
 * up to 2 times with jittered backoff. Permanently failing keys are captured for DLQ enqueuing.
 * R2 errors must never block account deletion (GDPR compliance: D1 data must be
 * removed on schedule; R2 can be retried asynchronously via dead-letter queue).
 */
export async function deleteR2Objects(
  bucket: R2Bucket,
  keys: string[],
  maxRetries = 2,
): Promise<R2DeleteSummary> {
  if (keys.length === 0) return { deleted: 0, failedKeys: [] };

  let deleted = 0;
  const failedKeys: string[] = [];

  for (const key of keys) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await bucket.delete(key);
        deleted++;
        break;
      } catch (err) {
        if (attempt === maxRetries) {
          logger.error(
            `[cascade-delete] R2 delete failed permanently for key "${key}" after ${maxRetries + 1} attempts:`,
            err instanceof Error ? err : { message: String(err) },
          );
          failedKeys.push(key);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
        }
      }
    }
  }

  return { deleted, failedKeys };
}
