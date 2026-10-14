/**
 * D1 Query finder for completed videos needing A/B thumbnail experiments
 *
 * @module forest/ab/thumbnail/experiment-finder
 */

import { getD1 } from '@/seed/db/client';
import type { VideoNeedingExperiment } from './types';

export async function findVideosNeedingExperiments(
  limit = 20,
): Promise<VideoNeedingExperiment[]> {
  const db = await getD1();
  if (!db) {
    throw new Error('D1 database binding not available');
  }

  const { results } = await db
    .prepare(
      `SELECT v.id AS video_id, v.user_id AS tenant_id, v.title
       FROM videos v
       WHERE v.status = 'completed'
         AND v.thumbnail_url IS NOT NULL
         AND v.title IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM ab_experiments e
           WHERE e.video_id = v.id
             AND e.status = 'active'
         )
         AND NOT EXISTS (
           SELECT 1 FROM ab_experiments e
           WHERE e.video_id = v.id
             AND e.winner IN ('a', 'b')
         )
       ORDER BY v.created_at ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<{ video_id: string; tenant_id: string; title: string }>();

  return (results ?? []).map((row) => ({
    videoId: row.video_id,
    tenantId: row.tenant_id,
    title: row.title,
  }));
}
