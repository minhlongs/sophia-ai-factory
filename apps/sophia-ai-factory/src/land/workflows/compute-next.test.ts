/**
 * computeNext() State Machine Tests
 * 100% branch coverage of the 6-branch supervisor agent decision tree
 */

import { describe, it, expect } from 'vitest'
import { computeNext, type NextAction } from './compute-next'
import type { WorkflowRow, StepMissionRow } from '@/seed/db/workflow-repository'

// ── Test fixtures ─────────────────────────────────────────────────────────────

const now = new Date().toISOString()

function newWorkflow(overrides?: Partial<WorkflowRow>): WorkflowRow {
  return {
    id: 'wf-1',
    org_id: 'org-1',
    prompt: 'test workflow',
    status: 'queued',
    final_result: null,
    error_message: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function newMission(
  order: 1 | 2 | 3,
  status: string = 'queued',
  overrides?: Partial<StepMissionRow>,
): StepMissionRow {
  return {
    id: `mission-${order}`,
    org_id: 'org-1',
    parent_mission_id: 'wf-1',
    status,
    params: JSON.stringify({
      step_order: order,
      step_type: order === 1 ? 'create_plan' : order === 2 ? 'execute_development' : 'run_tests',
      workflow_id: 'wf-1',
    }),
    created_at: now,
    ...overrides,
  }
}

// ── Rule 1: Already terminal (completed) ──────────────────────────────────────

describe('computeNext() — Rule 1: Terminal status (completed)', () => {
  it('should return none when workflow status is completed', () => {
    const wf = newWorkflow({ status: 'completed' })
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'completed'),
      newMission(3, 'completed'),
    ]

    const action = computeNext(wf, missions)

    expect(action).toEqual({ action: 'none' })
  })

  it('should return none when workflow status is failed', () => {
    const wf = newWorkflow({ status: 'failed' })
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'failed'),
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    expect(action).toEqual({ action: 'none' })
  })
})

// ── Rule 2: Any mission failed ────────────────────────────────────────────────

describe('computeNext() — Rule 2: Any mission failed', () => {
  it('should return fail when first mission fails', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'failed'),
      newMission(2, 'blocked'),
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('fail')
    expect(action).toHaveProperty('reason')
    expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/Step 1/)
  })

  it('should return fail when middle mission fails', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'failed'),
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('fail')
    expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/Step 2/)
  })

  it('should return fail when last mission fails', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'completed'),
      newMission(3, 'failed'),
    ]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('fail')
    expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/Step 3/)
  })

  it('should pick first failed mission even if multiple fail', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'failed'),
      newMission(3, 'failed'),
    ]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('fail')
    expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/Step 2/)
  })
})

// ── Rule 3: All missions completed ────────────────────────────────────────────

describe('computeNext() — Rule 3: All missions completed', () => {
  it('should return complete when all 3 missions completed', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'completed'),
      newMission(3, 'completed'),
    ]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('complete')
    expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/All 3 steps completed/)
  })

  it('should return complete for single mission workflow', () => {
    const wf = newWorkflow()
    const missions = [newMission(1, 'completed')]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('complete')
    expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/All 1 steps completed/)
  })

  it('should reference last mission in complete reason', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'completed'),
      newMission(3, 'completed'),
    ]

    const action = computeNext(wf, missions)

    expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/mission-3/)
  })
})

// ── Rule 4: Lowest blocked mission whose prior step is completed ──────────────

describe('computeNext() — Rule 4: Unblock when prior step completed', () => {
  it('should unblock step 2 when step 1 completed', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'blocked'),
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('unblock')
    expect((action as Extract<NextAction, { nextMissionId: string }>).nextMissionId).toBe('mission-2')
    expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/Step 2 unblocked/)
  })

  it('should unblock step 3 when step 2 completed', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'completed'),
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('unblock')
    expect((action as Extract<NextAction, { nextMissionId: string }>).nextMissionId).toBe('mission-3')
    expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/Step 3 unblocked/)
  })

  it('should not unblock step 1 (step 1 should never be blocked)', () => {
    // Edge case: if step 1 is somehow blocked (shouldn't happen), skip it
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'blocked'),
      newMission(2, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    // Should not unblock step 1 (order <= 1)
    expect(action.action).not.toBe('unblock')
  })

  it('should not unblock if prior step not completed', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'queued'),    // prior step still queued, not completed
      newMission(2, 'blocked'),
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    // Step 2's prior (step 1) is not completed, so don't unblock step 2
    expect(action.action).not.toBe('unblock')
  })

  it('should unblock first eligible blocked mission', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'blocked'),
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('unblock')
    expect((action as Extract<NextAction, { nextMissionId: string }>).nextMissionId).toBe('mission-2')
  })
})

