/**
 * Agent Runner — Executes AI agent tasks
 * Layer: forest
 * Purpose: Runs agent tasks by calling OpenRouter and handling results
 */

import type { Tier } from '@/seed/types';
import { assertTierAllowsAgent, AgentTierBlockedError } from './enforcement-gate';
import { getTask, getAgentById, updateTaskResult } from './repository';
import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import {
  resolveAgentVariantConfig,
  recordAgentRunSuccess,
  recordAgentRunFailure,
} from './agent-runner-helpers';

/**
 * Executes an agent task
 */
export async function runAgent(taskId: string, orgId: string, userTier: string): Promise<string> {
  const task = await getTask(taskId, orgId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const agent = await getAgentById(task.agentId);
  if (!agent) throw new Error(`Agent ${task.agentId} not found`);

  try {
    assertTierAllowsAgent(userTier as Tier, agent.role);
  } catch (err) {
    await updateTaskResult(taskId, orgId, {
      status: 'failed',
      output: '',
      errorMessage: err instanceof AgentTierBlockedError ? err.message : 'Tier gate blocked',
    });
    throw err;
  }

  // Fail closed to org BYOK — never spend platform OPENROUTER_API_KEY on customer agent runs.
  const openRouterKey = await resolveUserApiKey(orgId, 'openrouter');
  if (!openRouterKey) {
    await updateTaskResult(taskId, orgId, {
      status: 'failed',
      output: '',
      errorMessage: 'OpenRouter BYOK API key not configured',
    });
    throw new Error('OpenRouter BYOK API key is required to run agent tasks');
  }

  const messages = [
    { role: 'system', content: agent.systemPrompt },
    { role: 'user', content: task.input },
  ];

  const { variant, model, temperature } = await resolveAgentVariantConfig(
    agent.id,
    agent.model,
    orgId,
  );

  if (!shouldAllowRequest('openrouter')) {
    throw new Error('Circuit breaker open for OpenRouter — too many failures');
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterKey}`,
        'HTTP-Referer': process.env.APP_URL || 'https://sophia.agencyos.network',
        'X-Title': 'Sophia AI Factory',
      },
      body: JSON.stringify({ model, messages, temperature, stream: false }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content: string } }[];
      usage?: { completion_tokens: number; prompt_tokens: number; cost?: number };
    };
    const output = data.choices?.[0]?.message?.content || '';

    await recordAgentRunSuccess({
      taskId,
      orgId,
      agent,
      output,
      usage: data.usage,
      model,
      temperature,
      variant,
    });

    return output;
  } catch (err) {
    return recordAgentRunFailure({ err, taskId, orgId, agentRole: agent.role });
  }
}
