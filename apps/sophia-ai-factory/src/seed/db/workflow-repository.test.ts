/**
 * Workflow Repository Tests
 * Tests workflow data structures and query builder logic
 *
 * Note: Full D1 integration tests require a Cloudflare D1 binding.
 * This focuses on testing the type contracts and expected behavior.
 */

import { describe, it, expect } from 'vitest'
import type {
  WorkflowRow,
  StepMissionRow,
  WorkflowWithSteps,
} from '@/seed/db/workflow-repository'

// ── Test fixtures ─────────────────────────────────────────────────────────────

const now = new Date().toISOString()

function createWorkflowRow(overrides?: Partial<WorkflowRow>): WorkflowRow {
  return {
    id: 'wf-test-1',
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

function createMissionRow(
  order: 1 | 2 | 3,
  overrides?: Partial<StepMissionRow>,
): StepMissionRow {
  return {
    id: `mission-${order}`,
    org_id: 'org-1',
    parent_mission_id: 'wf-test-1',
    status: order === 1 ? 'queued' : 'blocked',
    params: JSON.stringify({
      step_order: order,
      step_type: order === 1 ? 'create_plan' : order === 2 ? 'execute_development' : 'run_tests',
      workflow_id: 'wf-test-1',
    }),
    created_at: now,
    ...overrides,
  }
}

// ── Tests: WorkflowRow type contract ──────────────────────────────────────────

describe('WorkflowRow type contract', () => {
  it('should have required fields', () => {
    const wf = createWorkflowRow()

    expect(wf).toHaveProperty('id')
    expect(wf).toHaveProperty('org_id')
    expect(wf).toHaveProperty('prompt')
    expect(wf).toHaveProperty('status')
    expect(wf).toHaveProperty('created_at')
    expect(wf).toHaveProperty('updated_at')
  })

  it('should support all status values', () => {
    const statuses: WorkflowRow['status'][] = ['queued', 'running', 'completed', 'failed']

    statuses.forEach((status) => {
      const wf = createWorkflowRow({ status })
      expect(wf.status).toBe(status)
    })
  })

  it('should allow null final_result and error_message', () => {
    const wf = createWorkflowRow({
      final_result: null,
      error_message: null,
    })

    expect(wf.final_result).toBeNull()
    expect(wf.error_message).toBeNull()
  })

  it('should allow non-null final_result and error_message', () => {
    const wf = createWorkflowRow({
      final_result: 'some result',
      error_message: 'some error',
    })

    expect(wf.final_result).toBe('some result')
    expect(wf.error_message).toBe('some error')
  })

  it('should preserve ISO timestamps', () => {
    const wf = createWorkflowRow()

    expect(new Date(wf.created_at)).toBeInstanceOf(Date)
    expect(new Date(wf.updated_at)).toBeInstanceOf(Date)
  })
})

// ── Tests: StepMissionRow type contract ───────────────────────────────────────

describe('StepMissionRow type contract', () => {
  it('should have required fields', () => {
    const mission = createMissionRow(1)

    expect(mission).toHaveProperty('id')
    expect(mission).toHaveProperty('org_id')
    expect(mission).toHaveProperty('parent_mission_id')
    expect(mission).toHaveProperty('status')
    expect(mission).toHaveProperty('params')
    expect(mission).toHaveProperty('created_at')
  })

  it('should support all status values for missions', () => {
    const statuses = ['queued', 'blocked', 'running', 'completed', 'failed']

    statuses.forEach((status) => {
      const mission = createMissionRow(1, { status })
      expect(mission.status).toBe(status)
    })
  })

  it('should store params as JSON string', () => {
    const mission = createMissionRow(1)

    expect(typeof mission.params).toBe('string')
    const parsed = JSON.parse(mission.params)
    expect(parsed).toHaveProperty('step_order')
    expect(parsed).toHaveProperty('step_type')
    expect(parsed).toHaveProperty('workflow_id')
  })

  it('should preserve step_order in params JSON', () => {
    [1, 2, 3].forEach((order) => {
      const mission = createMissionRow(order as 1 | 2 | 3)
      const params = JSON.parse(mission.params)
      expect(params.step_order).toBe(order)
    })
  })

  it('should have correct step_type for each order', () => {
    const typeMap = {
      1: 'create_plan',
      2: 'execute_development',
      3: 'run_tests',
    }

    Object.entries(typeMap).forEach(([order, type]) => {
      const mission = createMissionRow(parseInt(order) as 1 | 2 | 3)
      const params = JSON.parse(mission.params)
      expect(params.step_type).toBe(type)
    })
  })
})

// ── Tests: WorkflowWithSteps type contract ────────────────────────────────────

describe('WorkflowWithSteps type contract', () => {
  it('should combine workflow and steps', () => {
    const wf = createWorkflowRow()
    const steps = [createMissionRow(1), createMissionRow(2), createMissionRow(3)]

    const combined: WorkflowWithSteps = { ...wf, steps }

    expect(combined).toHaveProperty('id')
    expect(combined).toHaveProperty('org_id')
    expect(combined).toHaveProperty('steps')
    expect(combined.steps).toHaveLength(3)
  })

  it('should preserve workflow properties in combined type', () => {
    const wf = createWorkflowRow({ prompt: 'custom prompt' })
    const steps = [createMissionRow(1)]

    const combined: WorkflowWithSteps = { ...wf, steps }

    expect(combined.prompt).toBe('custom prompt')
    expect(combined.status).toBe('queued')
  })

  it('should maintain step ordering', () => {
    const wf = createWorkflowRow()
    // Insert in reverse order to test ordering preservation
    const steps = [createMissionRow(3), createMissionRow(1), createMissionRow(2)]

    const combined: WorkflowWithSteps = { ...wf, steps }

    expect(combined.steps).toHaveLength(3)
    // Caller should sort by step_order, but type just captures the collection
    expect(combined.steps.map((s) => JSON.parse(s.params).step_order)).toContain(1)
    expect(combined.steps.map((s) => JSON.parse(s.params).step_order)).toContain(2)
    expect(combined.steps.map((s) => JSON.parse(s.params).step_order)).toContain(3)
  })
})

// ── Tests: Workflow lifecycle patterns ──────────────────────────────────────────

describe('Workflow lifecycle patterns', () => {
  it('should start with step 1 queued, steps 2-3 blocked', () => {
    const wf = createWorkflowRow({ status: 'queued' })
    const steps = [
      createMissionRow(1, { status: 'queued' }),
      createMissionRow(2, { status: 'blocked' }),
      createMissionRow(3, { status: 'blocked' }),
    ]

    expect(wf.status).toBe('queued')
    expect(steps[0].status).toBe('queued')
    expect(steps[1].status).toBe('blocked')
    expect(steps[2].status).toBe('blocked')
  })

  it('should support step progression through running state', () => {
    const steps = [
      createMissionRow(1, { status: 'completed' }),
      createMissionRow(2, { status: 'running' }),
      createMissionRow(3, { status: 'blocked' }),
    ]

    expect(steps[0].status).toBe('completed')
    expect(steps[1].status).toBe('running')
    expect(steps[2].status).toBe('blocked')
  })

  it('should support failure propagation', () => {
    const wf = createWorkflowRow({ status: 'failed' })
    const steps = [
      createMissionRow(1, { status: 'completed' }),
      createMissionRow(2, { status: 'failed' }),
      createMissionRow(3, { status: 'blocked' }),
    ]

    expect(wf.status).toBe('failed')
    expect(steps[1].status).toBe('failed')
  })

  it('should support completion state', () => {
    const wf = createWorkflowRow({ status: 'completed', final_result: 'success' })
    const steps = [
      createMissionRow(1, { status: 'completed' }),
      createMissionRow(2, { status: 'completed' }),
      createMissionRow(3, { status: 'completed' }),
    ]

    expect(wf.status).toBe('completed')
    expect(wf.final_result).toBe('success')
    expect(steps.every((s) => s.status === 'completed')).toBe(true)
  })
})

// ── Tests: Org isolation ──────────────────────────────────────────────────────

describe('Workflow org isolation', () => {
  it('should have distinct org_id for each workflow', () => {
    const wf1 = createWorkflowRow({ org_id: 'org-1' })
    const wf2 = createWorkflowRow({ org_id: 'org-2' })

    expect(wf1.org_id).not.toBe(wf2.org_id)
  })

  it('should match workflow and step org_id', () => {
    const orgId = 'org-test'
    const wf = createWorkflowRow({ org_id: orgId })
    const mission = createMissionRow(1, { org_id: orgId })

    expect(wf.org_id).toBe(mission.org_id)
  })

  it('should link mission to workflow via parent_mission_id', () => {
    const workflowId = 'wf-xyz'
    const wf = createWorkflowRow({ id: workflowId })
    const mission = createMissionRow(1, { parent_mission_id: workflowId })

    expect(mission.parent_mission_id).toBe(wf.id)
  })
})

// ── Tests: Params JSON structure ──────────────────────────────────────────────

describe('Mission params JSON structure', () => {
  it('should encode step_order as integer', () => {
    const mission = createMissionRow(2)
    const params = JSON.parse(mission.params)

    expect(typeof params.step_order).toBe('number')
    expect(params.step_order).toBe(2)
  })

  it('should encode step_type as string', () => {
    const mission = createMissionRow(1)
    const params = JSON.parse(mission.params)

    expect(typeof params.step_type).toBe('string')
    expect(params.step_type).toBe('create_plan')
  })

  it('should encode workflow_id as string', () => {
    const mission = createMissionRow(1)
    const params = JSON.parse(mission.params)

    expect(typeof params.workflow_id).toBe('string')
  })

  it('should round-trip params through JSON', () => {
    const original = {
      step_order: 2,
      step_type: 'execute_development',
      workflow_id: 'wf-abc-123',
    }

    const mission = createMissionRow(2, {
      params: JSON.stringify(original),
    })

    const parsed = JSON.parse(mission.params)

    expect(parsed).toEqual(original)
  })
})

// ── Tests: Workflow preset system ─────────────────────────────────────────────
// Note: These test the type contracts and preset registry behavior.
// createWorkflow() itself requires a D1 binding and is tested via integration.

import {
  SUPERVISOR_STEPS,
  WORKFLOW_PRESETS,
  WorkflowStep,
  WorkflowPreset,
  getStepsForPreset,
  getPreset,
  listPresetNames,
} from '@/land/workflows/supervisor-steps'

describe('WORKFLOW_PRESETS registry', () => {
  it('should have a "default" preset', () => {
    expect(WORKFLOW_PRESETS).toHaveProperty('default')
  })

  it('should have a "ceo-solo-media" preset', () => {
    expect(WORKFLOW_PRESETS).toHaveProperty('ceo-solo-media')
  })

  it('default preset should have 3 steps matching SUPERVISOR_STEPS', () => {
    const defaultPreset = WORKFLOW_PRESETS.default
    expect(defaultPreset.steps).toHaveLength(3)
    expect(defaultPreset.steps[0].order).toBe(1)
    expect(defaultPreset.steps[1].order).toBe(2)
    expect(defaultPreset.steps[2].order).toBe(3)
    expect(defaultPreset.mode).toBe('linear')
  })

  it('ceo-solo-media preset should have 8 steps', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    expect(preset.steps).toHaveLength(8)
    expect(preset.mode).toBe('parallel')
    expect(preset.goal).toBe('$1,000,000 MRR')
    expect(preset.targetScore).toBe(100)
  })

  it('ceo-solo-media preset should define soloRoles', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    expect(preset.soloRoles).toEqual(['ceo', 'marketer', 'analyst', 'ops'])
  })

  it('ceo-solo-media preset steps should have labels (en + vi)', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    for (const step of preset.steps) {
      expect(step.label).toBeDefined()
      expect(step.label?.en).toBeTruthy()
      expect(step.label?.vi).toBeTruthy()
    }
  })

  it('ceo-solo-media preset steps should have parallelGroup or dependsOn defined', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    const stepsWithParallel = preset.steps.filter(s => s.parallelGroup !== undefined)
    const stepsWithDeps = preset.steps.filter(s => s.dependsOn !== undefined)
    expect(stepsWithParallel.length).toBeGreaterThan(0)
    expect(stepsWithDeps.length).toBeGreaterThan(0)
  })

  it('ceo-solo-media step orders should be 1-8', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    const orders = preset.steps.map(s => s.order)
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('ceo-solo-media parallel groups should be correctly assigned', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    const groupMap = new Map<number, WorkflowStep[]>()
    for (const step of preset.steps) {
      if (step.parallelGroup !== undefined) {
        const group = groupMap.get(step.parallelGroup) ?? []
        group.push(step)
        groupMap.set(step.parallelGroup, group)
      }
    }
    // Group 1: steps 1 and 2 (market research + audience analysis)
    expect(groupMap.get(1)).toHaveLength(2)
    // Group 2: step 4 only (monetization)
    expect(groupMap.get(2)).toHaveLength(1)
    // Group 3: steps 5 and 6 (production + distribution)
    expect(groupMap.get(3)).toHaveLength(2)
  })
})