// ── Rule 5: Lowest queued mission ─────────────────────────────────────────────

describe('computeNext() — Rule 5: Execute lowest queued mission', () => {
  it('should execute queued mission', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'queued'),
      newMission(2, 'blocked'),
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('execute')
    expect((action as Extract<NextAction, { nextMissionId: string }>).nextMissionId).toBe('mission-1')
    expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/Execute step 1/)
  })

  it('should execute only queued mission', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'queued'),
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('execute')
    expect((action as Extract<NextAction, { nextMissionId: string }>).nextMissionId).toBe('mission-2')
  })

  it('should prioritize unblock over execute (Rule 4 before Rule 5)', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'blocked'),
      newMission(3, 'queued'),
    ]

    const action = computeNext(wf, missions)

    // Rule 4 (unblock) has priority over Rule 5 (execute)
    expect(action.action).toBe('unblock')
    expect((action as Extract<NextAction, { nextMissionId: string }>).nextMissionId).toBe('mission-2')
  })
})

// ── Rule 6: Nothing to do (none) ──────────────────────────────────────────────

describe('computeNext() — Rule 6: No actionable state (none)', () => {
  it('should return none when step is running (not queued/blocked/completed)', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'running'),
      newMission(2, 'blocked'),
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    expect(action).toEqual({ action: 'none' })
  })

  it('should return none when no missions', () => {
    const wf = newWorkflow()
    const missions: StepMissionRow[] = []

    const action = computeNext(wf, missions)

    expect(action).toEqual({ action: 'none' })
  })

  it('should return none when mixed states with no actionable next step', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'running'),
      newMission(2, 'blocked'),
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    expect(action).toEqual({ action: 'none' })
  })
})

// ── Preset: depends_on (multiple dependencies) ────────────────────────────────
describe('computeNext() — depends_on: multiple dependencies (ceo-solo-media)', () => {
 function newMissionWithDeps(
 order: number,
 status: string,
 deps: number[],
 overrides?: Partial<StepMissionRow>,
 ): StepMissionRow {
 const typeMap: Record<number, string> = {
 1: 'market_research',
 2: 'audience_analysis',
 3: 'content_strategy',
 4: 'monetization_blueprint',
 5: 'content_production',
 6: 'distribution_setup',
 7: 'analytics_dashboard',
 8: 'optimization_loop',
 }
 return {
 id: `mission-${order}`,
 org_id: 'org-1',
 parent_mission_id: 'wf-1',
 status,
 params: JSON.stringify({
 step_order: order,
 step_type: typeMap[order] || 'unknown',
 workflow_id: 'wf-1',
 parallel_group: order <= 2 ? 1 : order <= 4 ? 2 : order <= 6 ? 3 : null,
 depends_on: deps,
 }),
 created_at: now,
 ...overrides,
 }
 }

 it('should unblock step 3 when both dependencies (1, 2) are completed', () => {
 const wf = newWorkflow()
 const missions = [
 newMissionWithDeps(1, 'completed', []),
 newMissionWithDeps(2, 'completed', [1]),
 newMissionWithDeps(3, 'blocked', [1, 2]), // depends on both 1 and 2
 ]
 const action = computeNext(wf, missions)
 expect(action.action).toBe('unblock')
 expect((action as Extract<NextAction, { nextMissionId: string }>).nextMissionId).toBe('mission-3')
 expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/Step 3 unblocked/)
 })

 it('should NOT unblock step 3 when only one of two dependencies is completed', () => {
 const wf = newWorkflow()
 const missions = [
 newMissionWithDeps(1, 'completed', []),
 newMissionWithDeps(2, 'queued', [1]), // not completed yet
 newMissionWithDeps(3, 'blocked', [1, 2]), // depends on both
 ]
 const action = computeNext(wf, missions)
 // Step 3 depends on [1, 2]; step 2 is not completed → should not unblock
 expect(action.action).not.toBe('unblock')
 })

 it('should NOT unblock step 3 when neither dependency is completed', () => {
 const wf = newWorkflow()
 const missions = [
 newMissionWithDeps(1, 'queued', []),
 newMissionWithDeps(2, 'queued', [1]),
 newMissionWithDeps(3, 'blocked', [1, 2]),
 ]
 const action = computeNext(wf, missions)
 expect(action.action).not.toBe('unblock')
 })

 it('should fail if any dependency is failed', () => {
 const wf = newWorkflow()
 const missions = [
 newMissionWithDeps(1, 'completed', []),
 newMissionWithDeps(2, 'failed', [1]), // dependency failed
 newMissionWithDeps(3, 'blocked', [1, 2]),
 ]
 const action = computeNext(wf, missions)
 // Rule 2 (any mission failed) takes priority
 expect(action.action).toBe('fail')
 expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/Step 2/)
 })

 it('should unblock step 4 (parallel group 2) after both phase-1 deps complete', () => {
 const wf = newWorkflow()
 // Phase 1: steps 1 and 2 (parallel group 1)
 // Step 1: no deps, Step 2: depends on [1]
 // After both complete, step 3 and 4 (parallel group 2) should unblock
 const missions = [
 newMissionWithDeps(1, 'completed', []),
 newMissionWithDeps(2, 'completed', [1]),
 newMissionWithDeps(3, 'blocked', [1, 2]), // phase 2, depends on phase 1
 newMissionWithDeps(4, 'blocked', [1, 2]), // phase 2, parallel with 3
 ]
 const action = computeNext(wf, missions)
 // Step 3 is the first blocked mission with deps met
 expect(action.action).toBe('unblock')
 expect((action as Extract<NextAction, { nextMissionId: string }>).nextMissionId).toBe('mission-3')
 })
})

