/**
 * spawn-agent-fleet.ts — Parallel/sequential agent fleet executor
 * Phase 12: OpenClaw Orchestrator primitive
 *
 * @deprecated 2026-08-16 — superseded by `@/tree/agent-protocol/agent-executor`.
 * This fleet executor bypasses AgentProtocol: it does not enforce
 * AutonomyLevel approval gates, record provenance per run, or use the typed
 * agent protocol. OpenClaw callers that need autonomy-aware execution should
 * migrate to `executeAgent()`.
 * Removal permitted after 2026-09-16. Tracked in
 * `@/seed/types/deprecation-markers` (DEPRECATION_REGISTRY).
 */

import { audit } from "./audit";
import { DEFAULT_ITERATION_LIMITS } from "@/seed/types/multi-agent";
import { checkIterationBudget } from "@/tree/sop/multi-agent-coordinator-helpers";
import { logger } from "@/seed/utils/logger-utility";
import { runTask, runWithConcurrency } from "./spawn-agent-fleet-executor";
import {
  OpenclawTenantMissingError,
  type AgentTask,
  type AgentResult,
  type SpawnFleetOptions,
} from "./spawn-agent-fleet-types";

export { OpenclawTenantMissingError };
export type { AgentTask, AgentResult, SpawnFleetOptions };

/**
 * Spawn a fleet of agents for a given tenant.
 *
 * @param tasks  Array of agent tasks to execute
 * @param opts   Fleet options (tenantId required)
 * @returns      Array of results, one per task, in input order
 */
export async function spawnAgentFleet(
  tasks: AgentTask[],
  opts: SpawnFleetOptions,
): Promise<AgentResult[]> {
  if (!opts.tenantId) {
    throw new OpenclawTenantMissingError();
  }

  const {
    tenantId,
    actor = "system",
    parallel = true,
    maxConcurrency = 5,
    iterationLimits = DEFAULT_ITERATION_LIMITS,
  } = opts;

  const fleetBudget = checkIterationBudget(0, tasks.length, iterationLimits);
  if (!fleetBudget.canProceed) {
    logger.warn("[spawnAgentFleet] Fleet iteration limit prevents dispatch", {
      taskCount: tasks.length,
      limit: iterationLimits.maxTotalIterations,
      reason: fleetBudget.reason,
    });
    return tasks.map((t) => ({
      taskId: t.id,
      success: false,
      error: `Iteration limit: ${fleetBudget.reason}`,
      durationMs: 0,
      retryCount: 0,
    }));
  }

  await audit({
    tenantId,
    actor,
    action: "fleet.spawn",
    resource: "agent-fleet",
    metadata: {
      taskCount: tasks.length,
      parallel,
      maxConcurrency,
      taskIds: tasks.map((t) => t.id),
    },
  });

  let results: AgentResult[];

  if (!parallel) {
    results = [];
    for (const task of tasks) {
      results.push(await runTask(task, tenantId));
    }
  } else {
    results = await runWithConcurrency(tasks, tenantId, maxConcurrency);
  }

  await audit({
    tenantId,
    actor,
    action: "fleet.complete",
    resource: "agent-fleet",
    metadata: {
      taskCount: tasks.length,
      successCount: results.filter((r) => r.success).length,
      failCount: results.filter((r) => !r.success).length,
    },
  });

  return results;
}
