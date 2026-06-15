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
import { logger } from "@/seed/utils/logger-utility";
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
  logger.debug("[spawnAgentFleet] Task start", {
    taskId: task.id,
    tenantId,
    role: task.agentRole,
    tier: task.tier,
    promptLength: task.prompt.length,
  });

  // Fail-fast if breaker is already open — no point dispatching
  if (getBreakerState(FLEET_BREAKER) === "open") {
    logger.warn("[spawnAgentFleet] Circuit breaker open — task skipped", {
      taskId: task.id,
      tenantId,
    });
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

    const durationMs = Date.now() - start;
    logger.info("[spawnAgentFleet] Task completed", {
      taskId: task.id,
      tenantId,
      success: true,
      durationMs,
      retryCount: attempts > 0 ? attempts - 1 : 0,
    });

    return {
      taskId: task.id,
      success: true,
      output,
      durationMs,
      retryCount: attempts > 0 ? attempts - 1 : 0,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.error("[spawnAgentFleet] Task failed", {
      taskId: task.id,
      tenantId,
      error: err instanceof Error ? err.message : String(err),
      durationMs,
      retryCount: attempts > 0 ? attempts - 1 : 0,
    });

    return {
      taskId: task.id,
      success: false,
      error: err instanceof BreakerOpenError
        ? "Circuit breaker open — upstream degraded"
        : err instanceof PromptContractError
          ? `Contract validation: ${err.message}`
          : String(err),
      durationMs,
      retryCount: attempts > 0 ? attempts - 1 : 0,
    };
  }
}

export async function runWithConcurrency(
  tasks: AgentTask[],
  tenantId: string,
  maxConcurrency: number,
): Promise<AgentResult[]> {
  const results: AgentResult[] = new Array(tasks.length);
  const semaphore = new Array(maxConcurrency).fill(null);
  let nextIndex = 0;

  logger.info("[spawnAgentFleet] Starting concurrent execution", {
    tenantId,
    totalTasks: tasks.length,
    maxConcurrency,
  });

  const workers = Array.from({ length: maxConcurrency }).map(async (_, workerId) => {
    while (true) {
      const taskIndex = nextIndex++;
      if (taskIndex >= tasks.length) break;

      const task = tasks[taskIndex];
      const result = await runTask(task, tenantId);
      results[taskIndex] = result;

      const completedCount = results.filter((r): r is AgentResult => r !== undefined).length;
      logger.debug("[spawnAgentFleet] Task finished", {
        tenantId,
        workerId,
        taskIndex,
        taskId: task.id,
        success: result.success,
        completedCount,
        totalTasks: tasks.length,
      });
    }
  });

  await Promise.all(workers);

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;
  logger.info("[spawnAgentFleet] All tasks completed", {
    tenantId,
    total: tasks.length,
    success: successCount,
    failed: failCount,
  });

  return results;
}
