/**
 * Supervisor Agent — 3-step hardcoded workflow constants (MVP)
 *
 * Linear chain: create_plan → execute_development → run_tests
 * No DAG branching in MVP scope.
 *
 * @deprecated 2026-08-16 — duplicate of `@/land/workflows/supervisor-steps`.
 * The forest copy is the hardcoded 3-step MVP; land copy is the pluggable
 * wrapper around `seed/config/workflow-presets` (WORKFLOW_PRESETS). The land
 * version is the live implementation.
 * Removal permitted after 2026-09-16. Tracked in
 * `@/seed/types/deprecation-markers` (DEPRECATION_REGISTRY).
 */

export const SUPERVISOR_STEPS = [
  { order: 1, type: 'create_plan',         command: 'supervisor.plan' },
  { order: 2, type: 'execute_development', command: 'supervisor.execute' },
  { order: 3, type: 'run_tests',           command: 'supervisor.test' },
] as const

export type SupervisorStepType = typeof SUPERVISOR_STEPS[number]['type']

/** Map step_order → step definition (1-indexed) */
export function getStep(order: 1 | 2 | 3) {
  return SUPERVISOR_STEPS[order - 1]
}
