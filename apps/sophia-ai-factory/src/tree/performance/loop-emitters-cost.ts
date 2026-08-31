/**
 * Reality Loop v1 — memory + cost emitters (Phase C).
 *
 * Layer: tree (domain-specific reusable). Imports seed only.
 * Side-channel, non-fatal, idempotent writes into the EXISTING
 * `performance_events` table via `recordPerformanceEventIdempotent`.
 * Privacy: metrics payload = IDs, enums, counts, cents only.
 *
 * @module tree/performance/loop-emitters-cost
 */

import { emitLoopEvent, type LoopEventContext } from './loop-events';

/**
 * Q5 — Creative Memory retrieved and used in an agent run. Fires from
 * persistAgentLearning (side-channel, scope:campaign, scopeId:missionId).
 * Answers: "does memory help?" (correlate with acceptance rate).
 */
export async function emitMemoryUsed(args: LoopEventContext & {
  missionId: string;
  agentId: string;
  runId: string;
  confidence: 'high' | 'medium' | 'low';
  memoryCount: number;
}): Promise<boolean> {
  return emitLoopEvent('memory.used', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'memory',
    metrics: {
      agent_id: args.agentId,
      run_id: args.runId,
      confidence: args.confidence,
      memory_count: args.memoryCount,
    },
  });
}

/**
 * Q5 — Creative Memory corrected by human. Fires on human correction.
 * Answers: "memory correction rate < 10%?" (Phase F gate).
 *
 * DEFERRAL NOTE (Phase 2 Wiring): No human-correction hook exists in
 * agent-context.ts or persist-agent-learning. This emitter has no production
 * call site yet. Wire it in when the memory-correction UI ships — wiring to
 * a fake site would produce garbage data.
 */
export async function emitMemoryCorrected(args: LoopEventContext & {
  missionId: string;
  agentId: string;
  runId: string;
  correctionType: string;
  previousConfidence: 'high' | 'medium' | 'low';
}): Promise<boolean> {
  return emitLoopEvent('memory.corrected', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'memory',
    metrics: {
      agent_id: args.agentId,
      run_id: args.runId,
      correction_type: args.correctionType,
      previous_confidence: args.previousConfidence,
    },
  });
}

/**
 * Q4 — mission cost recorded. Fires from recordSpend (side-channel).
 * Answers: "cost per mission" (Scorecard group 6 + 8).
 */
export async function emitMissionCostRecorded(args: LoopEventContext & {
  missionId: string;
  amountCents: number;
  /** Running total cents after this spend. */
  totalSpentCents: number;
  /** Budget cents (0 if unbounded). */
  budgetCents: number;
  nodeId?: string;
  agentSlug?: string;
}): Promise<boolean> {
  return emitLoopEvent('mission.cost_recorded', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'cost',
    valueCents: args.amountCents,
    metrics: {
      total_spent_cents: args.totalSpentCents,
      budget_cents: args.budgetCents,
      ...(args.nodeId ? { node_id: args.nodeId } : {}),
      ...(args.agentSlug ? { agent_slug: args.agentSlug } : {}),
    },
  });
}