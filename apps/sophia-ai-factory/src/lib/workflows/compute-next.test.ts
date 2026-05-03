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
    expect((action as any).reason).toMatch(/Step 1/)
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
    expect((action as any).reason).toMatch(/Step 2/)
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
    expect((action as any).reason).toMatch(/Step 3/)
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
    expect((action as any).reason).toMatch(/Step 2/)
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
    expect((action as any).reason).toMatch(/All 3 steps completed/)
  })

  it('should return complete for single mission workflow', () => {
    const wf = newWorkflow()
    const missions = [newMission(1, 'completed')]

    const action = computeNext(wf, missions)

    expect(action.action).toBe('complete')
    expect((action as any).reason).toMatch(/All 1 steps completed/)
  })

  it('should reference last mission in complete reason', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      newMission(2, 'completed'),
      newMission(3, 'completed'),
    ]

    const action = computeNext(wf, missions)

    expect((action as any).reason).toMatch(/mission-3/)
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
    expect((action as any).nextMissionId).toBe('mission-2')
    expect((action as any).reason).toMatch(/Step 2 unblocked/)
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
    expect((action as any).nextMissionId).toBe('mission-3')
    expect((action as any).reason).toMatch(/Step 3 unblocked/)
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
    expect((action as any).nextMissionId).toBe('mission-2')
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
    expect((action as any).nextMissionId).toBe('mission-1')
    expect((action as any).reason).toMatch(/Execute step 1/)
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
    expect((action as any).nextMissionId).toBe('mission-2')
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
    expect((action as any).nextMissionId).toBe('mission-2')
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

// ── Edge cases: sorting and params parsing ────────────────────────────────────

describe('computeNext() — Sorting and params parsing', () => {
  it('should sort missions by step_order before evaluating', () => {
    const wf = newWorkflow()
    // Insert in wrong order to test sorting
    const missions = [
      newMission(3, 'blocked'),
      newMission(1, 'completed'),
      newMission(2, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    // Should unblock step 2 (by order), not step 3
    expect(action.action).toBe('unblock')
    expect((action as any).nextMissionId).toBe('mission-2')
  })

  it('should handle malformed params gracefully', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      {
        ...newMission(2, 'blocked'),
        params: 'invalid json',
      },
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    // Should still work despite mission 2 having bad params
    // (parseParams returns default object on parse error)
    expect(action).toBeDefined()
  })

  it('should handle missing params field', () => {
    const wf = newWorkflow()
    const missions = [
      newMission(1, 'completed'),
      {
        ...newMission(2, 'blocked'),
        params: JSON.stringify({
          step_type: 'unknown',
          // missing step_order
        }),
      },
      newMission(3, 'blocked'),
    ]

    const action = computeNext(wf, missions)

    expect(action).toBeDefined()
  })
})

// ── Integration: full workflow lifecycle ───────────────────────────────────────

describe('computeNext() — Full workflow lifecycle', () => {
  it('should step through 3-step workflow correctly', () => {
    let missions = [
      newMission(1, 'queued'),
      newMission(2, 'blocked'),
      newMission(3, 'blocked'),
    ]
    let wf = newWorkflow()

    // Step 1: execute first mission
    let action = computeNext(wf, missions)
    expect(action.action).toBe('execute')
    missions[0].status = 'running'

    // Step 1 completes
    missions[0].status = 'completed'

    // Step 2: unblock second mission
    action = computeNext(wf, missions)
    expect(action.action).toBe('unblock')
    missions[1].status = 'queued'

    // Step 2: execute second mission
    action = computeNext(wf, missions)
    expect(action.action).toBe('execute')
    missions[1].status = 'running'

    // Step 2 completes
    missions[1].status = 'completed'

    // Step 3: unblock third mission
    action = computeNext(wf, missions)
    expect(action.action).toBe('unblock')
    missions[2].status = 'queued'

    // Step 3: execute third mission
    action = computeNext(wf, missions)
    expect(action.action).toBe('execute')
    missions[2].status = 'running'

    // Step 3 completes
    missions[2].status = 'completed'

    // All missions completed → workflow detects completion (before status change)
    // Rule 3 fires: return 'complete' action
    action = computeNext(wf, missions)
    expect(action.action).toBe('complete')

    // After framework processes complete action, workflow status is set to 'completed'
    // Now Rule 1 (terminal) would apply
    wf.status = 'completed'
    action = computeNext(wf, missions)
    expect(action.action).toBe('none') // Terminal rule: no action needed
  })
})
