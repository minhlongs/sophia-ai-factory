/**
 * Agent Mission Prep — resolves definition, mission budget, BYOK providers, and AgentContext
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/agent-ops/agent-mission-prep
 */

import { logger } from '@/seed/utils/logger-utility';
import { agentDefinitionRegistry } from '@/tree/agent-protocol';
import { buildProviders } from '@/forest/ai/provider-factory';
import { getMission } from '@/tree/mission/repository';
import type { AgentContext } from '@/seed/types/creative-domain';
import {
  toAutonomyLevel,
  loadWorkspaceIdentity,
  loadMissionMemories,
} from '../agent-context';
import { markRunFailed } from './step-orchestrator';

export async function prepareAgentMissionExecution(params: {
  runId: string;
  agentId: string;
  missionId: string;
  workspaceId: string;
  autonomyLevel: number | undefined;
}) {
  const { runId, agentId, missionId, workspaceId, autonomyLevel } = params;

  const definition = agentDefinitionRegistry.get(agentId);
  if (!definition) {
    logger.error('agentMissionExecutor: agent not found in registry', { runId, agentId });
    await markRunFailed(runId, `Agent ${agentId} not registered`, { code: 'AGENT_NOT_FOUND', agentId });
    throw new Error(`Agent ${agentId} not registered`);
  }

  const mission = await getMission(missionId);
  if (!mission) {
    logger.error('agentMissionExecutor: mission not found', { runId, missionId });
    await markRunFailed(runId, `Mission ${missionId} not found`, { code: 'MISSION_NOT_FOUND', missionId });
    throw new Error(`Mission ${missionId} not found`);
  }

  const budgetDeltaCents = mission.budgetCents - mission.spentCents;
  const budgetRemainingCents = Math.max(0, budgetDeltaCents);
  if (budgetRemainingCents <= 0) {
    logger.error('agentMissionExecutor: budget exceeded', {
      runId,
      missionId,
      budgetRemainingCents,
      budgetDeltaCents,
    });
    await markRunFailed(runId, 'Mission budget exhausted', {
      code: 'BUDGET_EXCEEDED',
      budgetRemainingCents: 0,
    });
    throw new Error('Mission budget exhausted');
  }

  const providerResult = await buildProviders({
    userId: mission.creatorId,
    providers: [
      { id: 'openrouter', label: 'OpenRouter' },
      { id: 'anthropic', label: 'Anthropic' },
    ],
    autoRegister: true,
  });

  const creativeIdentity = await loadWorkspaceIdentity(workspaceId);
  const memory = await loadMissionMemories(mission);

  const context: AgentContext = {
    workspaceId,
    missionId,
    creativeIdentity,
    memory,
    autonomyLevel: toAutonomyLevel(autonomyLevel),
    budgetRemainingCents,
    correlationId: runId,
  };

  return { definition, mission, providerResult, context };
}
