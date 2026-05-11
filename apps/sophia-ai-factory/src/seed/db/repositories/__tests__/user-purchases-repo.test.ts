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

  it('no credits left: returns false, no decrement', async () => {
    const { queryBuilder } = mockDbClient()
    // First single call returns 0 credits
    queryBuilder.single.mockResolvedValueOnce({ data: { credits_remaining: 0 }, error: null })

    const result = await decrementCredits('purchase_123')

    expect(result).toBe(false)
    // Should not attempt update
    expect(queryBuilder.update).not.toHaveBeenCalled()
  })

  it('purchase not found: returns false', async () => {
    const { queryBuilder } = mockDbClient()
    // single returns null (not found)
    queryBuilder.single.mockResolvedValueOnce({ data: null, error: null })

    const result = await decrementCredits('purchase_123')

    expect(result).toBe(false)
  })
})
