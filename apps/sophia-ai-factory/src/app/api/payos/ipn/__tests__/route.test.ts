process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Tier } from '@/seed/types'

// Setup in-memory mock database state
const mockDbEvents = new Map<string, { event_id: string; processed: number; amount: number; status?: string }>()
const mockPendingOrders = new Map<string, Array<{ order_id: string; tier: string; invoice_url: string | null; period: string }>>()
let orgIdForUser: string | null = 'org_123'
let existingSubId: string | null = 'sub_123'
let batchFailMode = false
let processShouldThrow = false
let selectFailMode = false

vi.mock('@/land/payments/payos', () => ({
  FEATURE_PAYOS: true,
  verifyPayOsWebhook: vi.fn(async () => true),
  payOsIpnSchema: {
    safeParse: vi.fn((body: any) => ({
      success: true,
      data: {
        success: body.success !== false,
        signature: 'valid-signature',
        data: {
          orderCode: body.orderCode || 123456,
          amount: body.amount || 4975000,
          description: body.description || 'Sophia BASIC - 1700000000000',
          paymentLinkId: body.paymentLinkId || 'link_123',
        },
      },
    })),
  },
  parseUserIdFromPayOsDescription: vi.fn((desc: string) => {
    if (desc.includes('sophia_')) {
      const match = desc.match(/sophia_([^_]+)_\d+/)
      return match ? match[1] : null
    }
    return null
  }),
  getPayOsTierConfig: vi.fn((tier: Tier) => {
    const map: Record<Tier, number> = {
      BASIC: 4975000,
      PREMIUM: 9975000,
      ENTERPRISE: 19975000,
      MASTER: 124975000,
    }
    return { tier, vndAmount: map[tier] || 4975000, usdAmount: 199 }
  }),
}))

vi.mock('@/seed/db/client', () => {
  const mockDb = {
    from: vi.fn((table: string) => {
      const queryBuilder: any = {
        insert: vi.fn(async (row: any) => {
          if (table === 'payos_events') {
            if (mockDbEvents.has(row.event_id)) {
              return { error: new Error('UNIQUE constraint failed') }
            }
            mockDbEvents.set(row.event_id, { ...row })
            return { error: null }
          }
          return { error: null }
        }),
        select: vi.fn((cols?: string) => {
          queryBuilder._action = 'select'
          return queryBuilder
        }),
        update: vi.fn((updates: any) => {
          queryBuilder._action = 'update'
          queryBuilder._updates = updates
          return queryBuilder
        }),
        delete: vi.fn(() => {
          queryBuilder._action = 'delete'
          return queryBuilder
        }),
        eq: vi.fn((col: string, val: any) => {
          if (!queryBuilder._filters) {
            queryBuilder._filters = []
          }
          queryBuilder._filters.push({ col, val })
          return queryBuilder
        }),
        single: vi.fn(async () => {
          if (processShouldThrow) {
            throw new Error('Database connection lost')
          }
          if (table === 'payos_events') {
            const eventIdFilter = queryBuilder._filters?.find((f: any) => f.col === 'event_id')
            const row = eventIdFilter ? mockDbEvents.get(eventIdFilter.val) : null
            if (selectFailMode) {
              return { data: null, error: new Error('SELECT failed') }
            }
            return { data: row ? { processed: row.processed } : null, error: null }
          }
          if (table === 'org_members') {
            return { data: orgIdForUser ? { org_id: orgIdForUser } : null, error: null }
          }
          if (table === 'subscriptions') {
            return { data: existingSubId ? { id: existingSubId } : null, error: null }
          }
          return { data: null, error: null }
        })
      }

      queryBuilder.then = (onfulfilled: any, onrejected: any) => {
        const runQuery = async () => {
          if (processShouldThrow && queryBuilder._action !== 'delete') {
            throw new Error('Database connection lost')
          }
          if (table === 'pending_orders') {
            if (selectFailMode) {
              return { data: null, error: new Error('SELECT failed') }
            }
            const allOrders: any[] = []
            for (const [userId, orders] of mockPendingOrders.entries()) {
              allOrders.push(...orders.map(o => ({ ...o, user_id: userId })))
            }
            return { data: allOrders, error: null }
          }
          if (table === 'payos_events' && queryBuilder._action === 'delete') {
            const eventIdFilter = queryBuilder._filters?.find((f: any) => f.col === 'event_id')
            if (eventIdFilter) {
              mockDbEvents.delete(eventIdFilter.val)
            }
            return { error: null }
          }
          if (table === 'payos_events' && queryBuilder._action === 'update') {
            const eventIdFilter = queryBuilder._filters?.find((f: any) => f.col === 'event_id')
            if (eventIdFilter) {
              const row = mockDbEvents.get(eventIdFilter.val)
              if (row) {
                Object.assign(row, queryBuilder._updates)
                mockDbEvents.set(eventIdFilter.val, row)
              }
            }
            return { error: null }
          }
          return { data: [], error: null }
        }
        return runQuery().then(onfulfilled, onrejected)
      }

      return queryBuilder
    })
  }

  return {
    createServerClient: vi.fn(() => mockDb),
    getD1Raw: vi.fn(async () => {
      if (processShouldThrow) {
        throw new Error('D1 connection failure')
      }
      return {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...args: any[]) => ({ _sql: sql, _args: args })),
        })),
        batch: vi.fn(async (stmts: any[]) => {
          if (batchFailMode) {
            throw new Error('Batch statement error')
          }
          return []
        }),
      }
    }),
  }
})

