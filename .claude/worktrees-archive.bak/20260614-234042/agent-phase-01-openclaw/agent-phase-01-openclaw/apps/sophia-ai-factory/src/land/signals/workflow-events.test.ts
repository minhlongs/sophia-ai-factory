/**
 * Workflow Events & D1 Signal Tests
 * Tests 4 new WORKFLOW_* D1 event types and their Zod schemas
 */

import { describe, it, expect } from 'vitest'
import {
  D1Events,
  schemaForEvent,
  type D1EventType,
} from './d1-event-types'

// ── Test workflow event types exist ───────────────────────────────────────────

describe('D1Events enum — Workflow events', () => {
  it('should have WORKFLOW_STARTED event', () => {
    expect(D1Events.WORKFLOW_STARTED).toBeDefined()
    expect(D1Events.WORKFLOW_STARTED).toBe('workflow_started')
  })

  it('should have WORKFLOW_STEP_COMPLETED event', () => {
    expect(D1Events.WORKFLOW_STEP_COMPLETED).toBeDefined()
    expect(D1Events.WORKFLOW_STEP_COMPLETED).toBe('workflow_step_completed')
  })

  it('should have WORKFLOW_COMPLETED event', () => {
    expect(D1Events.WORKFLOW_COMPLETED).toBeDefined()
    expect(D1Events.WORKFLOW_COMPLETED).toBe('workflow_completed')
  })

  it('should have WORKFLOW_FAILED event', () => {
    expect(D1Events.WORKFLOW_FAILED).toBeDefined()
    expect(D1Events.WORKFLOW_FAILED).toBe('workflow_failed')
  })
})

// ── Test WORKFLOW_STARTED schema ──────────────────────────────────────────────

describe('schemaForEvent(WORKFLOW_STARTED)', () => {
  it('should return a Zod schema', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_STARTED)
    expect(schema).toBeDefined()
    expect(schema.parse).toBeDefined() // Zod has parse method
  })

  it('should require workflow_id', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_STARTED)
    expect(() => schema.parse({ org_id: 'org-1' })).toThrow()
    expect(() => schema.parse({ workflow_id: 'wf-123', org_id: 'org-1' })).not.toThrow()
  })

  it('should require org_id', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_STARTED)
    expect(() => schema.parse({ workflow_id: 'wf-123' })).toThrow()
    expect(() =>
      schema.parse({ workflow_id: 'wf-123', org_id: 'org-1' }),
    ).not.toThrow()
  })

  it('should allow optional step_count', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_STARTED)
    const valid1 = schema.parse({ workflow_id: 'wf-123', org_id: 'org-1' })
    const valid2 = schema.parse({
      workflow_id: 'wf-123',
      org_id: 'org-1',
      step_count: 3,
    })

    expect(valid1).toBeDefined()
    expect(valid2.step_count).toBe(3)
  })

  it('should validate step_count as non-negative integer', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_STARTED)
    expect(() =>
      schema.parse({
        workflow_id: 'wf-123',
        org_id: 'org-1',
        step_count: -1,
      }),
    ).toThrow()
    expect(() =>
      schema.parse({
        workflow_id: 'wf-123',
        org_id: 'org-1',
        step_count: 3.5,
      }),
    ).toThrow()
  })
})

// ── Test WORKFLOW_STEP_COMPLETED schema ───────────────────────────────────────

