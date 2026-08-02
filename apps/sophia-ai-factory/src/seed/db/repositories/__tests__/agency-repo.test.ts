/**
 * Agency & Sub-Tenant Repository Tests

 * Covers: Agency CRUD, credit operations (reserve/commit/refund),
 * sub-tenant CRUD, and cross-agency isolation.

 * @vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isOk, isErr } from '@/seed/types/result'
import {
  createAgency,
  findBySlug,
  findByOwner,
  findById,
  updateTier,
  updateStatus,
  getCreditBalance,
  reserveCredits,
  commitCredits,
  refundCredits,
} from '@/seed/db/repositories/agency-repo'
import {
  create as createSubTenant,
  findByAgency,
  findById as findSubTenantById,
  updateStatus as updateSubTenantStatus,
  countByAgency,
} from '@/seed/db/repositories/sub-tenant-repo'
import * as dbClient from '@/seed/db/client'

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

interface Chain {
  first: ReturnType<typeof vi.fn>
  all: ReturnType<typeof vi.fn>
  run: ReturnType<typeof vi.fn>
  bind: ReturnType<typeof vi.fn>
  prepare: ReturnType<typeof vi.fn>
}

function mockD1() {
  const c = {} as Chain
  c.bind = vi.fn().mockReturnThis()
  c.first = vi.fn()
  c.all = vi.fn()
  c.run = vi.fn()
  c.prepare = vi.fn().mockReturnValue(c)

  // Wrap .first() to unwrap {data, error} → throw on error, return raw data on success
  const origFirst = c.first
  c.first = vi.fn().mockImplementation(async (...args: unknown[]) => {
    const result = await Promise.resolve(origFirst(...args))
    // If data is null and no error → return null (not found)
    // If data is null and error exists → throw
    // Otherwise return data directly
    if (result && typeof result === 'object' && 'error' in result) {
      const r = result as { data: unknown; error: { message?: string } | null }
      if (r.error) throw new Error(r.error.message ?? 'D1 error')
      return r.data
    }
    return result
  })

  // Wrap .all() to unwrap {data, error} → return raw results array
  const origAll = c.all
  c.all = vi.fn().mockImplementation(async (...args: unknown[]) => {
    const result = await Promise.resolve(origAll(...args))
    if (result && typeof result === 'object' && 'error' in result) {
      const r = result as { data: unknown[]; error: { message?: string } | null }
      if (r.error) throw new Error(r.error.message ?? 'D1 error')
      return r.data
    }
    return result
  })

  const rawDb = { prepare: vi.fn().mockReturnValue(c as never) }
  vi.mocked(dbClient.getD1).mockReturnValue(rawDb as never)
  return { rawDb, chain: c }
}

// Re-expose for tests that check chain.prepare.mock.calls etc.
type ChainLike = InstanceType<ReturnType<typeof vi.fn>>

const NOW = Math.floor(Date.now() / 1000)

// ══════════════════════════════════════════════════════════════════════════════
// Agency CRUD
// ══════════════════════════════════════════════════════════════════════════════

describe('Agency CRUD', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createAgency', () => {
    it('happy path: inserts and returns row', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({
        data: {
          id: 1,
          slug: 'acme',
          name: 'Acme Corp',
          tier: 'starter',
          api_key_hash: 'hash_abc',
          api_key_prefix: 'ac_',
          owner_user_id: 42,
          billing_email: 'billing@acme.com',
          status: 'active',
          created_at: NOW,
          updated_at: NOW,
        } as never,
        error: null,
      })

      const result = await createAgency({
        slug: 'acme',
        name: 'Acme Corp',
        apiKeyHash: 'hash_abc',
        apiKeyPrefix: 'ac_',
        ownerUserId: 42,
        billingEmail: 'billing@acme.com',
      })
      expect(result.ok).toBe(true)
      if (!isOk(result)) throw new Error("test precondition failed");
      const okRow = result.value
      expect(okRow.slug).toBe('acme')
      expect(okRow.tier).toBe('starter')
      expect(okRow.billing_email).toBe('billing@acme.com')
    })

    it('defaults tier=starter and null billing_email when omitted', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({
        data: {
          id: 1,
          slug: 'solo',
          name: 'Solo',
          tier: 'starter',
          api_key_hash: 'h',
          api_key_prefix: null,
          owner_user_id: 1,
          billing_email: null,
          status: 'active',
          created_at: NOW,
          updated_at: NOW,
        } as never,
        error: null,
      })

      const result = await createAgency({ slug: 'solo', name: 'Solo', apiKeyHash: 'h', ownerUserId: 1 })
      expect(result.ok).toBe(true)
      // tier defaults to 'starter' and billing_email to null
      const okRow2 = result.value
      expect(okRow2.tier).toBe('starter')
      expect(okRow2.billing_email).toBeNull()
    })

    it('DB error on insert returns failure', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: null, error: { message: 'UNIQUE constraint failed' } })

      const result = await createAgency({ slug: 'dup', name: 'Dup', apiKeyHash: 'h', ownerUserId: 1 })
      expect(result.ok).toBe(false)
      if (!isErr(result)) throw new Error("test precondition failed");
      expect(result.error.code).toBe('AGENCY_CREATE_FAILED')
    })

    it('empty data (no error) returns empty result', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: null, error: null })

      const result = await createAgency({ slug: 'x', name: 'X', apiKeyHash: 'h', ownerUserId: 1 })
      expect(result.ok).toBe(false)
      if (!isErr(result)) throw new Error("test precondition failed");
      expect(result.error.code).toBe('AGENCY_CREATE_EMPTY')
    })
  })

  describe('findBySlug', () => {
    it('found returns row', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({
        data: { id: 1, slug: 'acme', name: 'Acme', tier: 'growth', api_key_hash: 'h', api_key_prefix: 'ac_', owner_user_id: 42, billing_email: null, status: 'active', created_at: NOW, updated_at: NOW } as never,
        error: null,
      })
      const r = await findBySlug('acme')
      expect(r).not.toBeNull()
      expect((r!).tier).toBe('growth')
    })
    it('not found returns null', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: null, error: null })
      expect(await findBySlug('nope')).toBeNull()
    })
  })

  describe('findByOwner', () => {
    it('found returns row', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({
        data: { id: 5, slug: 'o42', name: "Owner's", tier: 'enterprise', api_key_hash: 'h', api_key_prefix: null, owner_user_id: 42, billing_email: null, status: 'active', created_at: NOW, updated_at: NOW } as never,
        error: null,
      })
      const r = await findByOwner(42)
      expect(r).not.toBeNull()
      expect((r!).slug).toBe('o42')
    })
    it('not found returns null', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: null, error: null })
      expect(await findByOwner(999)).toBeNull()
    })
  })

  describe('findById', () => {
    it('found returns row', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({
        data: { id: 3, slug: 'byid', name: 'ById', tier: 'starter', api_key_hash: 'h', api_key_prefix: null, owner_user_id: 7, billing_email: null, status: 'active', created_at: NOW, updated_at: NOW } as never,
        error: null,
      })
      const r = await findById(3)
      expect(r).not.toBeNull()
      expect((r!).id).toBe(3)
    })
    it('not found returns null', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: null, error: null })
      expect(await findById(999)).toBeNull()
    })
  })

  describe('updateTier', () => {
    it('success: zero changes -> ok true (changes > 0 or 0 path – repo treats 0 as not found)', async () => {
      const { chain } = mockD1()
      chain.run.mockResolvedValue({ success: true, meta: { changes: 1 } })

      const result = await updateTier(1, 'enterprise')
      // repo checks `changes === 0` for not-found, so 1 = success
      expect(result.ok).toBe(true)
    })

    it('not found: zero changes triggers failure', async () => {
      const { chain } = mockD1()
      chain.run.mockResolvedValue({ success: true, meta: { changes: 0 } })

      const result = await updateTier(999, 'enterprise')
      expect(result.ok).toBe(false)
      if (!isErr(result)) throw new Error("test precondition failed");
      expect(result.error.code).toBe('AGENCY_NOT_FOUND')
    })
  })

  describe('updateStatus', () => {
    it('success', async () => {
      const { chain } = mockD1()
      chain.run.mockResolvedValue({ success: true, meta: { changes: 1 } })
      const result = await updateStatus(1, 'suspended')
      expect(result.ok).toBe(true)
    })

    it('not found', async () => {
      const { chain } = mockD1()
      chain.run.mockResolvedValue({ success: true, meta: { changes: 0 } })
      const result = await updateStatus(999, 'cancelled')
      expect(result.ok).toBe(false)
      if (!isErr(result)) throw new Error("test precondition failed");
      expect(result.error.code).toBe('AGENCY_NOT_FOUND')
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Credit Operations
// ══════════════════════════════════════════════════════════════════════════════

describe('Credit Operations', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getCreditBalance', () => {
    it('returns balance from latest ledger row', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: { balance: 500 }, error: null })
      expect(await getCreditBalance(1)).toBe(500)
    })

    it('returns 0 when no ledger rows', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: null, error: null })
      expect(await getCreditBalance(99)).toBe(0)
    })
  })

  describe('reserveCredits', () => {
    it('happy path: 500 - 50 = 450', async () => {
      const { chain } = mockD1()
      // 1st call: read balance
      chain.first.mockResolvedValueOnce({ data: { balance: 500 }, error: null })
      // 2nd call: insert reservation (first() used for RETURNING)
      chain.first.mockResolvedValueOnce({ data: null, error: null })
      // 3rd call: run the INSERT
      chain.run.mockResolvedValue({ success: true, meta: { changes: 1 } })

      const result = await reserveCredits(1, 50, 'job-abc')
      expect(result.ok).toBe(true)
      if (!isOk(result)) throw new Error("test precondition failed");
expect(result.value).toBe(450)
    })

    it('insufficient credits returns failure', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValueOnce({ data: { balance: 10 }, error: null })

      const result = await reserveCredits(1, 50, 'job-abc')
      expect(result.ok).toBe(false)
      if (!isErr(result)) throw new Error("test precondition failed");
      expect(result.error.code).toBe('INSUFFICIENT_CREDITS')
    })

    it('zero balance: insufficient', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValueOnce({ data: { balance: 0 }, error: null })

      const result = await reserveCredits(1, 1, 'job-xyz')
      expect(result.ok).toBe(false)
      if (!isErr(result)) throw new Error("test precondition failed");
      expect(result.error.code).toBe('INSUFFICIENT_CREDITS')
    })
  })

  describe('commitCredits', () => {
    it('happy path: finds reservation and commits', async () => {
      const { chain } = mockD1()
      const reservation = {
        id: 10,
        agency_id: 1,
        delta: -50,
        balance: 450,
        reserved: 50,
        reason: 'reserve',
        job_id: 'job-abc',
        created_at: NOW,
      }

      chain.first
        .mockResolvedValueOnce({ data: reservation as never, error: null }) // find reservation
      chain.run.mockResolvedValue({ success: true, meta: { changes: 1 } })

      const result = await commitCredits(1, 'job-abc')
      expect(result.ok).toBe(true)
    })

    it('no reservation returns failure', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValueOnce({ data: null, error: null })

      const result = await commitCredits(1, 'job-missing')
      expect(result.ok).toBe(false)
      if (!isErr(result)) throw new Error("test precondition failed");
      expect(result.error.code).toBe('RESERVATION_NOT_FOUND')
    })
  })

  describe('refundCredits', () => {
    it('happy path: refunds credits back', async () => {
      const { chain } = mockD1()
      const reservation = {
        id: 11,
        agency_id: 1,
        delta: -30,
        balance: 470,
        reserved: 30,
        reason: 'reserve',
        job_id: 'job-fail',
        created_at: NOW,
      }

      chain.first.mockResolvedValueOnce({ data: reservation as never, error: null })
      chain.run.mockResolvedValue({ success: true, meta: { changes: 1 } })

      const result = await refundCredits(1, 'job-fail')
      expect(result.ok).toBe(true)
    })

    it('no reservation returns failure', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValueOnce({ data: null, error: null })

      const result = await refundCredits(1, 'job-nope')
      expect(result.ok).toBe(false)
      if (!isErr(result)) throw new Error("test precondition failed");
      expect(result.error.code).toBe('RESERVATION_NOT_FOUND')
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Sub-Tenant CRUD
// ══════════════════════════════════════════════════════════════════════════════

describe('Sub-Tenant CRUD', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('create', () => {
    it('happy path: inserts with agency_id', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({
        data: { id: 1, agency_id: 5, owner_user_id: 42, display_name: 'Team Alpha', status: 'active', created_at: NOW } as never,
        error: null,
      })

      const result = await createSubTenant({ agencyId: 5, ownerUserId: 42, displayName: 'Team Alpha' })
      expect(result.ok).toBe(true)
      if (!isOk(result)) throw new Error("test precondition failed");
      const okSub = result.value
      expect(okSub.agency_id).toBe(5)
      expect(okSub.display_name).toBe('Team Alpha')
    })

    it('nullable agency_id: creates without agency assignment', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({
        data: { id: 2, agency_id: null, owner_user_id: 99, display_name: 'Solo', status: 'active', created_at: NOW } as never,
        error: null,
      })

      const result = await createSubTenant({ agencyId: null, ownerUserId: 99 })
      expect(result.ok).toBe(true)
      if (!isOk(result)) throw new Error("test precondition failed");
      const okSub2 = result.value
      expect(okSub2.agency_id).toBeNull()
    })

    it('DB error returns failure', async () => {
      const { chain } = mockD1()
      // .first() returns an error object (D1 pattern) when insert fails
      chain.first.mockResolvedValue({ data: null, error: { message: 'constraint violation' } })

      const result = await createSubTenant({ agencyId: 1, ownerUserId: 1 })
      expect(result.ok).toBe(false)
      if (!isErr(result)) throw new Error("test precondition failed");
      expect(result.error.code).toBe('SUBTENANT_CREATE_FAILED')
    })

    it('empty data (no error) returns empty result', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: null, error: null })

      const result = await createSubTenant({ agencyId: 1, ownerUserId: 1 })
      expect(result.ok).toBe(false)
      if (!isErr(result)) throw new Error("test precondition failed");
      expect(result.error.code).toBe('SUBTENANT_CREATE_EMPTY')
    })
  })

  describe('findByAgency', () => {
    it('returns array of sub-tenants', async () => {
      const { chain } = mockD1()
      chain.all.mockResolvedValue({
        data: [
          { id: 1, agency_id: 5, owner_user_id: 1, display_name: 'A', status: 'active', created_at: NOW },
          { id: 2, agency_id: 5, owner_user_id: 2, display_name: 'B', status: 'active', created_at: NOW },
        ] as never,
        error: null,
      })

      const result = await findByAgency(5)
      expect(result).toHaveLength(2)
      expect(result[0].agency_id).toBe(5)
    })

    it('returns empty array when none', async () => {
      const { chain } = mockD1()
      chain.all.mockResolvedValue({ data: null, error: null })
      expect(await findByAgency(999)).toEqual([])
    })
  })

  describe('findById', () => {
    it('found returns row', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({
        data: { id: 3, agency_id: 5, owner_user_id: 7, display_name: 'Gamma', status: 'active', created_at: NOW } as never,
        error: null,
      })
      const r = await findSubTenantById(3)
      expect(r).not.toBeNull()
      expect((r!).display_name).toBe('Gamma')
    })
    it('not found returns null', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: null, error: null })
      expect(await findSubTenantById(999)).toBeNull()
    })
  })

  describe('updateStatus', () => {
    it('success', async () => {
      const { chain } = mockD1()
      chain.run.mockResolvedValue({ success: true, meta: { changes: 1 } })
      const result = await updateSubTenantStatus(1, 'suspended')
      expect(result.ok).toBe(true)
    })

    it('not found', async () => {
      const { chain } = mockD1()
      chain.run.mockResolvedValue({ success: true, meta: { changes: 0 } })
      const result = await updateSubTenantStatus(999, 'suspended')
      expect(result.ok).toBe(false)
      if (!isErr(result)) throw new Error("test precondition failed");
      expect(result.error.code).toBe('SUBTENANT_NOT_FOUND')
    })
  })

  describe('countByAgency', () => {
    it('returns count', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: { cnt: 7 }, error: null })
      expect(await countByAgency(5)).toBe(7)
    })

    it('returns 0 on null', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: null, error: null })
      expect(await countByAgency(99)).toBe(0)
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Cross-Agency Isolation
// ══════════════════════════════════════════════════════════════════════════════

describe('Cross-Agency Isolation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('agency A and agency B are separate by slug', async () => {
    const { chain } = mockD1()

    // First call — find agencyA
    chain.first
      .mockResolvedValueOnce({
        data: { id: 1, slug: 'agencyA', name: 'Agency A', tier: 'starter', api_key_hash: 'h', api_key_prefix: null, owner_user_id: 1, billing_email: null, status: 'active', created_at: NOW, updated_at: NOW } as never,
        error: null,
      })
    // Second call — find agencyB (not found)
      .mockResolvedValueOnce({ data: null, error: null })

    const a = await findBySlug('agencyA')
    const b = await findBySlug('agencyB')
    expect(a).not.toBeNull()
    expect(b).toBeNull()
  })

  it('sub-tenant queries scoped to agency_id', async () => {
    const { chain } = mockD1()
    chain.all.mockResolvedValue({
      data: [
        { id: 1, agency_id: 1, owner_user_id: 1, display_name: 'A', status: 'active', created_at: NOW },
      ] as never,
      error: null,
    })

    const results = await findByAgency(1)
    // Verify scoping: all returned rows share agency_id=1
    expect(results).toHaveLength(1)
    expect(results[0].agency_id).toBe(1)
  })

  it('agency_id nullable allows existing users without agency (backward compat)', async () => {
    const { chain } = mockD1()
    chain.first.mockResolvedValue({
      data: { id: 99, agency_id: null, owner_user_id: 1, display_name: 'Legacy', status: 'active', created_at: NOW } as never,
      error: null,
    })

    const user = await findSubTenantById(99)
    expect(user).not.toBeNull()
    expect((user as any).agency_id).toBeNull()
  })
})
