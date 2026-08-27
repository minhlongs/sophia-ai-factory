/**
 * Server Action: Get 30-day revenue/cost/net summary.
 *
 * Reads performance_events for the workspace in the last 30 days.
 * Revenue = sum of value_cents where event_type in ('revenue', 'conversion', 'impression').
 * Cost    = sum of value_cents where event_type = 'mission_completed' (producer writes cost here).
 *
 * Timestamp discipline: performance_events.recorded_at = MILLISECONDS.
 *
 * @module land/creative-economy/dashboard-summary
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { computeRoi } from './roi-modeling';
import type { DashboardSummary, DashboardResult } from './types';

const schema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

/**
 * Get 30-day revenue/cost/net aggregate for a workspace.
 * Returns { revenueCents, costCents, netCents, eventCount, windowDays: 30 }.
 */
export async function getDashboardSummary(
  input: z.infer<typeof schema>
): Promise<DashboardResult<DashboardSummary>> {
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

    // Single query: revenue events + cost events (mission_completed)
    const result = await db
      .prepare(
        `SELECT
           SUM(CASE WHEN event_type IN ('revenue', 'conversion', 'impression') THEN value_cents ELSE 0 END) AS revenue_cents,
           SUM(CASE WHEN event_type = 'mission_completed' THEN value_cents ELSE 0 END) AS cost_cents,
           COUNT(*) AS event_count
         FROM performance_events
         WHERE workspace_id = ?1
           AND recorded_at >= ?2
           AND recorded_at <= ?3`,
      )
      .bind(parsed.data.workspaceId, windowStartMs, nowMs)
      .first<{ revenue_cents: number | null; cost_cents: number | null; event_count: number }>();

    const revenueCents = result?.revenue_cents ?? 0;
    const costCents = result?.cost_cents ?? 0;
    const netCents = revenueCents - costCents;
    const eventCount = result?.event_count ?? 0;

    return success({
      revenueCents,
      costCents,
      netCents,
      eventCount,
      windowDays: 30,
      roiPct: computeRoi(revenueCents, costCents),
    });
  } catch (err) {
    const error = toError(err);
    logger.error('[CreativeEconomy] getDashboardSummary failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}