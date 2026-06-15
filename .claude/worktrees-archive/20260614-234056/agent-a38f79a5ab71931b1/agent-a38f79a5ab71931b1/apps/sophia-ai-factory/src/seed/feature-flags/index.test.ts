/**
 * Tests for KV-backed percentage-rollout canary helper.
 * Covers all 6 required cases + statistical distribution sanity.
 *
 * KV mock: inject a fake KVNamespace into globalThis.EXPERIMENT_KV before each test.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type KvStore = Map<string, string>

function makeKv(store: KvStore): KVNamespace {
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    getWithMetadata: vi.fn(async (key: string) => ({
      value: store.get(key) ?? null,
      metadata: null,
    })),
  } as unknown as KVNamespace
}

// Inject KV into globalThis (Workers runtime simulation)
function injectKv(store: KvStore): void {
  ;(globalThis as Record<string, unknown>)['EXPERIMENT_KV'] = makeKv(store)
}

function removeKv(): void {
  delete (globalThis as Record<string, unknown>)['EXPERIMENT_KV']
}

// ---------------------------------------------------------------------------
// Re-import module fresh per test to clear in-process memo
// ---------------------------------------------------------------------------

async function freshImport() {
  // Vitest module cache must be cleared to reset memo Map
  vi.resetModules()
  return import('./index')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('feature-flags canary helper', () => {
  beforeEach(() => {
    vi.resetModules()
    removeKv()
  })

  // Case 1: flag missing → false
  it('returns false when flag key is absent from KV', async () => {
    const store: KvStore = new Map()
    injectKv(store)
    const { isEnabled } = await freshImport()
    expect(await isEnabled('missing-flag', 'user-1')).toBe(false)
  })

  // Case 2: flag exists but enabled:false → false
  it('returns false when flag is disabled', async () => {
    const store: KvStore = new Map([
      ['flag:my-flag', JSON.stringify({ enabled: false, percent: 100 })],
    ])
    injectKv(store)
    const { isEnabled } = await freshImport()
    expect(await isEnabled('my-flag', 'user-1')).toBe(false)
  })

  // Case 3: flag enabled @ 100% → true (even without userId)
  it('returns true for enabled flag at 100% without userId', async () => {
    const store: KvStore = new Map([
      ['flag:full-rollout', JSON.stringify({ enabled: true, percent: 100 })],
    ])
    injectKv(store)
    const { isEnabled } = await freshImport()
    expect(await isEnabled('full-rollout')).toBe(true)
    expect(await isEnabled('full-rollout', undefined)).toBe(true)
  })

  // Case 4: flag enabled @ 50% → deterministic split across 100 fake userIds
  it('splits ~50% across 100 deterministic userIds at percent:50', async () => {
    const store: KvStore = new Map([
      ['flag:half', JSON.stringify({ enabled: true, percent: 50 })],
    ])
    injectKv(store)
    const { isEnabled } = await freshImport()

    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) => isEnabled('half', `user-${i}`)),
    )
    const trueCount = results.filter(Boolean).length
    // Allow ±15 drift (real FNV-1a distribution is tight but not exact 50)
    expect(trueCount).toBeGreaterThanOrEqual(35)
    expect(trueCount).toBeLessThanOrEqual(65)
  })

  // Case 5: same userId always returns same bucket (call 5×)
  it('always returns the same bucket for the same userId', async () => {
    const { bucketFor } = await freshImport()
    const userId = 'stable-user-abc'
    const buckets = Array.from({ length: 5 }, () => bucketFor(userId))
    expect(new Set(buckets).size).toBe(1) // all identical
  })

  // Case 6: corrupt KV value → false, no throw
  it('returns false and does not throw on corrupt KV JSON', async () => {
    const store: KvStore = new Map([['flag:corrupt', 'NOT_VALID_JSON{']])
    injectKv(store)
    const { isEnabled } = await freshImport()
    await expect(isEnabled('corrupt', 'user-1')).resolves.toBe(false)
  })

  // Bonus: KV binding absent → false
  it('returns false when EXPERIMENT_KV binding is not available', async () => {
    removeKv()
    const { isEnabled } = await freshImport()
    expect(await isEnabled('any-flag', 'user-1')).toBe(false)
  })

  // Bonus: Zod-invalid KV value (valid JSON but wrong shape) → false
  it('returns false when KV value fails Zod schema (wrong shape)', async () => {
    const store: KvStore = new Map([
      ['flag:bad-shape', JSON.stringify({ enabled: 'yes', percent: 'all' })],
    ])
    injectKv(store)
    const { isEnabled } = await freshImport()
    await expect(isEnabled('bad-shape', 'user-1')).resolves.toBe(false)
  })

  // Statistical sanity: 1000 samples @ 30% → 280–320
  it('statistical sanity: 1000 userIds at 30% yields 270–330 truthy results', async () => {
    const store: KvStore = new Map([
      ['flag:thirty', JSON.stringify({ enabled: true, percent: 30 })],
    ])
    injectKv(store)
    const { isEnabled } = await freshImport()

    const results = await Promise.all(
      Array.from({ length: 1000 }, (_, i) => isEnabled('thirty', `sanity-user-${i}`)),
    )
    const trueCount = results.filter(Boolean).length
    // ±5% of 1000 = 250–350; tighten to ±3% = 270–330 as per phase doc guidance
    expect(trueCount).toBeGreaterThanOrEqual(270)
    expect(trueCount).toBeLessThanOrEqual(330)
    // Surface actual count for report
    console.info(`[sanity] 30% flag, 1000 users → ${trueCount} enabled`)
  })
})
