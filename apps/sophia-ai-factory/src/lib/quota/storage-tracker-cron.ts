/**
 * Storage Tracker — Daily Inngest Cron (Phase 11)
 *
 * Runs at 03:00 UTC daily. For each tenant:
 *   1. Lists R2 objects under prefix `tenants/{tid}/`
 *   2. Sums total bytes (paginated)
 *   3. Upserts tenant_storage_usage
 *
 * @module quota/storage-tracker-cron
 */

import { inngest } from '@/lib/inngest/client';
import { logger } from '@/seed/utils/logger-utility';

interface R2Env {
  NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;
  VIDEO_R2_BUCKET?: R2Bucket;
}

interface StorageBreakdown {
  videoBytes: number;
  otherBytes: number;
}

/** Get R2 bucket binding from globalThis.__env */
function getR2(): R2Bucket | null {
  const env = (globalThis as unknown as { __env?: R2Env }).__env;
  return env?.VIDEO_R2_BUCKET ?? env?.NEXT_INC_CACHE_R2_BUCKET ?? null;
}

/** Get D1 binding */
function getD1(): D1Database | null {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;
  return (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined ?? null;
}

/** List all distinct tenant IDs from video_jobs */
async function listTenantIds(db: D1Database): Promise<string[]> {
  const res = await db
    .prepare('SELECT DISTINCT tenant_id FROM video_jobs')
    .all<{ tenant_id: string }>();
  return res.results.map((r) => r.tenant_id);
}

/** Paginated R2 ListObjects for a tenant prefix, returning total bytes + breakdown */
async function sumR2Bytes(
  bucket: R2Bucket,
  tenantId: string,
): Promise<{ totalBytes: number; objectCount: number; breakdown: StorageBreakdown }> {
  const prefix = `tenants/${tenantId}/`;
  let totalBytes = 0;
  let objectCount = 0;
  const breakdown: StorageBreakdown = { videoBytes: 0, otherBytes: 0 };

  let cursor: string | undefined;

  do {
    const opts: R2ListOptions = { prefix, limit: 1000 };
    if (cursor) opts.cursor = cursor;

    const listed = await bucket.list(opts);

    for (const obj of listed.objects) {
      totalBytes += obj.size;
      objectCount++;
      if (obj.key.includes('/videos/')) {
        breakdown.videoBytes += obj.size;
      } else {
        breakdown.otherBytes += obj.size;
      }
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return { totalBytes, objectCount, breakdown };
}

/** Upsert storage usage for one tenant */
async function upsertStorageUsage(
  db: D1Database,
  tenantId: string,
  totalBytes: number,
  videoCount: number,
  breakdown: StorageBreakdown,
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const breakdownJson = JSON.stringify(breakdown);

  await db
    .prepare(
      `INSERT INTO tenant_storage_usage (tenant_id, total_bytes, video_count, last_calculated_at, breakdown_json)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(tenant_id) DO UPDATE SET
         total_bytes = ?2,
         video_count = ?3,
         last_calculated_at = ?4,
         breakdown_json = ?5`
    )
    .bind(tenantId, totalBytes, videoCount, nowSec, breakdownJson)
    .run();
}

/** Get video count for a tenant from video_jobs */
async function getVideoCount(db: D1Database, tenantId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS cnt FROM video_jobs WHERE tenant_id = ?')
    .bind(tenantId)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

export const storageTrackerDaily = inngest.createFunction(
  {
    id: 'storage-tracker-daily',
    name: 'Daily Storage Usage Tracker',
  },
  { cron: '0 3 * * *' },
  async ({ step }) => {
    // Resolve bindings at function body scope (not inside step.run — D1Database
    // is not JSON-serialisable and cannot be returned from a step checkpoint).
    const db = getD1();
    if (!db) {
      logger.error('[StorageTracker] D1 binding unavailable — aborting run');
      return { processed: 0, error: 'D1 unavailable' };
    }

    const tenantIds = await step.run('list-tenants', () => listTenantIds(db));

    logger.info('[StorageTracker] Starting daily run', { tenantCount: tenantIds.length });

    const r2 = getR2();

    for (const tenantId of tenantIds) {
      await step.run(`process-tenant-${tenantId}`, async () => {
        let totalBytes = 0;
        let breakdown: StorageBreakdown = { videoBytes: 0, otherBytes: 0 };

        if (r2) {
          try {
            const result = await sumR2Bytes(r2, tenantId);
            totalBytes = result.totalBytes;
            breakdown = result.breakdown;
          } catch (err) {
            logger.error('[StorageTracker] R2 list error', { tenantId, err });
          }
        }

        const videoCount = await getVideoCount(db, tenantId);
        await upsertStorageUsage(db, tenantId, totalBytes, videoCount, breakdown);

        logger.info('[StorageTracker] Tenant processed', {
          tenantId,
          totalBytes,
          videoCount,
        });
      });
    }

    return { processed: tenantIds.length };
  }
);
