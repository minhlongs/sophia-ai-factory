/**
 * Agent Task Execution Engine
 *
 * Layer: tree/agents
 */

import { updateTaskStatus, appendLog } from '../repository';
import { track } from '@/tree/signals/track';
import { D1Events } from '@/tree/signals/d1-event-types';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import { validateTaskAndAgent } from './validation';
import { resolveEnrichedPrompt } from './prompt-resolution';
import type { AgentTask } from '../types';
import {
  COST_PER_TOKEN,
  recordAgentTaskSuccess,
  recordAgentTaskFailure,
} from './executor-telemetry';

/**
 * Run an agent task inline (sync for Cloudflare Workers free tier).
 * Updates task row with result / error.
 */
export async function runAgent(
  taskId: string,
  orgId: string,
  userTier = 'BASIC',
): Promise<AgentTask> {
  await updateTaskStatus(taskId, orgId, 'running');
  await appendLog({ taskId, action: 'start', payload: { taskId } });

  const { task, agent, apiKey } = await validateTaskAndAgent(
    taskId,
    orgId,
    userTier,
  );
  const { variant, enrichedPrompt } = await resolveEnrichedPrompt(
    agent,
    orgId,
    task.input,
  );

  void track(
    D1Events.AGENT_TASK_START,
    orgId,
    {
      task_id: taskId,
      agent_role: agent.role,
      agent_id: agent.id,
      variant,
    },
    orgId,
  );

  const startMs = Date.now();

  try {
    const prompt = `System: ${enrichedPrompt}\n\nUser: ${task.input}`;
    const output = await resilientChatCompletion(prompt, {
      openRouterKey: apiKey,
      anthropicKey: undefined,
      enableFallback: false,
      model: agent.model,
    });

    const responseTime = Date.now() - startMs;
    const estimatedTokens = await recordAgentTaskSuccess({
      taskId,
      orgId,
      userTier,
      agent,
      variant,
      output,
      responseTime,
    });

    return {
      ...task,
      result: {
        output,
        tokensUsed: estimatedTokens,
        costUsd: COST_PER_TOKEN * estimatedTokens,
        status: 'completed',
      },
    } as AgentTask;
  } catch (err) {
    return recordAgentTaskFailure({
      err,
      taskId,
      orgId,
      agentRole: agent.role,
      variant,
    });
  }
}