describe('schemaForEvent(WORKFLOW_STEP_COMPLETED)', () => {
  it('should return a Zod schema', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_STEP_COMPLETED)
    expect(schema).toBeDefined()
    expect(schema.parse).toBeDefined()
  })

  it('should require workflow_id', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_STEP_COMPLETED)
    expect(() => schema.parse({})).toThrow()
    expect(() =>
      schema.parse({ workflow_id: 'wf-123', step_order: 1, step_type: 'create_plan' }),
    ).not.toThrow()
  })

  it('should require step_order between 1 and 3', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_STEP_COMPLETED)
    expect(() =>
      schema.parse({
        workflow_id: 'wf-123',
        step_order: 0,
        step_type: 'create_plan',
      }),
    ).toThrow()
    expect(() =>
      schema.parse({
        workflow_id: 'wf-123',
        step_order: 4,
        step_type: 'create_plan',
      }),
    ).toThrow()
    expect(() =>
      schema.parse({
        workflow_id: 'wf-123',
        step_order: 1,
        step_type: 'create_plan',
      }),
    ).not.toThrow()
    expect(() =>
      schema.parse({
        workflow_id: 'wf-123',
        step_order: 3,
        step_type: 'create_plan',
      }),
    ).not.toThrow()
  })

  it('should require step_type', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_STEP_COMPLETED)
    expect(() =>
      schema.parse({ workflow_id: 'wf-123', step_order: 1 }),
    ).toThrow()
    expect(() =>
      schema.parse({
        workflow_id: 'wf-123',
        step_order: 1,
        step_type: 'create_plan',
      }),
    ).not.toThrow()
  })

  it('should allow optional duration_ms', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_STEP_COMPLETED)
    const valid1 = schema.parse({
      workflow_id: 'wf-123',
      step_order: 1,
      step_type: 'create_plan',
    })
    const valid2 = schema.parse({
      workflow_id: 'wf-123',
      step_order: 1,
      step_type: 'create_plan',
      duration_ms: 5000,
    })

    expect(valid1).toBeDefined()
    expect(valid2.duration_ms).toBe(5000)
  })

  it('should validate duration_ms as non-negative', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_STEP_COMPLETED)
    expect(() =>
      schema.parse({
        workflow_id: 'wf-123',
        step_order: 1,
        step_type: 'create_plan',
        duration_ms: -1,
      }),
    ).toThrow()
  })
})

// ── Test WORKFLOW_COMPLETED schema ────────────────────────────────────────────

describe('schemaForEvent(WORKFLOW_COMPLETED)', () => {
  it('should return a Zod schema', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_COMPLETED)
    expect(schema).toBeDefined()
    expect(schema.parse).toBeDefined()
  })

  it('should require workflow_id and org_id', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_COMPLETED)
    expect(() => schema.parse({})).toThrow()
    expect(() =>
      schema.parse({ workflow_id: 'wf-123' }),
    ).toThrow()
    expect(() =>
      schema.parse({ workflow_id: 'wf-123', org_id: 'org-1' }),
    ).not.toThrow()
  })

  it('should allow optional duration_ms', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_COMPLETED)
    const valid1 = schema.parse({
      workflow_id: 'wf-123',
      org_id: 'org-1',
    })
    const valid2 = schema.parse({
      workflow_id: 'wf-123',
      org_id: 'org-1',
      duration_ms: 30000,
    })

    expect(valid1).toBeDefined()
    expect(valid2.duration_ms).toBe(30000)
  })

  it('should validate duration_ms as non-negative', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_COMPLETED)
    expect(() =>
      schema.parse({
        workflow_id: 'wf-123',
        org_id: 'org-1',
        duration_ms: -500,
      }),
    ).toThrow()
  })
})

// ── Test WORKFLOW_FAILED schema ───────────────────────────────────────────────

describe('schemaForEvent(WORKFLOW_FAILED)', () => {
  it('should return a Zod schema', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_FAILED)
    expect(schema).toBeDefined()
    expect(schema.parse).toBeDefined()
  })

  it('should require workflow_id', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_FAILED)
    expect(() => schema.parse({})).toThrow()
    expect(() => schema.parse({ workflow_id: 'wf-123' })).not.toThrow()
  })

  it('should allow optional step_order between 1 and 3', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_FAILED)
    const valid1 = schema.parse({ workflow_id: 'wf-123' })
    const valid2 = schema.parse({
      workflow_id: 'wf-123',
      step_order: 2,
    })

    expect(valid1).toBeDefined()
    expect(valid2.step_order).toBe(2)
  })

  it('should validate step_order range when provided', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_FAILED)
    expect(() =>
      schema.parse({
        workflow_id: 'wf-123',
        step_order: 0,
      }),
    ).toThrow()
    expect(() =>
      schema.parse({
        workflow_id: 'wf-123',
        step_order: 4,
      }),
    ).toThrow()
  })

  it('should allow optional step_type', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_FAILED)
    const valid1 = schema.parse({ workflow_id: 'wf-123' })
    const valid2 = schema.parse({
      workflow_id: 'wf-123',
      step_type: 'execute_development',
    })

    expect(valid1).toBeDefined()
    expect(valid2.step_type).toBe('execute_development')
  })

  it('should allow optional error_class', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_FAILED)
    const valid1 = schema.parse({ workflow_id: 'wf-123' })
    const valid2 = schema.parse({
      workflow_id: 'wf-123',
      error_class: 'TimeoutError',
    })

    expect(valid1).toBeDefined()
    expect(valid2.error_class).toBe('TimeoutError')
  })

  it('should accept all optional fields together', () => {
    const schema = schemaForEvent(D1Events.WORKFLOW_FAILED)
    const valid = schema.parse({
      workflow_id: 'wf-123',
      step_order: 2,
      step_type: 'execute_development',
      error_class: 'RateLimitError',
    })

    expect(valid).toBeDefined()
    expect(valid.step_order).toBe(2)
    expect(valid.step_type).toBe('execute_development')
    expect(valid.error_class).toBe('RateLimitError')
  })
})

