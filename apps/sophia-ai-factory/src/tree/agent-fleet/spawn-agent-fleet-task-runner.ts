/**
 * spawn-agent-fleet-task-runner.ts — Low-level BYOK task runner and retry wrapper
 * Part of Phase 12 OpenClaw orchestration
 */

import {
  validatePromptContract,
  PromptContractError,
} from "@/seed/validators/agent-prompt-contracts";
import {
  withBreaker,
  BreakerOpenError,
  FLEET_BREAKER,
} from "@/seed/utils/in-memory-circuit-breaker";
import { withRetry } from "@/seed/utils/retry-with-backoff";
import { resilientChatCompletion } from "@/seed/inference/openrouter-client";
import { resolveUserApiKey } from "@/tree/byok/resolve-user-api-key";
import type { AgentTask } from "./spawn-agent-fleet";

export async function localExecutor(
  task: AgentTask,
  tenantId: string,
): Promise<unknown> {
  const apiKey = await resolveUserApiKey(tenantId, "openrouter");

  if (!apiKey) {
    // BYOK: no key configured — return stub queued status
    return {
      taskId: task.id,
      status: "queued",
      prompt: task.prompt,
      tier: task.tier ?? "standard",
      note: "OpenRouter API key not configured. Configure via Setup Wizard.",
    };
  }

  const model = task.tier === "max" ? "anthropic/claude-opus-4" : "anthropic/claude-sonnet-4";
  const content = await resilientChatCompletion(task.prompt, {
    openRouterKey: apiKey,
    anthropicKey: undefined,
    enableFallback: false,
    model,
  });

  return {
    taskId: task.id,
    status: "completed",
    prompt: task.prompt,
    tier: task.tier ?? "standard",
    output: content,
  };
}

export function formatTaskError(err: unknown): string {
  if (err instanceof BreakerOpenError) {
    return "Circuit breaker open — upstream degraded";
  }
  if (err instanceof PromptContractError) {
    return `Contract validation: ${err.message}`;
  }
  return String(err);
}

export async function executeTaskWithRetry(
  task: AgentTask,
  tenantId: string,
  onAttempt: () => void,
): Promise<unknown> {
  if (task.promptContract !== undefined && task.agentRole !== undefined) {
    validatePromptContract(task.agentRole, task.promptContract);
  }

  const enrichedTask: AgentTask = {
    ...task,
    context: { ...task.context, tenantId },
  };

  return withRetry(
    () => {
      onAttempt();
      return withBreaker(FLEET_BREAKER, () => localExecutor(enrichedTask, tenantId));
    },
    { maxRetries: 3, baseDelayMs: 1_000, maxDelayMs: 10_000 },
  );
}
