/**
 * Feature row queries for pattern detection engine.
 *
 * @module forest/patterns/pattern-detector-queries
 */

import { createServerClient } from '@/seed/db/client';

export const MIN_SAMPLE = 5;

export interface RawRow {
  feature_value: string;
  avg_metric: number;
  sample_size: number;
  avgMetric: number;
  sampleSize: number;
}

/**
 * Query aggregated feature rows from the appropriate source table.
 * Each source has a different shape; we normalize to {feature_value, avg_metric, sample_size}.
 */
export async function queryFeatureRows(
  db: ReturnType<typeof createServerClient>,
  featureKey: string,
  metric: string,
  workspaceId: string,
  source: 'experiment' | 'memory' | 'roi',
): Promise<RawRow[]> {
  if (source === 'experiment') {
    // ab_experiments: winner rows carry variant captions; cluster by content_type
    const result = await db.execute(
      `SELECT content_type AS feature_value,
              AVG(CASE WHEN winner = 'a' THEN impressions_a + conversions_a
                       WHEN winner = 'b' THEN impressions_b + conversions_b
                       ELSE 0 END) AS avg_metric,
              COUNT(*) AS sample_size
       FROM ab_experiments
       WHERE workspace_id = ? AND status = 'decided' AND winner IN ('a', 'b')
       GROUP BY content_type
       HAVING COUNT(*) >= ?`,
      [workspaceId, MIN_SAMPLE],
    );
    return (result.results ?? []) as unknown as RawRow[];
  }

  if (source === 'memory') {
    // creative_memory: category='performance' rows store aggregates as JSON
    const result = await db.execute(
      `SELECT key AS feature_value,
              CAST(JSON_EXTRACT(value, '$.avg') AS REAL) AS avg_metric,
              CAST(JSON_EXTRACT(value, '$.sample') AS INTEGER) AS sample_size
       FROM creative_memory
       WHERE workspace_id = ? AND category = 'performance' AND is_deleted = 0
         AND key LIKE ?`,
      [workspaceId, `perf:${featureKey}:%`],
    );
    return (result.results ?? []) as unknown as RawRow[];
  }

  // source === 'roi'
  const result = await db.execute(
    `SELECT content_id AS feature_value,
            AVG(revenue) AS avg_metric,
            COUNT(*) AS sample_size
     FROM roi_records
     WHERE workspace_id = ? AND content_id IS NOT NULL
     GROUP BY content_id
     HAVING COUNT(*) >= ?`,
    [workspaceId, MIN_SAMPLE],
  );
  return (result.results ?? []) as unknown as RawRow[];
}
