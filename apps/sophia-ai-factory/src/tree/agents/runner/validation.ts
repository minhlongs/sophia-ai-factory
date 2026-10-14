/**
 * Agent Task and Tier Validation
 *
 * Layer: tree/agents
 */

import { getTask, getAgentById, updateTaskResult } from '../repository';
import { track } from '@/tree/signals/track';
import { D1Events } from '@/tree/signals/d1-event-types';
import { assertTierAllowsAgent, AgentTierBlockedError } from '../enforcement-gate';
import type { AgentTask } from '../types';

export type AgentRecord = NonNullable<Awaited<ReturnType<typeof getAgentById>>>;

export interface ValidatedAgentTaskContext {
  task: AgentTask;
  agent: AgentRecord;
  apiKey: string;
}

export async function validateTaskAndAgent(
  taskId: string,
  orgId: string,
  userTier: string,
): Promise<ValidatedAgentTaskContext> {
  const task = await getTask(taskId, orgId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const agent = await getAgentById(task.agentId);
  if (!agent) {
    await updateTaskResult(taskId, orgId, {
      output: '',
      tokensUsed: 0,
      costUsd: 0,
      status: 'failed',
      errorMessage: `Agent ${task.agentId} not found`,
    });
    throw new Error(`Agent ${task.agentId} not found`);
  }

  try {
    assertTierAllowsAgent(userTier, agent.role);
  } catch (gateErr) {
    if (gateErr instanceof AgentTierBlockedError) {
      await updateTaskResult(taskId, orgId, {
        output: '',
        tokensUsed: 0,
        costUsd: 0,
        status: 'failed',
        errorMessage: gateErr.message,
      });
      void track(
        D1Events.AGENT_TASK_FAIL,
        orgId,
        {
          task_id: taskId,
          agent_role: agent.role,
          variant: 'control',
          error_class: 'tier_blocked',
        },
        orgId,
      );
    }
    throw gateErr;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const errMsg = 'OPENROUTER_API_KEY not configured';
    await updateTaskResult(taskId, orgId, {
      output: '',
      tokensUsed: 0,
      costUsd: 0,
      status: 'failed',
      errorMessage: errMsg,
    });
    throw new Error(errMsg);
  }

  return { task, agent, apiKey };
}
