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
 * @module land/reality-loop/insights
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { aggregateFeedbackByWorkspace } from './feedback-store';
import { getEconomicOutcomes } from './insights-economic';
import { getAgentFailures } from './insights-failures';
import {
  createEmptyRealityLoopInsights,
  queryWorkspaceEventRollup,
} from './insights-queries';
import type { RealityLoopInsights } from './insights-types';

export type {
  RealityLoopInsights,
  FailureClassCount,
  MemoryInsight,
  EconomicOutcomes,
} from './insights-types';

/**
 * Build the full product-learning insight bundle for one workspace.
 * Every number traces to a performance_events query (or the feedback /
 * economic tables). Degrades gracefully: a query failure logs and returns a
 * safe partial bundle rather than throwing.
 */
export async function getRealityLoopInsights(
  workspaceId: string,
): Promise<RealityLoopInsights> {
  const empty = createEmptyRealityLoopInsights(workspaceId);

  try {
    const db = createServerClient();
    const rollup = await queryWorkspaceEventRollup(db, workspaceId);
    const { agentFailures, agentFailureTotal } = await getAgentFailures(db, workspaceId);
    const economic = await getEconomicOutcomes(db, workspaceId);
    const feedback = await aggregateFeedbackByWorkspace(workspaceId);

    const {
      missionsCreated,
      missionsCompleted,
      creativeAccepted,
      creativeRejected,
      humanCorrections,
      missionCostCents,
      memoryUsed,
      memoryCorrected,
    } = rollup;

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
    return empty;
  }
}