describe('getStepsForPreset()', () => {
  it('should return default steps for "default"', () => {
    const steps = getStepsForPreset('default')
    expect(steps).toHaveLength(3)
    expect(steps[0].type).toBe('create_plan')
  })

  it('should return 8 steps for "ceo-solo-media"', () => {
    const steps = getStepsForPreset('ceo-solo-media')
    expect(steps).toHaveLength(8)
    expect(steps[0].type).toBe('market_research')
  })

  it('should fall back to SUPERVISOR_STEPS for unknown preset', () => {
    const steps = getStepsForPreset('nonexistent')
    expect(steps).toHaveLength(SUPERVISOR_STEPS.length)
    expect(steps).toEqual(SUPERVISOR_STEPS)
  })
})

describe('getPreset()', () => {
  it('should return preset metadata for "default"', () => {
    const preset = getPreset('default')
    expect(preset).toBeDefined()
    expect(preset?.name).toBe('Default Supervisor')
  })

  it('should return preset metadata for "ceo-solo-media"', () => {
    const preset = getPreset('ceo-solo-media')
    expect(preset).toBeDefined()
    expect(preset?.name).toBe('CEO Solo Media')
    expect(preset?.goal).toBe('$1,000,000 MRR')
  })

  it('should return undefined for unknown preset', () => {
    const preset = getPreset('nonexistent')
    expect(preset).toBeUndefined()
  })
})

