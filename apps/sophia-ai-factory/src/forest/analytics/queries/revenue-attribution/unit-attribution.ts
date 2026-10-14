import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { ContentUnitAttribution, UnitRow, EMPTY_UNIT } from './types';

/**
 * getContentUnitAttribution — per-ContentProject ROI CTE.
 *
 * Extends the existing 6-CTE resolver by adding a unit-level attribution query
 * that joins content_projects + roi_records + performance_events.
 * Returns empty array on zero-data or D1 unavailability — never throws.
 */
export async function getContentUnitAttribution(
  workspaceId: string,
): Promise<ContentUnitAttribution[]> {
  if (!workspaceId) return EMPTY_UNIT;

  const db = await getD1();
  if (!db) {
    logger.warn('[RevenueAttribution] D1 unavailable for unit attribution');
    return EMPTY_UNIT;
  }

  try {
    const { results } = await db
      .prepare(
        `WITH unit_roi AS (
           SELECT
             cp.id AS content_project_id,
             cp.workspace_id,
             cp.title,
             COALESCE(SUM(rr.revenue_cents), 0) AS revenue_cents,
             COALESCE(SUM(rr.cost_cents), 0) AS cost_cents,
             rr.channel,
             COUNT(*) AS events
           FROM content_projects cp
           LEFT JOIN roi_records rr
             ON rr.entity_type = 'content_project'
            AND rr.entity_id = cp.id
            AND rr.workspace_id = cp.workspace_id
           WHERE cp.workspace_id = ?1
           GROUP BY cp.id, rr.channel
         )
         SELECT
           content_project_id,
           workspace_id,
           title,
           channel,
           0 AS clicks,
           0 AS conversions,
           revenue_cents,
           cost_cents,
           CASE
             WHEN cost_cents > 0
             THEN ROUND(
               CAST(revenue_cents - cost_cents AS REAL)
               / CAST(cost_cents AS REAL), 2)
             ELSE 0
           END AS roi,
           events
         FROM unit_roi
         ORDER BY revenue_cents DESC, title ASC`
      )
      .bind(workspaceId)
      .all<UnitRow>();

    return (results ?? []).map(row => ({
      contentProjectId: row.content_project_id,
      workspaceId: row.workspace_id,
      title: row.title,
      channel: row.channel ?? 'direct',
      clicks: row.clicks,
      conversions: row.conversions,
      revenueCents: row.revenue_cents,
      costCents: row.cost_cents,
      roi: row.roi,
      events: row.events,
    }));
  } catch (err) {
    logger.error('[RevenueAttribution] Unit attribution failed', { error: String(err) });
    return EMPTY_UNIT;
  }
}
