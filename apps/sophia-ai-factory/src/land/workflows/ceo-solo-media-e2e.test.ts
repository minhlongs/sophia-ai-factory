/**
 * End-to-end CEO Solo Media workflow test — validates preset structure + full lifecycle
 */
import { describe, it, expect } from 'vitest'
import { computeNext } from '@/land/workflows/compute-next'
import { WORKFLOW_PRESETS } from '@/land/workflows/supervisor-steps'
import type { WorkflowRow, StepMissionRow } from '@/seed/db/workflow-repository'

function makeMission(order: number, type: string, status: string, dependsOn: number[] = [], pg: number | null = null): StepMissionRow {
  return {
    id: `mission-${order}`,
    org_id: 'org-test',
    parent_mission_id: 'wf-test',
    status,
    params: JSON.stringify({ step_order: order, step_type: type, workflow_id: 'wf-test', parallel_group: pg, depends_on: dependsOn }),
    result: null,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
  }
}

function newWorkflow(): WorkflowRow {
  return {
    id: 'wf-test',
    org_id: 'org-test',
    prompt: 'Build a $1M MRR media company with CEO Solo Media workflow',
    status: 'queued',
    final_result: null,
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

describe('CEO Solo Media — End-to-End Workflow Lifecycle', () => {
  it('has correct preset structure', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    expect(preset).toBeDefined()
    expect(preset.goal).toBe('$1,000,000 MRR')
    expect(preset.targetScore).toBe(100)
    expect(preset.mode).toBe('parallel')
    expect(preset.steps.length).toBe(8)
    expect(preset.soloRoles).toEqual(['ceo', 'marketer', 'analyst', 'ops'])
  })

  it('runs through all 8 steps and completes', () => {
    const missions: StepMissionRow[] = [
      makeMission(1, 'market_research', 'queued', [], 1),
      makeMission(2, 'audience_analysis', 'queued', [], 1),
      makeMission(3, 'content_strategy', 'blocked', [1, 2], 2),
      makeMission(4, 'monetization_blueprint', 'blocked', [1, 2], 2),
      makeMission(5, 'content_production', 'blocked', [3, 4], 3),
      makeMission(6, 'distribution_setup', 'blocked', [3, 4], 3),
      makeMission(7, 'analytics_dashboard', 'blocked', [5, 6]),
      makeMission(8, 'optimization_loop', 'blocked', [7]),
    ]
    const wf = newWorkflow()

    const trace: Array<{ order: number; action: string }> = []

    // Phase 1: execute both independent queued steps
    let action = computeNext(wf, missions)
    expect(action.action).toBe('execute')
    trace.push({ order: 1, action: 'execute' })
    missions[0].status = 'completed'

    action = computeNext(wf, missions)
    expect(action.action).toBe('execute')
    trace.push({ order: 2, action: 'execute' })
    missions[1].status = 'completed'

    // After step 2: steps 3 AND 4 both have deps [1,2] met → both unblock (parallel)
    action = computeNext(wf, missions)
    expect(action.action).toBe('unblock') // step 3
    missions[2].status = 'queued'
    action = computeNext(wf, missions)
    expect(action.action).toBe('unblock') // step 4 (deps also met)
    missions[3].status = 'queued'

    // Execute step 3 (lowest order queued)
    action = computeNext(wf, missions)
    expect(action.action).toBe('execute')
    trace.push({ order: 3, action: 'execute' })
    missions[2].status = 'completed'

    // Step 5 must wait for both phase-2 steps.
    action = computeNext(wf, missions)
    expect(action.action).toBe('execute')
    trace.push({ order: 4, action: 'execute' })
    missions[3].status = 'completed'

    action = computeNext(wf, missions)
    expect(action.action).toBe('unblock')
    missions[4].status = 'queued'

    action = computeNext(wf, missions)
    expect(action.action).toBe('unblock')
    missions[5].status = 'queued'

    // Execute step 5 (lowest order queued: 5 < 6)
    action = computeNext(wf, missions)
    expect(action.action).toBe('execute')
    trace.push({ order: 5, action: 'execute' })
    missions[4].status = 'completed'

    // Execute step 6 (lowest order queued)
    action = computeNext(wf, missions)
    expect(action.action).toBe('execute')
    trace.push({ order: 6, action: 'execute' })
    missions[5].status = 'completed'

    // Step 7: unblock → execute
    action = computeNext(wf, missions)
    expect(action.action).toBe('unblock')
    missions[6].status = 'queued'
    action = computeNext(wf, missions)
    expect(action.action).toBe('execute')
    trace.push({ order: 7, action: 'execute' })
    missions[6].status = 'completed'

    // Step 8: unblock → execute
    action = computeNext(wf, missions)
    expect(action.action).toBe('unblock')
    missions[7].status = 'queued'
    action = computeNext(wf, missions)
    expect(action.action).toBe('execute')
    trace.push({ order: 8, action: 'execute' })
    missions[7].status = 'completed'

    // All completed
    action = computeNext(wf, missions)
    expect(action.action).toBe('complete')

    // Verify all 8 steps executed in order
    expect(trace.length).toBe(8)
    expect(trace.map(t => t.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('validates the ceo-solo-media preset has all required fields', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    for (const step of preset.steps) {
      expect(step.order).toBeGreaterThanOrEqual(1)
      expect(step.order).toBeLessThanOrEqual(8)
      expect(step.type).toBeTruthy()
      expect(step.command).toBeTruthy()
      expect(step.label).toBeDefined()
    }
  })

  it('matches goal: $1M MRR, score 100/100', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    expect(preset.goal).toBe('$1,000,000 MRR')
    expect(preset.targetScore).toBe(100)
    expect(preset.mode).toBe('parallel')
  })

  it('has correct parallel group assignments', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    const pg1 = preset.steps.filter(s => s.parallelGroup === 1)
    const pg2 = preset.steps.filter(s => s.parallelGroup === 2)
    const pg3 = preset.steps.filter(s => s.parallelGroup === 3)
    const noPg = preset.steps.filter(s => s.parallelGroup === undefined)
    expect(pg1.length).toBe(2) // market_research (order 1) + audience_analysis (order 2)
    expect(pg2.length).toBe(2) // content_strategy (order 3) + monetization_blueprint (order 4)
    expect(pg3.length).toBe(2) // content_production (order 5) + distribution_setup (order 6)
    expect(noPg.length).toBe(2) // analytics_dashboard (7), optimization_loop (8)
  })

  it('has correct depends_on chains', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    const stepMap = Object.fromEntries(preset.steps.map(s => [s.order, s]))
    expect(stepMap[1].dependsOn).toBeUndefined()
    expect(stepMap[2].dependsOn).toBeUndefined()
    expect(stepMap[3].dependsOn).toEqual([1, 2])
    expect(stepMap[4].dependsOn).toEqual([1, 2])
    expect(stepMap[5].dependsOn).toEqual([3, 4])
    expect(stepMap[6].dependsOn).toEqual([3, 4])
    expect(stepMap[7].dependsOn).toEqual([5, 6])
    expect(stepMap[8].dependsOn).toEqual([7])
  })
})