// ── Preset: parallel group execution (same tick unblocking) ──────────────────
describe('computeNext() — parallel_group: same-phase steps', () => {
 function newMissionWithParallel(
 order: number,
 status: string,
 pg: number | null,
 deps: number[],
 overrides?: Partial<StepMissionRow>,
 ): StepMissionRow {
 const typeMap: Record<number, string> = {
 1: 'market_research',
 2: 'audience_analysis',
 3: 'content_strategy',
 4: 'monetization_blueprint',
 }
 return {
 id: `mission-${order}`,
 org_id: 'org-1',
 parent_mission_id: 'wf-1',
 status,
 params: JSON.stringify({
 step_order: order,
 step_type: typeMap[order] || 'unknown',
 workflow_id: 'wf-1',
 parallel_group: pg,
 depends_on: deps,
 }),
 created_at: now,
 ...overrides,
 }
 }

 it('should unblock both parallel-group-1 steps when step 1 completes', () => {
 const wf = newWorkflow()
 // Step 1: queued (no deps, group 1)
 // Step 2: blocked (depends on [1], group 1) — parallel with nothing yet
 const missions = [
 newMissionWithParallel(1, 'completed', 1, []),
 newMissionWithParallel(2, 'blocked', 1, [1]),
 ]
 let action = computeNext(wf, missions)
 // Step 2 should unblock since dep [1] is completed
 expect(action.action).toBe('unblock')
 expect((action as Extract<NextAction, { nextMissionId: string }>).nextMissionId).toBe('mission-2')

 // After unblocking step 2, it becomes queued → next action should execute it
 missions[1].status = 'queued'
 action = computeNext(wf, missions)
 expect(action.action).toBe('execute')
 expect((action as Extract<NextAction, { nextMissionId: string }>).nextMissionId).toBe('mission-2')
 })

 it('should handle 8-step ceo-solo-media workflow lifecycle', () => {
  // Simulate full 8-step parallel workflow execution
  const missions: StepMissionRow[] = [
    // Phase 1 (parallel group 1): market_research + audience_analysis
    { id: 'mission-1', org_id: 'org-1', parent_mission_id: 'wf-1', status: 'queued', params: JSON.stringify({ step_order: 1, step_type: 'market_research', workflow_id: 'wf-1', parallel_group: 1, depends_on: [] }), created_at: now },
    { id: 'mission-2', org_id: 'org-1', parent_mission_id: 'wf-1', status: 'blocked', params: JSON.stringify({ step_order: 2, step_type: 'audience_analysis', workflow_id: 'wf-1', parallel_group: 1, depends_on: [1] }), created_at: now },
    // Phase 2 (parallel group 2): content_strategy + monetization_blueprint
    { id: 'mission-3', org_id: 'org-1', parent_mission_id: 'wf-1', status: 'blocked', params: JSON.stringify({ step_order: 3, step_type: 'content_strategy', workflow_id: 'wf-1', parallel_group: 2, depends_on: [1, 2] }), created_at: now },
    { id: 'mission-4', org_id: 'org-1', parent_mission_id: 'wf-1', status: 'blocked', params: JSON.stringify({ step_order: 4, step_type: 'monetization_blueprint', workflow_id: 'wf-1', parallel_group: 2, depends_on: [1, 2] }), created_at: now },
    // Phase 3 (parallel group 3): content_production + distribution_setup
    { id: 'mission-5', org_id: 'org-1', parent_mission_id: 'wf-1', status: 'blocked', params: JSON.stringify({ step_order: 5, step_type: 'content_production', workflow_id: 'wf-1', parallel_group: 3, depends_on: [3] }), created_at: now },
    { id: 'mission-6', org_id: 'org-1', parent_mission_id: 'wf-1', status: 'blocked', params: JSON.stringify({ step_order: 6, step_type: 'distribution_setup', workflow_id: 'wf-1', parallel_group: 3, depends_on: [3, 4] }), created_at: now },
    // Phase 4: analytics_dashboard + optimization_loop
    { id: 'mission-7', org_id: 'org-1', parent_mission_id: 'wf-1', status: 'blocked', params: JSON.stringify({ step_order: 7, step_type: 'analytics_dashboard', workflow_id: 'wf-1', depends_on: [5, 6] }), created_at: now },
    { id: 'mission-8', org_id: 'org-1', parent_mission_id: 'wf-1', status: 'blocked', params: JSON.stringify({ step_order: 8, step_type: 'optimization_loop', workflow_id: 'wf-1', depends_on: [7] }), created_at: now },
  ]
  const wf = newWorkflow()

  // Step 1: execute (queued)
  let action = computeNext(wf, missions)
  expect(action.action).toBe('execute')
  missions[0].status = 'completed'

  // Step 2: unblock (depends on [1])
  action = computeNext(wf, missions)
  expect(action.action).toBe('unblock')
  missions[1].status = 'queued'
  action = computeNext(wf, missions)
  expect(action.action).toBe('execute')
  missions[1].status = 'completed'

  // Steps 3 & 4: both deps [1,2] met → unblock both
  action = computeNext(wf, missions)
  expect(action.action).toBe('unblock') // step 3
  missions[2].status = 'queued'
  action = computeNext(wf, missions)
  expect(action.action).toBe('unblock') // step 4
  missions[3].status = 'queued'

  // Execute step 3
  action = computeNext(wf, missions)
  expect(action.action).toBe('execute')
  missions[2].status = 'completed'

// After step 3 completes, step 5 (blocked, deps [3]) → Rule 4 unblocks step 5
action = computeNext(wf, missions)
expect(action.action).toBe('unblock') // step 5 unblocks
missions[4].status = 'queued'

// Now step 4 (queued, order 4) and step 5 (queued, order 5) → execute step 4 first
action = computeNext(wf, missions)
expect(action.action).toBe('execute')
missions[3].status = 'completed'

// After step 4 completes, step 6 (blocked, deps [3,4]) → Rule 4 unblocks step 6
action = computeNext(wf, missions)
expect(action.action).toBe('unblock') // step 6 unblocks
missions[5].status = 'queued'

// Step 5: execute (queued, order 5) — lower than step 6 (order 6)
action = computeNext(wf, missions)
expect(action.action).toBe('execute')
missions[4].status = 'completed'

// Step 6: execute (queued, order 6)
action = computeNext(wf, missions)
expect(action.action).toBe('execute')
missions[5].status = 'completed'

// Step 7: deps [5,6] met → unblock
action = computeNext(wf, missions)
expect(action.action).toBe('unblock')
missions[6].status = 'queued'
action = computeNext(wf, missions)
expect(action.action).toBe('execute')
missions[6].status = 'completed'

// Step 8: deps [7] met → unblock
action = computeNext(wf, missions)
expect(action.action).toBe('unblock')
missions[7].status = 'queued'
action = computeNext(wf, missions)
expect(action.action).toBe('execute')
missions[7].status = 'completed'

  // All 8 steps completed
  action = computeNext(wf, missions)
  expect(action.action).toBe('complete')
  expect((action as Extract<NextAction, { reason: string }>).reason).toMatch(/All 8 steps completed/)
})


})
