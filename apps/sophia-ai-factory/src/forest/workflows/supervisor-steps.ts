/**
 * Supervisor Agent — 3-step hardcoded workflow constants (MVP)
 *
 * Linear chain: create_plan → execute_development → run_tests
 * No DAG branching in MVP scope.
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