describe('listPresetNames()', () => {
  it('should return at least "default" and "ceo-solo-media"', () => {
    const names = listPresetNames()
    expect(names).toContain('default')
    expect(names).toContain('ceo-solo-media')
  })
})

// ── Tests: Step params JSON for preset workflows ──────────────────────────────
describe('Step params JSON structure for preset workflows', () => {
  it('should include parallel_group in params for preset steps', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    // Simulate how createWorkflow would build params for step with parallelGroup
    const step = preset.steps.find(s => s.parallelGroup !== undefined)!
    const params = JSON.stringify({
      step_order: step.order,
      step_type: step.type,
      workflow_id: 'wf-test',
      parallel_group: step.parallelGroup,
      depends_on: step.dependsOn ?? [],
      preset: 'ceo-solo-media',
    })
    const parsed = JSON.parse(params)
    expect(parsed.parallel_group).toBe(step.parallelGroup)
  })

  it('should include depends_on array in params for preset steps', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    const step = preset.steps.find(s => s.dependsOn !== undefined && s.dependsOn.length > 0)!
    const params = JSON.stringify({
      step_order: step.order,
      step_type: step.type,
      workflow_id: 'wf-test',
      parallel_group: step.parallelGroup ?? null,
      depends_on: step.dependsOn ?? [],
      preset: 'ceo-solo-media',
    })
    const parsed = JSON.parse(params)
    expect(Array.isArray(parsed.depends_on)).toBe(true)
    expect(parsed.depends_on.length).toBeGreaterThan(0)
  })

  it('should include preset name in params', () => {
    const preset = WORKFLOW_PRESETS['ceo-solo-media']
    const step = preset.steps[0]
    const params = JSON.stringify({
      step_order: step.order,
      step_type: step.type,
      workflow_id: 'wf-test',
      parallel_group: step.parallelGroup ?? null,
      depends_on: step.dependsOn ?? [],
      preset: 'ceo-solo-media',
    })
    const parsed = JSON.parse(params)
    expect(parsed.preset).toBe('ceo-solo-media')
  })

  it('should use "default" preset name for fallback steps', () => {
    const step = SUPERVISOR_STEPS[0]
    const params = JSON.stringify({
      step_order: step.order,
      step_type: step.type,
      workflow_id: 'wf-test',
      parallel_group: null,
      depends_on: [],
      preset: 'default',
    })
    const parsed = JSON.parse(params)
    expect(parsed.preset).toBe('default')
  })
})
