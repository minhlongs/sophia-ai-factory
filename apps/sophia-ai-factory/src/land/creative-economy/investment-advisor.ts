/**
 * Server Action: Get ranked investment advice for a workspace.
 *
 * Composes roi-modeling aggregation (performance_events, MILLISECONDS) with
 * the learning_velocity table (precomputed by the daily cron) and ranks each
 * (entityType, entityId, channel) investment by composite score.
 *
 * @module land/creative-economy/investment-advisor
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  joinVelocity,
  rankInvestments,
  toPerfEvents,
  type InvestmentAdviceRow,
} from './investment-advisor-math';
import {
  REVENUE_EVENT_TYPES,
  COST_EVENT_TYPE,
  aggregateRoiByEntity,
  windowBoundsMs,
} from './roi-modeling';
import type { DashboardResult } from './types';

const schema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  windowDays: z.number().int().min(1).max(90).default(30),
});

interface RawEventRow {
  entity_type: string;
  entity_id: string;
  channel: string | null;
  event_type: string;
  value_cents: number | null;
}

interface VelocityRow {
  entity_type: string;
  channel: string;
  velocity_score: number;
}

/**
 * Get ranked investment advice: ROI per entity joined with learning velocity,
 * scored and ordered deterministically.
 */
export async function getInvestmentAdvice(
  input: z.input<typeof schema>
): Promise<DashboardResult<InvestmentAdviceRow[]>> {
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
    const { startMs, endMs } = windowBoundsMs(nowMs, parsed.data.windowDays);

    const eventTypes = [...REVENUE_EVENT_TYPES, COST_EVENT_TYPE];
    const placeholders = eventTypes.map((_, i) => `?${i + 4}`).join(', ');

    const events = await db
      .prepare(
        `SELECT entity_type, entity_id, channel, event_type, value_cents
         FROM performance_events
         WHERE workspace_id = ?1
           AND recorded_at >= ?2
           AND recorded_at <= ?3
           AND event_type IN (${placeholders})`,
      )
      .bind(parsed.data.workspaceId, startMs, endMs, ...eventTypes)
      .all<RawEventRow>();

    const roiRows = aggregateRoiByEntity(toPerfEvents(events.results ?? []));

    // Latest velocity per (entity_type, channel) — table may be empty.
    const velocityRows = await db
      .prepare(
        `SELECT entity_type, channel, velocity_score
         FROM learning_velocity
         WHERE workspace_id = ?1
         ORDER BY window_end_ms DESC`,
      )
      .bind(parsed.data.workspaceId)
      .all<VelocityRow>();

    const velocityByKey = new Map<string, number>();
    for (const row of velocityRows.results ?? []) {
      const key = `${row.entity_type}:${row.channel}`;
      if (!velocityByKey.has(key)) velocityByKey.set(key, row.velocity_score);
    }

    return success(rankInvestments(joinVelocity(roiRows, velocityByKey)));
  } catch (err) {
    const error = toError(err);
    logger.error('[CreativeEconomy] getInvestmentAdvice failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
