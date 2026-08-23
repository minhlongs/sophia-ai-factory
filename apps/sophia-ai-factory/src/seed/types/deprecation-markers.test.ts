import { describe, it, expect } from 'vitest'
import { getDeprecation, deprecationCount } from '@/seed/types/deprecation-markers'

describe('DEPRECATION_REGISTRY — tree/ai-providers entry', () => {
  it('registers tree/ai-providers as legacy dead code', () => {
    const entry = getDeprecation('tree/ai-providers')
    expect(entry).toBeDefined()
    expect(entry?.removableAfter).toBe('2026-09-06')
    expect(entry?.kind).toBe('legacy')
    expect(entry?.callers).toEqual([])
  })

  it('tracks exactly 8 deprecation entries', () => {
    expect(deprecationCount()).toBe(8)
  })
})
