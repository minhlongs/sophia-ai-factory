import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildTraceId, recordLlmCall } from './llm-trace'

// Mock track() so we can assert props without a real D1 binding.
vi.mock('./track', () => ({
  track: vi.fn(),
}))

// Mock langfuse-client so Phase 4D secondary emission stays isolated
// from these D1-focused tests.
vi.mock('./langfuse-client', () => ({
  sendToLangfuse: vi.fn().mockResolvedValue(undefined),
}))

import { track } from './track';
import { D1Events } from '@/tree/signals/d1-event-types';
import { sendToLangfuse } from './langfuse-client'

describe('llm-trace', () => {
  beforeEach(() => {
    vi.mocked(track).mockClear()
    vi.mocked(sendToLangfuse).mockClear()
    vi.mocked(sendToLangfuse).mockResolvedValue(undefined)
  })

  describe('buildTraceId', () => {
    it('builds deterministic id from workflow_id + step_order', () => {
      expect(buildTraceId('wf-abc', 1)).toBe('wf-abc-step-1')
      expect(buildTraceId('wf-abc', 3)).toBe('wf-abc-step-3')
    })

    it('is idempotent — same input = same id (safe dedup on retries)', () => {
      const a = buildTraceId('wf-1', 2)
      const b = buildTraceId('wf-1', 2)
      expect(a).toBe(b)
    })
  })

  describe('recordLlmCall', () => {
    it('emits LLM_CALL_TRACE event with actor + orgId', () => {
      recordLlmCall(
        {
          workflowId: 'wf-abc',
          stepOrder:  1,
          stepType:   'plan',
          provider:   'stub',
          model:      'mvp-stub',
          durationMs: 42,
          ok:         true,
        },
        'wf-abc',
        'org-123',
      )

      expect(track).toHaveBeenCalledTimes(1)
      const [event, actor, props, orgId] = vi.mocked(track).mock.calls[0]
      expect(event).toBe(D1Events.LLM_CALL_TRACE)
      expect(actor).toBe('wf-abc')
      expect(orgId).toBe('org-123')
      expect(props).toMatchObject({
        trace_id:    'wf-abc-step-1',
        workflow_id: 'wf-abc',
        step_order:  1,
        step_type:   'plan',
        provider:    'stub',
        model:       'mvp-stub',
        duration_ms: 42,
        ok:          true,
      })
    })

    it('strips undefined optional fields before track()', () => {
      recordLlmCall(
        {
          workflowId: 'wf-x',
          stepOrder:  2,
          stepType:   'execute',
          provider:   'stub',
          model:      'mvp-stub',
          durationMs: 10,
          ok:         true,
          // no errorClass, inputTokens, outputTokens, costUsd
        },
        'wf-x',
      )

      const props = vi.mocked(track).mock.calls[0][2] as Record<string, unknown>
      expect(props).not.toHaveProperty('error_class')
      expect(props).not.toHaveProperty('input_tokens')
      expect(props).not.toHaveProperty('output_tokens')
      expect(props).not.toHaveProperty('cost_usd')
    })

    it('passes optional fields through when provided', () => {
      recordLlmCall(
        {
          workflowId:   'wf-y',
          stepOrder:    3,
          stepType:     'test',
          provider:     'openrouter',
          model:        'gpt-4o-mini',
          durationMs:   1250,
          ok:           false,
          errorClass:   'TimeoutError',
          inputTokens:  500,
          outputTokens: 0,
          costUsd:      0.0003,
        },
        'wf-y',
        'org-456',
      )

      const props = vi.mocked(track).mock.calls[0][2] as Record<string, unknown>
      expect(props.ok).toBe(false)
      expect(props.error_class).toBe('TimeoutError')
      expect(props.input_tokens).toBe(500)
      expect(props.output_tokens).toBe(0)
      expect(props.cost_usd).toBeCloseTo(0.0003)
    })

    it('never throws even if track() throws', () => {
      vi.mocked(track).mockImplementationOnce(() => {
        throw new Error('D1 unavailable')
      })

      expect(() => {
        recordLlmCall(
          {
            workflowId: 'wf-z',
            stepOrder:  1,
            stepType:   'plan',
            provider:   'stub',
            model:      'mvp-stub',
            durationMs: 5,
            ok:         true,
          },
          'wf-z',
        )
      }).not.toThrow()
    })

    it('works without orgId (Phase F cron pattern)', () => {
      recordLlmCall(
        {
          workflowId: 'wf-no-org',
          stepOrder:  1,
          stepType:   'plan',
          provider:   'stub',
          model:      'mvp-stub',
          durationMs: 7,
          ok:         true,
        },
        'wf-no-org',
      )

      const [, , , orgId] = vi.mocked(track).mock.calls[0]
      expect(orgId).toBeUndefined()
    })

    it('forwards to Langfuse secondary sink with same actor + orgId', () => {
      recordLlmCall(
        {
          workflowId: 'wf-lf',
          stepOrder:  2,
          stepType:   'execute',
          provider:   'openrouter',
          model:      'gpt-4o-mini',
          durationMs: 33,
          ok:         true,
        },
        'wf-lf',
        'org-lf',
      )

      expect(sendToLangfuse).toHaveBeenCalledTimes(1)
      const [trace, actor, orgId] = vi.mocked(sendToLangfuse).mock.calls[0]
      expect(trace.workflowId).toBe('wf-lf')
      expect(trace.stepOrder).toBe(2)
      expect(actor).toBe('wf-lf')
      expect(orgId).toBe('org-lf')
    })

    it('still emits to D1 even if Langfuse sink rejects', () => {
      vi.mocked(sendToLangfuse).mockRejectedValueOnce(new Error('langfuse down'))

      expect(() => {
        recordLlmCall(
          {
            workflowId: 'wf-lf-fail',
            stepOrder:  1,
            stepType:   'plan',
            provider:   'stub',
            model:      'mvp-stub',
            durationMs: 5,
            ok:         true,
          },
          'wf-lf-fail',
        )
      }).not.toThrow()

      expect(track).toHaveBeenCalledTimes(1)
      expect(sendToLangfuse).toHaveBeenCalledTimes(1)
    })
  })

  describe('D1 schema compatibility', () => {
    it('emits fields that match LlmCallTraceSchema', async () => {
      const { schemaForEvent } = await import('@/tree/signals/d1-event-types')
      const schema = schemaForEvent(D1Events.LLM_CALL_TRACE)

      recordLlmCall(
        {
          workflowId: 'wf-schema',
          stepOrder:  2,
          stepType:   'execute',
          provider:   'stub',
          model:      'mvp-stub',
          durationMs: 100,
          ok:         true,
        },
        'wf-schema',
      )

      const props = vi.mocked(track).mock.calls[0][2]
      // Zod parse should succeed
      expect(() => schema.parse(props)).not.toThrow()
    })

    it('rejects step_order > 3 via schema (guards bad callers)', async () => {
      const { schemaForEvent } = await import('@/tree/signals/d1-event-types')
      const schema = schemaForEvent(D1Events.LLM_CALL_TRACE)

      expect(() =>
        schema.parse({
          trace_id:    'x',
          workflow_id: 'x',
          step_order:  5,       // invalid
          step_type:   'plan',
          provider:    'stub',
          model:       'stub',
          duration_ms: 1,
          ok:          true,
        }),
      ).toThrow()
    })
  })
})
