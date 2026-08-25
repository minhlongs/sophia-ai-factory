/**
 * Server Action: Get top-N assets by ROI/revenue.
 *
 * Aggregates performance_events by asset_id in the last 30 days.
 * Returns top 10 assets with impressions, revenue, cost, ROI%.
 *
 * Timestamp discipline: performance_events.recorded_at = MILLISECONDS.
 * Cost semantics: mission_completed rows are cost-side (value_cents = costCents).
 *
 * @module land/creative-economy/asset-performance
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { AssetPerformanceRow, DashboardResult } from './types';

const schema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  limit: z.number().min(1).max(50).default(10),
});

/**
 * Get top-N assets by ROI (revenue/cost) for a workspace.
 * Falls back to revenue if cost is zero (ROI = null).
 */
export async function getAssetPerformance(
  input: z.input<typeof schema>
): Promise<DashboardResult<AssetPerformanceRow[]>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const db = createServerClient();

    // Verify workspace membership (IDOR prevention)
    const membership = await db
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(parsed.data.workspaceId, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const nowMs = Date.now();
    const windowStartMs = nowMs - 30 * 24 * 60 * 60 * 1000; // 30 days in ms

    // Aggregate by asset_id
    const rows = await db
      .prepare(
        `SELECT
           asset_id,
           project_id,
           channel,
           SUM(CASE WHEN event_type = 'impression' THEN count ELSE 0 END) AS impressions,
           SUM(CASE WHEN event_type IN ('revenue', 'conversion') THEN value_cents ELSE 0 END) AS revenue_cents,
           SUM(CASE WHEN event_type = 'mission_completed' THEN value_cents ELSE 0 END) AS cost_cents
         FROM performance_events
         WHERE workspace_id = ?1
           AND recorded_at >= ?2
           AND recorded_at <= ?3
           AND asset_id IS NOT NULL
           AND asset_id <> ''
         GROUP BY asset_id, project_id, channel
         ORDER BY
           CASE
             WHEN SUM(CASE WHEN event_type = 'mission_completed' THEN value_cents ELSE 0 END) > 0
             THEN SUM(CASE WHEN event_type IN ('revenue', 'conversion') THEN value_cents ELSE 0 END) * 1.0 /
                  SUM(CASE WHEN event_type = 'mission_completed' THEN value_cents ELSE 0 END)
             ELSE -1
           END DESC,
           SUM(CASE WHEN event_type IN ('revenue', 'conversion') THEN value_cents ELSE 0 END) DESC
         LIMIT ?4`,
      )
      .bind(parsed.data.workspaceId, windowStartMs, nowMs, parsed.data.limit)
      .all<{
        asset_id: string;
        project_id: string | null;
        channel: string | null;
        impressions: number;
        revenue_cents: number;
        cost_cents: number;
      }>();

    const assets = (rows.results ?? []).map((r) => ({
      assetId: r.asset_id,
      projectId: r.project_id ?? '',
      channel: r.channel ?? 'unknown',
      impressions: r.impressions,
      revenueCents: r.revenue_cents,
      costCents: r.cost_cents,
      roiPct: r.cost_cents > 0 ? ((r.revenue_cents - r.cost_cents) / r.cost_cents) * 100 : null,
    }));

    return success(assets);
  } catch (err) {
    const error = toError(err);
    logger.error('[CreativeEconomy] getAssetPerformance failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}