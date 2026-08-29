/**
 * Reality Loop v1 — product-learning insights (Phase J).
 *
 * Layer: land (business domain workflow). Imports seed + land only.
 *
 * Read-only aggregation over performance_events (the canonical Reality Loop
 * event store written by tree/performance/loop-events.ts) plus the
 * reality_feedback table (Phase E) and, where available, the Phase H economic
 * snapshot. Every query is workspace-scoped. Missing economic data renders as
 * null, never 0 — 0 means "we measured zero", null means "we have no signal".
 *
 * DB access: createServerClient() (sync, no await on the client itself) —
 * mirrors the creative-economy dashboard modules.
 *
 * @module land/reality-loop/insights
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { aggregateFeedbackByWorkspace } from './feedback-store';
import { getEconomicOutcomes } from './insights-economic';
import { getAgentFailures } from './insights-failures';
import type { RealityLoopInsights } from './insights-types';

// ── Domain types ─────────────────────────────────────────────────────────────
// Types live in insights-types.ts; re-exported here for a single public API.

export type {
  RealityLoopInsights,
  FailureClassCount,
  MemoryInsight,
  EconomicOutcomes,
} from './insights-types';

// ── Single-workspace query ───────────────────────────────────────────────────

/**
 * Build the full product-learning insight bundle for one workspace.
 * Every number traces to a performance_events query (or the feedback /
 * economic tables). Degrades gracefully: a query failure logs and returns a
 * safe partial bundle rather than throwing.
 */
export async function getRealityLoopInsights(
  workspaceId: string,
): Promise<RealityLoopInsights> {
  const empty: RealityLoopInsights = {
    workspaceId,
    missionsCreated: 0,
    missionsCompleted: 0,
    completionRate: null,
    creativeAccepted: 0,
    creativeRejected: 0,
    acceptanceRate: null,
    humanCorrections: 0,
    correctionRate: null,
    agentFailures: [],
    agentFailureTotal: 0,
    missionCostCents: 0,
    memory: { used: 0, corrected: 0, correctionRate: null },
    economic: { revenueCents: null, costCents: null, netCents: null, roiPct: null },
    feedback: null,
  };

  try {
    const db = createServerClient();

    // Mission funnel (Q1, Q8, Q9, Q10) — created vs completed.
    const funnel = await db
      .prepare(
        `SELECT
           SUM(CASE WHEN event_type = 'mission.created' THEN count ELSE 0 END) AS created,
           SUM(CASE WHEN event_type = 'mission.completed' THEN count ELSE 0 END) AS completed
         FROM performance_events
         WHERE workspace_id = ?1
           AND event_type IN ('mission.created', 'mission.completed')`,
      )
      .bind(workspaceId)
      .first<{ created: number | null; completed: number | null }>();

    const missionsCreated = funnel?.created ?? 0;
    const missionsCompleted = funnel?.completed ?? 0;

    // Creative acceptance (Q3) — accepted vs rejected.
    const creative = await db
      .prepare(
        `SELECT
           SUM(CASE WHEN event_type = 'creative.accepted' THEN count ELSE 0 END) AS accepted,
           SUM(CASE WHEN event_type = 'creative.rejected' THEN count ELSE 0 END) AS rejected
         FROM performance_events
         WHERE workspace_id = ?1
           AND event_type IN ('creative.accepted', 'creative.rejected')`,
      )
      .bind(workspaceId)
      .first<{ accepted: number | null; rejected: number | null }>();

    const creativeAccepted = creative?.accepted ?? 0;
    const creativeRejected = creative?.rejected ?? 0;

    // Human corrections (Q6) — creative.edited events.
    const corrections = await db
      .prepare(
        `SELECT SUM(count) AS cnt
         FROM performance_events
         WHERE workspace_id = ?1
           AND event_type = 'creative.edited'`,
      )
      .bind(workspaceId)
      .first<{ cnt: number | null }>();
    const humanCorrections = corrections?.cnt ?? 0;

    // Agent failure taxonomy (Q7) — delegated to insights-failures.ts.
    const { agentFailures, agentFailureTotal } = await getAgentFailures(db, workspaceId);

    // Mission cost (Q4) — value_cents on mission.cost_recorded.
    const cost = await db
      .prepare(
        `SELECT SUM(value_cents) AS cost_cents
         FROM performance_events
         WHERE workspace_id = ?1
           AND event_type = 'mission.cost_recorded'`,
      )
      .bind(workspaceId)
      .first<{ cost_cents: number | null }>();
    const missionCostCents = cost?.cost_cents ?? 0;

    // Memory usage + correction (Q5).
    const memory = await db
      .prepare(
        `SELECT
           SUM(CASE WHEN event_type = 'memory.used' THEN count ELSE 0 END) AS used,
           SUM(CASE WHEN event_type = 'memory.corrected' THEN count ELSE 0 END) AS corrected
         FROM performance_events
         WHERE workspace_id = ?1
           AND event_type IN ('memory.used', 'memory.corrected')`,
      )
      .bind(workspaceId)
      .first<{ used: number | null; corrected: number | null }>();
    const memoryUsed = memory?.used ?? 0;
    const memoryCorrected = memory?.corrected ?? 0;

    // Economic outcomes (Phase H) — nullable, never 0-for-null.
    const economic = await getEconomicOutcomes(db, workspaceId);

    // Feedback aggregates (Phase E).
    const feedback = await aggregateFeedbackByWorkspace(workspaceId);

    // Derived rates — null when denominator is 0 (no signal).
    const completionRate = missionsCreated > 0 ? missionsCompleted / missionsCreated : null;
    const creativeDecisions = creativeAccepted + creativeRejected;
    const acceptanceRate = creativeDecisions > 0 ? creativeAccepted / creativeDecisions : null;
    const correctionRate = missionsCompleted > 0 ? humanCorrections / missionsCompleted : null;
    const memoryCorrectionRate = memoryUsed > 0 ? memoryCorrected / memoryUsed : null;

    return {
      workspaceId,
      missionsCreated,
      missionsCompleted,
      completionRate,
      creativeAccepted,
      creativeRejected,
      acceptanceRate,
      humanCorrections,
      correctionRate,
      agentFailures,
      agentFailureTotal,
      missionCostCents,
      memory: { used: memoryUsed, corrected: memoryCorrected, correctionRate: memoryCorrectionRate },
      economic,
      feedback,
    };
  } catch (err) {
    const error = toError(err);
    logger.error('[RealityLoop] getRealityLoopInsights failed', error, { workspaceId });
    // Degraded partial bundle — every field has a safe default.
    return empty;
  }
}

