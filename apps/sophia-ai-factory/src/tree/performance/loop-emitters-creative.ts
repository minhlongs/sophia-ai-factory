/**
 * Reality Loop v1 — creative emitters (Phase C).
 *
 * Layer: tree (domain-specific reusable). Imports seed only.
 * Side-channel, non-fatal, idempotent writes into the EXISTING
 * `performance_events` table via `recordPerformanceEventIdempotent`.
 * Privacy: metrics payload = IDs, enums, counts only.
 *
 * @module tree/performance/loop-emitters-creative
 */

import { emitLoopEvent, type LoopEventContext } from './loop-events';

/**
 * Q3 — creative output accepted by human. Fires on creative approval.
 * Answers: "does creative quality improve across missions?".
 */
export async function emitCreativeAccepted(args: LoopEventContext & {
  missionId: string;
  graphRunId: string;
  nodeId: string;
  assetId: string;
  agentSlug: string;
}): Promise<boolean> {
  return emitLoopEvent('creative.accepted', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'creative',
    metrics: {
      graph_run_id: args.graphRunId,
      node_id: args.nodeId,
      asset_id: args.assetId,
      agent_slug: args.agentSlug,
    },
  });
}

/**
 * Q3 — creative output edited by human before acceptance. Fires on edit.
 * Answers: "how much human rework is needed?".
 *
 * DEFERRAL NOTE (Phase 2 Wiring): No edit/save UI flow exists in
 * creative-mission/actions.ts or forest. This emitter has no production call
 * site yet. Wire it in when the creative-edit UI ships — wiring to a fake
 * site would produce garbage data.
 */
export async function emitCreativeEdited(args: LoopEventContext & {
  missionId: string;
  graphRunId: string;
  nodeId: string;
  assetId: string;
  agentSlug: string;
  editCount: number;
}): Promise<boolean> {
  return emitLoopEvent('creative.edited', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'creative',
    metrics: {
      graph_run_id: args.graphRunId,
      node_id: args.nodeId,
      asset_id: args.assetId,
      agent_slug: args.agentSlug,
      edit_count: args.editCount,
    },
  });
}

/**
 * Q3/Q6 — creative output rejected by human. Fires on creative rejection.
 * Answers: "where does creative fail?".
 */
export async function emitCreativeRejected(args: LoopEventContext & {
  missionId: string;
  graphRunId: string;
  nodeId: string;
  assetId: string;
  agentSlug: string;
  reasonCode: string;
}): Promise<boolean> {
  return emitLoopEvent('creative.rejected', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'creative',
    metrics: {
      graph_run_id: args.graphRunId,
      node_id: args.nodeId,
      asset_id: args.assetId,
      agent_slug: args.agentSlug,
      reason_code: args.reasonCode,
    },
  });
}