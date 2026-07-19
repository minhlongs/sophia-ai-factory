/**
 * supervisor-steps.ts — Workflow step definitions (pluggable)
 *
 * Base types + WORKFLOW_PRESETS imported from seed for layer compliance.
 * Land-level helpers (getStep, getStepsForPreset, etc.) defined here.
 */

import { SUPERVISOR_STEPS, WORKFLOW_PRESETS, type WorkflowStep, type WorkflowPreset } from '@/seed/config/workflow-presets';

export { SUPERVISOR_STEPS, WORKFLOW_PRESETS, type WorkflowStep, type WorkflowPreset };
export type SupervisorStepType = typeof SUPERVISOR_STEPS[number]['type']

export function getStep(order: 1 | 2 | 3) {
  return SUPERVISOR_STEPS[order - 1]
}

/**
 * Get steps for a named preset. Falls back to SUPERVISOR_STEPS if not found.
 */
export function getStepsForPreset(presetName: string): WorkflowStep[] {
  const preset = WORKFLOW_PRESETS[presetName]
  if (!preset) return SUPERVISOR_STEPS as unknown as WorkflowStep[]
  return preset.steps
}

/**
 * Get preset metadata by name.
 */
export function getPreset(presetName: string): WorkflowPreset | undefined {
  return WORKFLOW_PRESETS[presetName]
}

/**
 * List all available preset names.
 */
export function listPresetNames(): string[] {
  return Object.keys(WORKFLOW_PRESETS)
}
