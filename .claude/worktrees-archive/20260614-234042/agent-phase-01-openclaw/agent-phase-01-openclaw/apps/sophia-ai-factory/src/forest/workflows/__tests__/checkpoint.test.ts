/**
 * checkpoint.ts — unit tests
 */
import { describe, it, expect } from 'vitest'
import {
  serializeCheckpoint,
  deserializeCheckpoint,
  createCheckpoint,
  incrementRetry,
  MAX_CHECKPOINT_BYTES,
} from '../checkpoint'

describe('checkpoint', () => {
  const base = {
    missionId: 'mission-1',
    workflowId: 'wf-1',
    stepOrder: 1,
    stepType: 'create_plan',
    savedAt: '2026-06-09T00:00:00Z',
    retryCount: 0,
  }

  describe('createCheckpoint', () => {
    it('creates checkpoint with defaults', () => {
      const cp = createCheckpoint('mission-1', 'wf-1', 1, 'create_plan')
      expect(cp.missionId).toBe('mission-1')
      expect(cp.workflowId).toBe('wf-1')
      expect(cp.stepOrder).toBe(1)
      expect(cp.retryCount).toBe(0)
      expect(cp.savedAt).toBeDefined()
    })

    it('merges partial overrides', () => {
      const cp = createCheckpoint('m1', 'w1', 2, 'execute', {
        provider: 'openrouter',
        model: 'gpt-4',
        tokensUsed: 1500,
      })
      expect(cp.provider).toBe('openrouter')
      expect(cp.model).toBe('gpt-4')
      expect(cp.tokensUsed).toBe(1500)
    })
  })

  describe('incrementRetry', () => {
    it('increments retry count', () => {
      const cp = createCheckpoint('m1', 'w1', 1, 'plan')
      const retried = incrementRetry(cp)
      expect(retried.retryCount).toBe(1)
    })

    it('preserves other fields', () => {
      const cp = createCheckpoint('m1', 'w1', 1, 'plan', { provider: 'openai' })
      const retried = incrementRetry(cp)
      expect(retried.provider).toBe('openai')
      expect(retried.missionId).toBe('m1')
    })
  })

  describe('serializeCheckpoint / deserializeCheckpoint', () => {
    it('round-trips a minimal checkpoint', () => {
      const cp = createCheckpoint('m1', 'w1', 1, 'plan')
      const json = serializeCheckpoint(cp)
      const parsed = deserializeCheckpoint(json)
      expect(parsed).toEqual(cp)
    })

    it('round-trips with partial result', () => {
      const cp = createCheckpoint('m1', 'w1', 1, 'plan', {
        partialResult: { title: 'Test', sections: ['a', 'b'] },
      })
      const json = serializeCheckpoint(cp)
      const parsed = deserializeCheckpoint(json)
      expect(parsed?.partialResult).toEqual({ title: 'Test', sections: ['a', 'b'] })
    })

    it('throws for oversized checkpoint even after trimming', () => {
      // 20 keys × 3000 chars = 60KB — still > 48KB after trim
      const bigResult: Record<string, string> = {}
      for (let i = 0; i < 20; i++) {
        bigResult[`section_${i}`] = 'y'.repeat(3000)
      }
      const cp = createCheckpoint('m1', 'w1', 1, 'plan', { partialResult: bigResult })
      expect(() => serializeCheckpoint(cp)).toThrow('Checkpoint too large')
    })

    it('trims state when oversized but partial result fits', () => {
      const bigState: Record<string, string> = {}
      for (let i = 0; i < 2000; i++) {
        bigState[`key_${i}`] = 'x'.repeat(200) // 400KB state
      }
      const cp = createCheckpoint('m1', 'w1', 1, 'plan', {
        state: bigState,
        partialResult: { ok: true },
      })
      const json = serializeCheckpoint(cp)
      expect(json.length).toBeLessThan(MAX_CHECKPOINT_BYTES)
      const parsed = deserializeCheckpoint(json)
      expect(parsed?.state).toBeUndefined()
      expect(parsed?.partialResult).toEqual({ ok: true })
    })

    it('returns null for invalid JSON', () => {
      expect(deserializeCheckpoint('not json')).toBeNull()
      expect(deserializeCheckpoint('')).toBeNull()
    })
  })

  describe('MAX_CHECKPOINT_BYTES', () => {
    it('is 48KB', () => {
      expect(MAX_CHECKPOINT_BYTES).toBe(48 * 1024)
    })
  })
})
