/**
 * spawn-agent-fleet-executor.ts — Execution primitives for agent spawner
 * Part of Phase 12 OpenClaw orchestration
 */

import {
  validatePromptContract,
  PromptContractError,
} from "@/seed/validators/agent-prompt-contracts";
import { withBreaker, BreakerOpenError, getBreakerState } from "@/seed/utils/circuit-breaker";
import { withRetry } from "@/seed/utils/retry-with-backoff";
import type { AgentTask, AgentResult } from "./spawn-agent-fleet";

export const FLEET_BREAKER = "agent-fleet";

/** Local task executor — runs the task prompt through a simple handler. */
export async function localExecutor(
  task: AgentTask,
  _tenantId: string,
): Promise<unknown> {
  return {
    taskId: task.id,
    status: "queued",
    prompt: task.prompt,
    tier: task.tier ?? "standard",
  };
}

export async function runTask(
  task: AgentTask,
  tenantId: string,
): Promise<AgentResult> {
  const start = Date.now();

  // Fail-fast if breaker is already open — no point dispatching
  if (getBreakerState(FLEET_BREAKER) === "open") {
    return {
      taskId: task.id,
      success: false,
      error: "Skipped — circuit breaker open",
      durationMs: 0,
      retryCount: 0,
    };
  }

  let attempts = 0;

  try {
    // Validate typed prompt contract before dispatch (opt-in: both fields required)
    if (task.promptContract !== undefined && task.agentRole !== undefined) {
      validatePromptContract(task.agentRole, task.promptContract);
    }

    const enrichedTask: AgentTask = {
      ...task,
      context: { ...task.context, tenantId },
    };

    const output = await withRetry(
      () => {
        attempts++;
        return withBreaker(FLEET_BREAKER, () => localExecutor(enrichedTask, tenantId));
      },
      { maxRetries: 3, baseDelayMs: 1_000, maxDelayMs: 10_000 },
    );

    return {
      taskId: task.id,
      success: true,
      output,
      durationMs: Date.now() - start,
      retryCount: attempts > 0 ? attempts - 1 : 0,
    };
  } catch (err) {
    return {
      taskId: task.id,
      success: false,
      error: err instanceof BreakerOpenError
        ? "Circuit breaker open — upstream degraded"
        : err instanceof PromptContractError
          ? `Contract validation: ${err.message}`
          : String(err),
      durationMs: Date.now() - start,
      retryCount: attempts > 0 ? attempts - 1 : 0,
    };
  }
}

export async function runWithConcurrency(
  tasks: AgentTask[],
  tenantId: string,
  maxConcurrency: number,
): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  const chunks: AgentTask[][] = [];
  for (let i = 0; i < tasks.length; i += maxConcurrency) {
    chunks.push(tasks.slice(i, i + maxConcurrency));
  }
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map((t) => runTask(t, tenantId)));
    results.push(...chunkResults);
  }
  return results;
}
