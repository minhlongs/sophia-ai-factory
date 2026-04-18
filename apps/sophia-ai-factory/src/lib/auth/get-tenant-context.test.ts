/**
 * Tests for getTenantContext — Phase 4F.2.
 *
 * Covers: null userId / missing D1 / non-member / no-subscription default
 * BASIC / active subscription tier / D1 throw / single-query roundtrip.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTenantContext } from './get-tenant-context'

interface PrepareMock {
  bind:  ReturnType<typeof vi.fn>
  first: ReturnType<typeof vi.fn>
}

interface D1Mock {
  prepare: ReturnType<typeof vi.fn>
}

function makeD1(firstResult: unknown): { d1: D1Database; prepare: ReturnType<typeof vi.fn> } {
  const prep: PrepareMock = {
    bind:  vi.fn().mockReturnThis() as ReturnType<typeof vi.fn>,
    first: vi.fn().mockResolvedValue(firstResult),
  }
  prep.bind.mockReturnValue(prep)

  const d1: D1Mock = {
    prepare: vi.fn().mockReturnValue(prep),
  }
  return { d1: d1 as unknown as D1Database, prepare: d1.prepare }
}

describe('getTenantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when userId is nullish', async () => {
    const { d1, prepare } = makeD1(null)
    expect(await getTenantContext(null, d1)).toBeNull()
    expect(await getTenantContext(undefined, d1)).toBeNull()
    expect(await getTenantContext('', d1)).toBeNull()
    expect(prepare).not.toHaveBeenCalled()
  })

  it('returns null when D1 unavailable (no env)', async () => {
    const result = await getTenantContext('user-abc', null)
    expect(result).toBeNull()
  })

  it('returns null when user is not in org_members', async () => {
    const { d1 } = makeD1(null)
    const result = await getTenantContext('ghost-user', d1)
    expect(result).toBeNull()
  })

  it('returns BASIC tier when user in org but no active subscription', async () => {
    const { d1 } = makeD1({ org_id: 'org-123', plan: null })
    const result = await getTenantContext('user-basic', d1)
    expect(result).toEqual({ orgId: 'org-123', tier: 'BASIC' })
  })

  it('returns active subscription plan as tier', async () => {
    const { d1 } = makeD1({ org_id: 'org-enterprise', plan: 'ENTERPRISE' })
    const result = await getTenantContext('user-premium', d1)
    expect(result).toEqual({ orgId: 'org-enterprise', tier: 'ENTERPRISE' })
  })

  // Phase 4F.3: DB stores lowercase per migration 0001; normalize to Tier enum
  it('normalizes DB lowercase plan to Tier enum (premium → PREMIUM)', async () => {
    const { d1 } = makeD1({ org_id: 'org-1', plan: 'premium' })
    const result = await getTenantContext('user-1', d1)
    expect(result).toEqual({ orgId: 'org-1', tier: 'PREMIUM' })
  })

  it('normalizes legacy "pro" plan alias to PREMIUM', async () => {
    const { d1 } = makeD1({ org_id: 'org-2', plan: 'pro' })
    const result = await getTenantContext('user-2', d1)
    expect(result).toEqual({ orgId: 'org-2', tier: 'PREMIUM' })
  })

  it('unknown plan string falls back to BASIC', async () => {
    const { d1 } = makeD1({ org_id: 'org-3', plan: 'legacy-plan-xyz' })
    const result = await getTenantContext('user-3', d1)
    expect(result).toEqual({ orgId: 'org-3', tier: 'BASIC' })
  })

  it('swallows D1 throws and returns null', async () => {
    const d1 = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('D1 unreachable')
      }),
    } as unknown as D1Database

    const result = await getTenantContext('user-xyz', d1)
    expect(result).toBeNull()
  })

  it('performs exactly one prepare call (single-query contract)', async () => {
    const { d1, prepare } = makeD1({ org_id: 'org-1', plan: 'PREMIUM' })
    await getTenantContext('user-1', d1)
    expect(prepare).toHaveBeenCalledTimes(1)

    const sqlArg = prepare.mock.calls[0][0] as string
    expect(sqlArg).toMatch(/JOIN\s+subscriptions/i)
    expect(sqlArg).toMatch(/LIMIT\s+1/i)
  })
})
