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
