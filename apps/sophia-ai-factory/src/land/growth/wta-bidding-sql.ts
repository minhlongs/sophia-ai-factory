/**
 * Parameterized SQL & chunked D1 culling helpers for Winner-Take-All Bidding.
 *
 * Deduplicates cumulative daily video_analytics rows per (video_id, platform)
 * using ROW_NUMBER() OVER (PARTITION BY va.video_id, va.platform ORDER BY va.date DESC)
 * scoped to (va.user_id = vj.user_id OR va.user_id = vj.tenant_id), and chunks D1 IN (?, ...) updates to <= 80 IDs.
 *
 * @module land/growth/wta-bidding-sql
 */

import type { createServerClient } from '@/seed/db/client';

export const WTA_D1_CULL_CHUNK_SIZE = 80;

export const SELECT_WTA_TELEMETRY_SQL = `
  WITH latest_va AS (
    SELECT
      va.video_id,
      va.user_id,
      va.views,
      va.completion_rate,
      va.clicks,
      va.likes,
      va.shares,
      ROW_NUMBER() OVER (PARTITION BY va.video_id, va.platform ORDER BY va.date DESC) AS rn
    FROM video_analytics va
  )
  SELECT
    vj.id AS id,
    vj.prompt AS prompt,
    COALESCE(vj.created_at, 0) AS createdAt,
    COALESCE(SUM(lva.views), 0) AS views,
    COALESCE(AVG(lva.completion_rate), 0) AS completionRate,
    COALESCE(SUM(lva.clicks), 0) AS clicks,
    COALESCE(SUM(lva.likes), 0) AS likes,
    COALESCE(SUM(lva.shares), 0) AS shares
  FROM video_jobs vj
  LEFT JOIN latest_va lva
    ON lva.video_id = vj.id
   AND (lva.user_id = vj.user_id OR lva.user_id = vj.tenant_id)
   AND lva.rn = 1
  WHERE vj.tenant_id = ? AND vj.user_id = ?
    AND vj.created_at >= ? AND vj.created_at <= ?
    AND vj.status = 'published'
  GROUP BY vj.id, vj.prompt, vj.created_at
`;

type ServerDbClient = ReturnType<typeof createServerClient>;

export async function cullBottomWtaJobsInChunks(
  db: ServerDbClient,
  tenantId: string,
  jobIds: readonly string[],
  nowSec: number,
): Promise<void> {
  for (let offset = 0; offset < jobIds.length; offset += WTA_D1_CULL_CHUNK_SIZE) {
    const chunk = jobIds.slice(offset, offset + WTA_D1_CULL_CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(', ');
    const updateSql =
      "UPDATE video_jobs SET status = 'failed', error = 'culled_by_bidding', updated_at = ? WHERE tenant_id = ? AND id IN (" +
      placeholders +
      ')';
    await db.prepare(updateSql).bind(nowSec, tenantId, ...chunk).run();
  }
}
