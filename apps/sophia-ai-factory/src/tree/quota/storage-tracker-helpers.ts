/**
 * Storage Tracker R2 & D1 Query Helpers
 *
 * @module tree/quota/storage-tracker-helpers
 */

interface R2Env {
  NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;
  VIDEO_BUCKET?: R2Bucket;
}

export interface StorageBreakdown {
  videoBytes: number;
  otherBytes: number;
}

/** Get R2 bucket binding from globalThis.__env */
export function getR2(): R2Bucket | null {
  const env = (globalThis as unknown as { __env?: R2Env }).__env;
  return env?.VIDEO_BUCKET ?? env?.NEXT_INC_CACHE_R2_BUCKET ?? null;
}

/** List all distinct tenant IDs from video_jobs */
export async function listTenantIds(db: D1Database): Promise<string[]> {
  const res = await db
    .prepare('SELECT DISTINCT tenant_id FROM video_jobs')
    .all<{ tenant_id: string }>();
  return res.results.map((r) => r.tenant_id);
}

/** Paginated R2 ListObjects for a tenant prefix, returning total bytes + breakdown */
export async function sumR2Bytes(
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
export async function upsertStorageUsage(
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
export async function getVideoCount(db: D1Database, tenantId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS cnt FROM video_jobs WHERE tenant_id = ?')
    .bind(tenantId)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}
