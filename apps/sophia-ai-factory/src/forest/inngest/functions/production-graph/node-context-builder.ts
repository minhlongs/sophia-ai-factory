/**
 * Production Graph Agent Execution Context Builder.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/node-context-builder
 */

import type { AgentContext } from '@/seed/types/creative-domain';
import type { Mission } from '@/seed/types/creative-economy';
import type { EffectiveAutonomyPolicy } from '@/tree/autonomy/effective-autonomy';
import {
  toAutonomyLevel,
  initAgentRun,
  loadWorkspaceIdentity,
  loadMissionMemories,
} from '../agent-context';
import { emitAgentStarted } from '@/tree/performance/loop-emitters-runner';

export interface SetupAgentContextParams {
  agentRunId: string;
  agentSlug: string;
  inputJson?: Record<string, unknown>;
  workspaceId: string;
  missionId: string;
  graphRunId: string;
  nodeId: string;
  policy: EffectiveAutonomyPolicy;
  mission: Mission;
  budgetRemainingCents: number;
  approvedActionIds?: string[];
  nowMs: () => number;
}

export async function setupAgentExecutionContext(
  params: SetupAgentContextParams,
): Promise<AgentContext> {
  const {
    agentRunId,
    agentSlug,
    inputJson,
    workspaceId,
    missionId,
    graphRunId,
    nodeId,
    policy,
    mission,
    budgetRemainingCents,
    approvedActionIds,
    nowMs,
  } = params;

  await initAgentRun({
    runId: agentRunId,
    agentId: agentSlug,
    workspaceId,
    missionId,
    autonomyLevel: policy.storedLevel,
    inputJson,
  });

  await emitAgentStarted({
    workspaceId,
    missionId,
    graphRunId,
    nodeId,
    agentSlug,
    agentRunId,
    recordedAt: nowMs(),
  });

  const [creativeIdentity, memory] = await Promise.all([
    loadWorkspaceIdentity(workspaceId),
    loadMissionMemories(mission),
  ]);

  return {
    workspaceId,
    missionId,
    creativeIdentity,
    memory,
    autonomyLevel: toAutonomyLevel(policy.storedLevel),
    budgetRemainingCents,
    correlationId: agentRunId,
    approvedActionIds,
    effectivePolicy: policy,
  };
}