// ── Test schema registry lookup ───────────────────────────────────────────────

describe('schemaForEvent() registry lookup', () => {
  it('should return different schemas for different events', () => {
    const startSchema = schemaForEvent(D1Events.WORKFLOW_STARTED)
    const completedSchema = schemaForEvent(D1Events.WORKFLOW_COMPLETED)
    const failedSchema = schemaForEvent(D1Events.WORKFLOW_FAILED)

    // They should be different schema objects
    expect(startSchema).not.toBe(completedSchema)
    expect(completedSchema).not.toBe(failedSchema)
  })

  it('should return consistent schema for same event type', () => {
    const schema1 = schemaForEvent(D1Events.WORKFLOW_STARTED)
    const schema2 = schemaForEvent(D1Events.WORKFLOW_STARTED)

    // Same event type should return same schema (identity or equivalent)
    const testData = {
      workflow_id: 'wf-123',
      org_id: 'org-1',
      step_count: 3,
    }

    expect(() => schema1.parse(testData)).not.toThrow()
    expect(() => schema2.parse(testData)).not.toThrow()
  })
})

// ── Integration: workflow event lifecycle ─────────────────────────────────────

describe('Workflow event lifecycle validation', () => {
  it('should validate complete workflow event sequence', () => {
    const workflowId = 'wf-abc'
    const orgId = 'org-1'

    // Event 1: Workflow started
    const startSchema = schemaForEvent(D1Events.WORKFLOW_STARTED)
    const startEvent = startSchema.parse({
      workflow_id: workflowId,
      org_id: orgId,
      step_count: 3,
    })
    expect(startEvent).toBeDefined()

    // Event 2: Step 1 completed
    const step1Schema = schemaForEvent(D1Events.WORKFLOW_STEP_COMPLETED)
    const step1Event = step1Schema.parse({
      workflow_id: workflowId,
      step_order: 1,
      step_type: 'create_plan',
      duration_ms: 5000,
    })
    expect(step1Event).toBeDefined()

    // Event 3: Step 2 completed
    const step2Event = step1Schema.parse({
      workflow_id: workflowId,
      step_order: 2,
      step_type: 'execute_development',
      duration_ms: 10000,
    })
    expect(step2Event).toBeDefined()

    // Event 4: Step 3 completed
    const step3Event = step1Schema.parse({
      workflow_id: workflowId,
      step_order: 3,
      step_type: 'run_tests',
      duration_ms: 8000,
    })
    expect(step3Event).toBeDefined()

    // Event 5: Workflow completed
    const completeSchema = schemaForEvent(D1Events.WORKFLOW_COMPLETED)
    const completeEvent = completeSchema.parse({
      workflow_id: workflowId,
      org_id: orgId,
      duration_ms: 23000,
    })
    expect(completeEvent).toBeDefined()
  })

  it('should validate workflow failure event', () => {
    const workflowId = 'wf-xyz'

    // Event 1: Workflow started
    const startSchema = schemaForEvent(D1Events.WORKFLOW_STARTED)
    startSchema.parse({
      workflow_id: workflowId,
      org_id: 'org-2',
      step_count: 3,
    })

    // Event 2: Step 1 completed
    const stepSchema = schemaForEvent(D1Events.WORKFLOW_STEP_COMPLETED)
    stepSchema.parse({
      workflow_id: workflowId,
      step_order: 1,
      step_type: 'create_plan',
    })

    // Event 3: Step 2 failed
    const failSchema = schemaForEvent(D1Events.WORKFLOW_FAILED)
    const failEvent = failSchema.parse({
      workflow_id: workflowId,
      step_order: 2,
      step_type: 'execute_development',
      error_class: 'TimeoutError',
    })
    expect(failEvent).toBeDefined()
  })
})