vi.mock('@/seed/db/audit/audit-log', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/land/orders/pending-order-repo', () => ({
  markOrderCompleted: vi.fn().mockResolvedValue(undefined),
  markOrderFailed: vi.fn().mockResolvedValue(undefined),
}))

const { POST } = await import('../route')

function makeRequest(body: Record<string, any>) {
  return new NextRequest('http://localhost/api/payos/ipn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/payos/ipn', () => {
  beforeEach(() => {
    process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key'
    mockDbEvents.clear()
    mockPendingOrders.clear()
    orgIdForUser = 'org_123'
    existingSubId = 'sub_123'
    batchFailMode = false
    processShouldThrow = false
    selectFailMode = false
    vi.clearAllMocks()
  })

  it('successfully processes new webhook and locks it', async () => {
    mockPendingOrders.set('user123', [
      { order_id: 'sophia_user123_123', tier: 'BASIC', invoice_url: 'link_123', period: 'monthly' }
    ])

    const req = makeRequest({ orderCode: 123456, amount: 4975000, success: true })
    const res = await POST(req)
    console.log("RESPONSE BODY IS:", await res.text())
    expect(res.status).toBe(200)

    const event = mockDbEvents.get('payos_123456')
    expect(event).toBeDefined()
    expect(event?.processed).toBe(1)
    expect(event?.amount).toBe(4975000)
  })

  it('rejects duplicate processing when already processed (processed = 1)', async () => {
    mockDbEvents.set('payos_123456', { event_id: 'payos_123456', processed: 1, amount: 4975000 })

    const req = makeRequest({ orderCode: 123456, amount: 4975000, success: true })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.note).toBe('Already processed')
  })

  it('rejects duplicate processing when currently processing (processed = 0)', async () => {
    mockDbEvents.set('payos_123456', { event_id: 'payos_123456', processed: 0, amount: 4975000 })

    const req = makeRequest({ orderCode: 123456, amount: 4975000, success: true })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json() as any
    expect(body.error).toBe('Already processing')
  })

  it('returns 500 when database query fails during conflict check', async () => {
    mockDbEvents.set('payos_123456', { event_id: 'payos_123456', processed: 0, amount: 4975000 })
    selectFailMode = true

    const req = makeRequest({ orderCode: 123456, amount: 4975000, success: true })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json() as any
    expect(body.error).toBe('Database query failure')
  })

  it('releases lock and returns 400 when amount mismatches expected tier price', async () => {
    // Expected basic vndAmount = 4975000, we send 10000
    mockPendingOrders.set('user123', [
      { order_id: 'sophia_user123_123', tier: 'BASIC', invoice_url: 'link_123', period: 'monthly' }
    ])

    const req = makeRequest({ orderCode: 123456, amount: 10000, success: true })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toBe('Amount mismatch')

    // Lock must be deleted
    expect(mockDbEvents.has('payos_123456')).toBe(false)
  })

  it('releases lock and returns 400 when matching pending order is not found', async () => {
    // No matching pending order (link_123 matches in payload but we have no orders in DB)
    mockPendingOrders.set('user123', [])

    const req = makeRequest({ orderCode: 123456, amount: 4975000, success: true })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toBe('Order not found')

    // Lock must be deleted
    expect(mockDbEvents.has('payos_123456')).toBe(false)
  })

  it('releases lock and returns 500 when downstream processing throws an exception', async () => {
    mockPendingOrders.set('user123', [
      { order_id: 'sophia_user123_123', tier: 'BASIC', invoice_url: 'link_123', period: 'monthly' }
    ])
    processShouldThrow = true

    const req = makeRequest({ orderCode: 123456, amount: 4975000, success: true })
    const res = await POST(req)
    expect(res.status).toBe(500)

    // Lock must be deleted
    expect(mockDbEvents.has('payos_123456')).toBe(false)
  })

  it('successfully processes cancelled payment and marks order failed', async () => {
    mockPendingOrders.set('user123', [
      { order_id: 'sophia_user123_123', tier: 'BASIC', invoice_url: 'link_123', period: 'monthly' }
    ])

    const req = makeRequest({ orderCode: 123456, amount: 4975000, success: false })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const event = mockDbEvents.get('payos_123456')
    expect(event).toBeDefined()
    expect(event?.status).toBe('CANCELLED')
    expect(event?.processed).toBe(1)
  })
})
