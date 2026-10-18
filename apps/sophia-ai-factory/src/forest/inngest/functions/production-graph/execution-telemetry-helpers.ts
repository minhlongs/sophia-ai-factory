/**
 * Production Graph Runner Telemetry & Spend Helpers.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/execution-telemetry-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { recordSpend } from '@/tree/mission/repository';
import { newPerformanceEventId, recordPerformanceEvent } from '@/tree/performance';

/** Non-fatal spend recording — a ledger write failure must not lose the run. */
export async function recordSpendSafe(
  missionId: string,
  amountCents: number,
): Promise<void> {
  try {
    await recordSpend(missionId, amountCents);
  } catch (err) {
    logger.warn('productionGraphRunner: recordSpend failed (non-fatal)', {
      missionId,
      amountCents,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Non-fatal per-node performance event. */
export async function recordNodePerformance(args: {
  workspaceId: string;
  missionId: string;
  graphRunId: string;
  nodeId: string;
  agentSlug: string;
  costCents: number;
  totalTokens: number;
  durationMs: number;
  recordedAt: number;
}): Promise<void> {
  try {
    await recordPerformanceEvent({
      id: newPerformanceEventId(),
      workspaceId: args.workspaceId,
      assetId: '',
      projectId: '',
      entityType: 'mission',
      entityId: args.missionId,
      channel: 'agent',
      eventType: 'graph_node_completed',
      count: 1,
      valueCents: args.costCents,
      rawData: {
        graphRunId: args.graphRunId,
        nodeId: args.nodeId,
        agentSlug: args.agentSlug,
        totalTokens: args.totalTokens,
        durationMs: args.durationMs,
      },
      recordedAt: args.recordedAt,
    });
  } catch (err) {
    logger.warn('productionGraphRunner: performance event failed (non-fatal)', {
      graphRunId: args.graphRunId,
      nodeId: args.nodeId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
