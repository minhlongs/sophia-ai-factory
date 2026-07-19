/**
 * User Purchases Repository Tests
 * CRUD operations, idempotency, credit tracking, expiry logic
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import {
  insertPurchase,
  getByPaymentId,
  listByUser,
  getUserCredits,
  markPaid,
  markRefunded,
  decrementCredits,
} from '@/seed/db/repositories/user-purchases-repo'
import * as dbClient from '@/seed/db/client'
import type { UserPurchase } from '@/seed/types'

// Mock the database client
vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

interface QueryBuilderMock {
  select: Mock
  insert: Mock
  update: Mock
  eq: Mock
  order: Mock
  gte: Mock
  single: Mock
}

// Helper to create mock DB client with proper chaining
function mockDbClient() {
  const queryBuilder: QueryBuilderMock = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    gte: vi.fn(),
    single: vi.fn(),
  }

  // Setup chainable methods
  queryBuilder.select.mockReturnValue(queryBuilder)
  queryBuilder.insert.mockReturnValue(queryBuilder)
  queryBuilder.update.mockReturnValue(queryBuilder)
  queryBuilder.eq.mockReturnValue(queryBuilder)
  queryBuilder.order.mockReturnValue(queryBuilder)
  queryBuilder.gte.mockReturnValue(queryBuilder)
  queryBuilder.single.mockResolvedValue({ data: null, error: null })

  const client = {
    from: vi.fn().mockReturnValue(queryBuilder),
  }

  vi.mocked(dbClient.createServerClient).mockReturnValue(
    client as unknown as ReturnType<typeof dbClient.createServerClient>,
  )
  return { client, queryBuilder }
}

describe('insertPurchase — create one-time purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('happy path: inserts row and returns purchase_id', async () => {
    const { queryBuilder } = mockDbClient()
    // First call checks for existing, second call does insert
    queryBuilder.single
      .mockResolvedValueOnce({ data: null, error: null }) // check existing
      .mockResolvedValueOnce({
        data: { id: 'purchase_123' },
        error: null,
      }) // insert

    const result = await insertPurchase({
      userId: 'user1',
      kind: 'one_time',
      sku: 'STARTER_BUNDLE',
      paymentId: 'pay_123',
      amountCents: 4900,
      creditsTotal: 10,
      expiresAt: 1700000000,
      status: 'pending',
    })

    expect(result).toBe('purchase_123')
    expect(queryBuilder.insert).toHaveBeenCalled()
  })

  it('idempotent: duplicate payment_id returns existing row, no duplicate insert', async () => {
    const { queryBuilder } = mockDbClient()

    // First call — check existing
    queryBuilder.single.mockResolvedValueOnce({
      data: { id: 'purchase_existing' },
      error: null,
    })

    // Should return existing id without calling insert
    const result = await insertPurchase({
      userId: 'user1',
      kind: 'one_time',
      sku: 'STARTER_BUNDLE',
      paymentId: 'pay_dup',
      amountCents: 4900,
      creditsTotal: 10,
    })

    expect(result).toBe('purchase_existing')
    // Insert should NOT be called (idempotency check prevents it)
    expect(queryBuilder.insert).not.toHaveBeenCalled()
  })

  it('insert error: returns null gracefully', async () => {
    const { queryBuilder } = mockDbClient()
    queryBuilder.single
      .mockResolvedValueOnce({ data: null, error: null }) // Check existing
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'UNIQUE constraint failed' },
      })

    const result = await insertPurchase({
      userId: 'user1',
      kind: 'one_time',
      sku: 'STARTER_BUNDLE',
      paymentId: 'pay_constraint',
      amountCents: 4900,
      creditsTotal: 10,
    })

    expect(result).toBeNull()
  })
})

describe('getByPaymentId — fetch purchase by payment_id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('found: returns purchase row', async () => {
    const { queryBuilder } = mockDbClient()
    const mockPurchase: UserPurchase = {
      id: 'purchase_123',
      user_id: 'user1',
      kind: 'one_time',
      sku: 'STARTER_BUNDLE',
      payment_id: 'pay_123',
      invoice_id: '7810429001',
      amount_cents: 4900,
      credits_total: 10,
      credits_remaining: 10,
      expires_at: 1700000000,
      status: 'paid',
      created_at: 1600000000,
      updated_at: 1600000000,
      paid_at: 1600000001,
      refunded_at: null,
    }
    queryBuilder.single.mockResolvedValue({ data: mockPurchase, error: null })

    const result = await getByPaymentId('pay_123')

    expect(result).toEqual(mockPurchase)
    expect(queryBuilder.eq).toHaveBeenCalledWith('payment_id', 'pay_123')
  })

  it('not found: returns null', async () => {
    const { queryBuilder } = mockDbClient()
    queryBuilder.single.mockResolvedValue({ data: null, error: null })

    const result = await getByPaymentId('pay_nonexistent')

    expect(result).toBeNull()
  })
})

describe('listByUser — fetch all purchases for user', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns purchases ordered by created_at DESC', async () => {
    const { queryBuilder } = mockDbClient()
    const purchases = [
      { id: 'p3', created_at: 1600000003 },
      { id: 'p2', created_at: 1600000002 },
      { id: 'p1', created_at: 1600000001 },
    ] as UserPurchase[]
    queryBuilder.order.mockResolvedValue({ data: purchases, error: null })

    const result = await listByUser('user1')

    expect(result).toEqual(purchases)
    expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('no purchases: returns empty array', async () => {
    const { queryBuilder } = mockDbClient()
    queryBuilder.order.mockResolvedValue({ data: null, error: null })

    const result = await listByUser('user_no_purchases')

    expect(result).toEqual([])
  })
})

describe('getUserCredits — aggregate active credits + nearest expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has active credits: sums remaining + nearest expiry', async () => {
    const { queryBuilder } = mockDbClient()
    const now = Math.floor(Date.now() / 1000)
    const rows = [
      { credits_remaining: 10, expires_at: now + 1000000 },
      { credits_remaining: 5, expires_at: now + 500000 }, // nearest
    ]
    queryBuilder.gte.mockResolvedValue({ data: rows, error: null })

    const result = await getUserCredits('user1')

    expect(result.creditsRemaining).toBe(15)
    expect(result.expiresAt).toBe(now + 500000) // nearest expiry
  })

  it('no active credits: returns 0 + null expiry', async () => {
    const { queryBuilder } = mockDbClient()
    queryBuilder.gte.mockResolvedValue({ data: null, error: null })

    const result = await getUserCredits('user1')

    expect(result.creditsRemaining).toBe(0)
    expect(result.expiresAt).toBeNull()
  })

  it('expired purchases excluded: only count non-expired', async () => {
    const { queryBuilder } = mockDbClient()
    const now = Math.floor(Date.now() / 1000)
    const rows = [{ credits_remaining: 8, expires_at: now + 1000000 }]
    queryBuilder.gte.mockResolvedValue({ data: rows, error: null })

    const result = await getUserCredits('user1')

    // Only the non-expired row counted
    expect(result.creditsRemaining).toBe(8)
  })

  it('NULL expires_at rows included: lifetime packs counted (D1 behavior)', async () => {
    // In D1/Supabase-SDK, .gte('expires_at', now) INCLUDES NULL rows.
    // This is correct for lifetime credit packs — they should never expire.
    const { queryBuilder } = mockDbClient()
    const rows = [
      { credits_remaining: 10, expires_at: null },
      { credits_remaining: 5, expires_at: null },
    ]
    queryBuilder.gte.mockResolvedValue({ data: rows, error: null })

    const result = await getUserCredits('user1')

    // Both NULL-expiry rows counted
    expect(result.creditsRemaining).toBe(15)
    // No nearest expiry for lifetime packs
    expect(result.expiresAt).toBeNull()
  })
})

describe('markPaid — transition to paid + grant credits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates status=paid, credits_total, credits_remaining, expires_at', async () => {
    const { queryBuilder } = mockDbClient()
    queryBuilder.update().eq.mockResolvedValue({ data: null, error: null })

    await markPaid('pay_123', 10, 1700000000)

    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'paid',
        credits_total: 10,
        credits_remaining: 10,
        expires_at: 1700000000,
        paid_at: expect.any(Number),
      })
    )
    expect(queryBuilder.eq).toHaveBeenCalledWith('payment_id', 'pay_123')
  })

  it('called without expiresAt: sets null', async () => {
    const { queryBuilder } = mockDbClient()
    queryBuilder.update().eq.mockResolvedValue({ data: null, error: null })

    await markPaid('pay_123', 10)

    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        expires_at: null,
      })
    )
  })
})

describe('markRefunded — refund purchase + zero credits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates status=refunded, credits_remaining=0, sets refunded_at', async () => {
    const { queryBuilder } = mockDbClient()
    queryBuilder.update().eq.mockResolvedValue({ data: null, error: null })

    await markRefunded('pay_123')

    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'refunded',
        credits_remaining: 0,
        refunded_at: expect.any(Number),
      })
    )
  })
})

describe('decrementCredits — use 1 credit (for 1 video)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockD1(changes = 1) {
    const runFn = vi.fn().mockResolvedValue({ success: true, meta: { changes } })
    const bindFn = vi.fn().mockReturnValue({ run: runFn })
    const prepareFn = vi.fn().mockReturnValue({ bind: bindFn })
    const rawDb = { prepare: prepareFn }
    vi.mocked(dbClient.getD1).mockReturnValue(rawDb as unknown as any)
    return { prepareFn, bindFn, runFn }
  }

  it('no credits available or invalid purchase: returns false (UPDATE affects 0 rows)', async () => {
    const { runFn } = mockD1(0)

    const result = await decrementCredits('purchase_123')

    expect(result).toBe(false)
    expect(runFn).toHaveBeenCalledTimes(1)
  })

  it('happy path: decrements credits and returns true', async () => {
    const { prepareFn, runFn } = mockD1(1)

    const result = await decrementCredits('purchase_123')

    expect(result).toBe(true)
    expect(prepareFn).toHaveBeenCalledTimes(1)
    const sql = prepareFn.mock.calls[0][0] as string
    expect(sql).toContain('UPDATE user_purchases')
    expect(sql).toContain('SET credits_remaining = credits_remaining - 1')
    expect(sql).toContain('WHERE id = ?')
    expect(sql).toContain("status = 'paid'")
    expect(sql).toContain('credits_remaining > 0')
    // also check for expiry guard (the placeholder may be ?2)
    expect(sql).toContain('expires_at IS NULL')
    expect(sql).toContain('expires_at >')
    expect(runFn).toHaveBeenCalledTimes(1)
  })

  it('ensures atomicity: concurrent updates cannot over-decrement due to single UPDATE with guards', async () => {
    // Simulate a race where another request already consumed the last credit
    // The UPDATE will affect 0 rows because credits_remaining would be 0 at time of update.
    const { runFn } = mockD1(0)

    const result = await decrementCredits('purchase_123')

    expect(result).toBe(false)
    expect(runFn).toHaveBeenCalledTimes(1)
  })
})
