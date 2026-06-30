/**
 * Supervisor step types and default workflow steps — moved to seed for layer compliance.
 * Canonical source for shared types used across seed, tree, and land.
 */

/** Default 3-step MVP chain (backward compatible) */
export const SUPERVISOR_STEPS = [
  { order: 1, type: 'create_plan', command: 'supervisor.plan' },
  { order: 2, type: 'execute_development', command: 'supervisor.execute' },
  { order: 3, type: 'run_tests', command: 'supervisor.test' },
] as const;

export type SupervisorStepType = typeof SUPERVISOR_STEPS[number]['type'];

export interface WorkflowStep {
  order: number;
  type: string;
  command: string;
  parallelGroup?: number;
  dependsOn?: number[];
  label?: { en: string; vi: string };
}
