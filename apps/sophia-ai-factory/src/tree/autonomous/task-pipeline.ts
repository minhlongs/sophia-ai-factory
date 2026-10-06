/**
 * Autonomous Engine Task Prioritization & Pipeline Orchestrator
 *
 * Layer: tree/autonomous (Pure domain engine, zero side effects)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module tree/autonomous/task-pipeline
 */

import type {
  AutonomousScheduleTaskRow,
  ScheduledTaskExecution,
} from '@/seed/types/autonomous-engine';

/**
 * Known default skill dependencies based on openclaw.json:
 * - affiliate-scout: discovers offers (no upstream dependencies)
 * - content-producer: creates videos based on offers (depends on 'affiliate-scout' or 'affiliate_offers')
 * - auto-publisher: syndicates videos to channels (depends on 'content-producer' or 'video_ready')
 */
export const DEFAULT_SKILL_DEPENDENCIES: Record<string, string[]> = {
  'affiliate-scout': [],
  'content-producer': ['affiliate-scout'],
  'auto-publisher': ['content-producer'],
};

export const DEFAULT_SKILL_PRIORITIES: Record<string, number> = {
  'auto-publisher': 1,      // Highest: syndicating ready content to channels
  'content-producer': 2,    // Medium: rendering and voice generation
  'affiliate-scout': 3,     // Lowest: background discovery and scraping
};

/**
 * Resolves effective priority for a scheduled task execution.
 * Lower number = higher priority (1 is highest).
 */
function resolveTaskPriority(task: ScheduledTaskExecution): number {
  if (typeof task.priority === 'number') {
    return task.priority;
  }
  return DEFAULT_SKILL_PRIORITIES[task.skillName] ?? 99;
}

/**
 * Deterministically sorts scheduled task executions:
 * 1. Priority ascending (1 = highest)
 * 2. scheduledTime ascending (earliest scheduled first)
 * 3. taskId ascending (tie-breaker)
 */
export function sortTasksByPriority(
  tasks: ScheduledTaskExecution[]
): ScheduledTaskExecution[] {
  return [...tasks].sort((a, b) => {
    const prioA = resolveTaskPriority(a);
    const prioB = resolveTaskPriority(b);
    if (prioA !== prioB) {
      return prioA - prioB;
    }
    if (a.scheduledTime !== b.scheduledTime) {
      return a.scheduledTime - b.scheduledTime;
    }
    return a.taskId.localeCompare(b.taskId);
  });
}

/**
 * Sorts database task rows by priority, next_run_at, and skill_name.
 */
export function sortScheduleTasks(
  tasks: AutonomousScheduleTaskRow[]
): AutonomousScheduleTaskRow[] {
  return [...tasks].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const runA = a.next_run_at ?? 0;
    const runB = b.next_run_at ?? 0;
    if (runA !== runB) {
      return runA - runB;
    }
    return a.skill_name.localeCompare(b.skill_name);
  });
}

export interface PipelineDependencyResult {
  runnable: string[];
  blocked: string[];
  missingDependencies: Record<string, string[]>;
}

/**
 * Validates whether requested skills can execute given available prerequisites or outputs.
 *
 * @param skillsToRun List of skill names requested for this cycle
 * @param availableOutputs Set or array of satisfied dependencies / prerequisite outputs
 * @param customDependencies Optional dependency map overriding defaults
 */
export function validatePipelineDependencies(
  skillsToRun: string[],
  availableOutputs: Set<string> | string[] = new Set(),
  customDependencies: Record<string, string[]> = DEFAULT_SKILL_DEPENDENCIES
): PipelineDependencyResult {
  const satisfied = new Set(
    Array.isArray(availableOutputs) ? availableOutputs : Array.from(availableOutputs)
  );

  const runnable: string[] = [];
  const blocked: string[] = [];
  const missingDependencies: Record<string, string[]> = {};

  for (const skill of skillsToRun) {
    const required = customDependencies[skill] ?? [];
    const missing = required.filter((dep) => !satisfied.has(dep));

    if (missing.length === 0) {
      runnable.push(skill);
      // Once a skill is runnable, it contributes itself as available for downstream in sequential pipelines
      satisfied.add(skill);
    } else {
      blocked.push(skill);
      missingDependencies[skill] = missing;
    }
  }

  return { runnable, blocked, missingDependencies };
}
