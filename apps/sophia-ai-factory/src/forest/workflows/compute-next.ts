/**
 * Supervisor Agent — Pure state machine (no I/O)
 *
 * computeNext(workflow, missions) → next action for the cron stepper.
 * Deterministic, unit-testable without D1.
 *
 * @deprecated 2026-08-16 — duplicate of `@/land/workflows/compute-next`.
 * The forest copy lacks `parallel_group`/`depends_on` DAG support and is not
 * used by the live cron stepper. Migrate to `@/land/workflows/compute-next`.
 * Removal permitted after 2026-09-16. Tracked in
 * `@/seed/types/deprecation-markers` (DEPRECATION_REGISTRY).
 */

import type { WorkflowRow, StepMissionRow } from '@/seed/db/workflow-repository'

// ── Types ─────────────────────────────────────────────────────────────────────

export type NextAction =
  | { action: 'none' }
  | { action: 'unblock'; nextMissionId: string; reason: string }
  | { action: 'execute'; nextMissionId: string; reason: string }
  | { action: 'complete'; reason: string }
  | { action: 'fail'; reason: string }

interface StepParams {
  step_order: number
  step_type: string
  workflow_id: string
}

function parseParams(mission: StepMissionRow): StepParams {
  try {
    return JSON.parse(mission.params) as StepParams
  } catch {
    return { step_order: 0, step_type: 'unknown', workflow_id: '' }
  }
}

// ── computeNext ───────────────────────────────────────────────────────────────

/**
 * Determine the single next action the cron stepper should take for one workflow.
 *
 * Rules (in priority order):
 * 1. workflow already terminal → none
 * 2. any mission failed        → fail (propagate to workflow)
 * 3. all missions completed    → complete
 * 4. lowest blocked mission whose prior step is completed → unblock
 * 5. lowest queued mission     → execute
 * 6. otherwise                 → none (e.g. step running)
 */
export function computeNext(workflow: WorkflowRow, missions: StepMissionRow[]): NextAction {
  // Rule 1 — already terminal
  if (workflow.status === 'completed' || workflow.status === 'failed') {
    return { action: 'none' }
  }

  // Sort by step_order ascending for deterministic logic
  const sorted = [...missions].sort((a, b) => {
    const ao = parseParams(a).step_order
    const bo = parseParams(b).step_order
    return ao - bo
  })

  // Rule 2 — any mission failed
  const failedMission = sorted.find(m => m.status === 'failed')
  if (failedMission) {
    const { step_order, step_type } = parseParams(failedMission)
    return { action: 'fail', reason: `Step ${step_order} (${step_type}) failed` }
  }

  // Rule 3 — all missions completed
  if (sorted.length > 0 && sorted.every(m => m.status === 'completed')) {
    const lastResult = sorted[sorted.length - 1]
    return { action: 'complete', reason: `All ${sorted.length} steps completed — last: ${lastResult.id}` }
  }

  // Rule 4 — lowest blocked mission whose prior step is 'completed'
  for (const mission of sorted) {
    if (mission.status !== 'blocked') continue
    const { step_order } = parseParams(mission)
    if (step_order <= 1) {
      // Step 1 should never be blocked; skip
      continue
    }
    const priorStep = sorted.find(m => parseParams(m).step_order === step_order - 1)
    if (priorStep?.status === 'completed') {
      return {
        action: 'unblock',
        nextMissionId: mission.id,
        reason: `Step ${step_order} unblocked (prior step completed)`,
      }
    }
  }

  // Rule 5 — lowest queued mission
  const queued = sorted.find(m => m.status === 'queued')
  if (queued) {
    const { step_order, step_type } = parseParams(queued)
    return {
      action: 'execute',
      nextMissionId: queued.id,
      reason: `Execute step ${step_order} (${step_type})`,
    }
  }

  // Rule 6 — nothing to do (step running, or no missions)
  return { action: 'none' }
}
