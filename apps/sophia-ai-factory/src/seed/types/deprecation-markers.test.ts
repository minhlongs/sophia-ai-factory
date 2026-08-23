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

  it('registers the merged tree/inngest client as a duplicate deprecation', () => {
    const entry = getDeprecation('@/tree/inngest/client')
    expect(entry).toBeDefined()
    expect(entry?.replacement).toBe('@/seed/inngest/client')
    expect(entry?.removableAfter).toBe('2026-09-20')
    expect(entry?.kind).toBe('duplicate')
    expect(entry?.callers).toHaveLength(13)
  })

  it('tracks exactly 9 deprecation entries', () => {
    expect(deprecationCount()).toBe(9)
  })
})
