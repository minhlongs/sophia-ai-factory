/**
 * Server Action: Get learning velocity data points for a workspace.
 *
 * Reads the precomputed learning_velocity table (written daily by
 * forest/inngest/functions/learning-velocity-cron.ts). If the table is empty
 * for this workspace (cron hasn't run yet), falls back to computing a fresh
 * 7-day velocity per (entity_type, channel) using the shared scoring math in
 * velocity-math.ts so the dashboard never shows an empty chart just because
 * a cron hasn't fired.
 *
 * Timestamp discipline: learning_velocity + performance_events = MILLISECONDS.
 *
 * @module land/creative-economy/learning-velocity
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { createServerClient } from '@/seed/db/client';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { computeFreshLearningVelocityFallback } from './learning-velocity-fallback';
import type { VelocityPoint, DashboardResult } from './types';

const schema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

/** Mirror of forest's constants — drift-guarded by unit test. */
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7-day window
const EARLY_RATIO = 0.4; // first 40% vs last 60%
const MIN_EVENTS = 4;

interface VelocityRow {
  entity_type: string;
  channel: string;
  velocity_score: number;
  event_count: number;
  window_start_ms: number;
  window_end_ms: number;
}

export async function getLearningVelocity(
  input: z.infer<typeof schema>
): Promise<DashboardResult<VelocityPoint[]>> {
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
    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id, db);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Primary path: read precomputed rows (latest window per combo)
    const rows = await db
      .prepare(
        `SELECT entity_type, channel, velocity_score, event_count,
                window_start_ms, window_end_ms
         FROM learning_velocity
         WHERE workspace_id = ?1
         ORDER BY window_end_ms DESC`,
      )
      .bind(parsed.data.workspaceId)
      .all<VelocityRow>();

    const precomputed = (rows.results ?? []).map((r) => ({
      entityType: r.entity_type,
      channel: r.channel,
      velocityScore: r.velocity_score,
      eventCount: r.event_count,
      windowStartMs: r.window_start_ms,
      windowEndMs: r.window_end_ms,
    }));

    if (precomputed.length > 0) {
      return success(precomputed);
    }

    const points = await computeFreshLearningVelocityFallback(db, parsed.data.workspaceId, {
      lookbackMs: LOOKBACK_MS,
      earlyRatio: EARLY_RATIO,
      minEvents: MIN_EVENTS,
    });

    return success(points);
  } catch (err) {
    const error = toError(err);
    logger.error('[CreativeEconomy] getLearningVelocity failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
