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

// Single unified mock for @/seed/db/client — includes from/createServerClient AND getD1
vi.mock('@/seed/db/client', () => {
  let queryBuilder: any
  const mockDb = {
    from: vi.fn((table: string) => {
      queryBuilder = {
        _table: table,
        _action: undefined as string | undefined,
        _updates: undefined as Record<string, unknown> | undefined,
        _filters: [] as Array<{ col: string; val: unknown }>,
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
        select: vi.fn((_cols?: string) => {
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
        limit: vi.fn(() => queryBuilder),
        eq: vi.fn((col: string, val: any) => {
          if (!queryBuilder._filters) queryBuilder._filters = []
          queryBuilder._filters.push({ col, val })
          return queryBuilder
        }),
        single: vi.fn(async () => {
          if (processShouldThrow) throw new Error('Database connection lost')
          if (table === 'payos_events') {
            const eventIdFilter = queryBuilder._filters?.find((f: any) => f.col === 'event_id')
            const row = eventIdFilter ? mockDbEvents.get(eventIdFilter.val) : null
            if (selectFailMode) throw new Error('SELECT failed')
            return { data: row ? { processed: row.processed } : null, error: null }
          }
          if (table === 'org_members') {
            return { data: orgIdForUser ? { org_id: orgIdForUser } : null, error: null }
          }
          if (table === 'pending_orders') {
            const allOrders: any[] = []
            for (const [uid, orders] of mockPendingOrders.entries()) {
              allOrders.push(...orders.map((o: any) => ({ ...o, user_id: uid })))
            }
            return { data: allOrders, error: null }
          }
          if (table === 'subscriptions') {
            return { data: existingSubId ? { id: existingSubId } : null, error: null }
          }
          return { data: null, error: null }
        }),
      }
      // Thenable: enables both .single() and .then() chaining
      const runQuery = async () => {
        if (processShouldThrow && queryBuilder._action !== 'delete') {
          throw new Error('Database connection lost')
        }
        if (table === 'pending_orders') {
          if (selectFailMode) throw new Error('SELECT failed')
          const allOrders: any[] = []
          for (const [userId, orders] of mockPendingOrders.entries()) {
            allOrders.push(...orders.map(o => ({ ...o, user_id: userId })))
          }
          return { data: allOrders, error: null }
        }
        if (table === 'payos_events' && queryBuilder._action === 'select') {
          if (selectFailMode) throw new Error('SELECT failed')
          const eventIdFilter = queryBuilder._filters?.find((f: any) => f.col === 'event_id')
          const row = eventIdFilter ? mockDbEvents.get(eventIdFilter.val) : null
          return { data: row ? [{ processed: row.processed }] : [], error: null }
        }
        if (table === 'payos_events' && queryBuilder._action === 'delete') {
          const eventIdFilter = queryBuilder._filters?.find((f: any) => f.col === 'event_id')
          if (eventIdFilter) mockDbEvents.delete(eventIdFilter.val)
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
      queryBuilder.then = vi.fn((onfulfilled: any, onrejected: any) => {
        return runQuery().then(onfulfilled, onrejected)
      })
      return queryBuilder
    }),
    createServerClient: vi.fn(() => mockDb),
    getD1: vi.fn(() => {
      if (processShouldThrow) throw new Error('D1 connection failure')
      return {
        prepare: vi.fn((sql: string) => {
          const stmt: any = {
            _sql: sql,
            _bindArgs: undefined as string[] | undefined,
            bind: vi.fn(function (this: any, ...args: any[]) {
              this._bindArgs = args
              return this
            }),
            all: vi.fn(async () => {
              const sqlLower = (stmt._sql || '').toLowerCase()
              const tableMatch = sqlLower.match(/(?:insert into|update|select|delete from)\s+(\w+)/)
              const qTable = tableMatch ? tableMatch[1] : ''
              if (qTable === 'payos_events') {
                const eventId = stmt._bindArgs?.[0]
                const isDup = eventId && mockDbEvents.has(eventId)
                if (!isDup && eventId) {
                  mockDbEvents.set(eventId, {
                    event_id: eventId, processed: 0,
                    amount: stmt._bindArgs?.[3] || 0,
                    status: stmt._bindArgs?.[2] || 'PAID',
                  })
                  return { results: [{ event_id: eventId, processed: 0 }], success: true }
                }
                return { results: [], success: true }
              }
              if (qTable === 'subscriptions' && sqlLower.includes('insert')) {
                return { results: [{ processed: 0 }], success: true }
              }
              return { results: [], success: true }
            }),
            first: vi.fn(async () => {
              if (stmt._sql.includes('payos_events') && stmt._sql.includes('processed')) {
                if (selectFailMode) throw new Error('SELECT failed')
                const eventId = stmt._bindArgs?.[0]
                if (eventId) {
                  const row = mockDbEvents.get(eventId)
                  if (row) return { processed: row.processed }
                }
              }
              return null
            }),
            batch: vi.fn(async (stmts: any[]) => stmts.map(s => s)),
            run: vi.fn(async () => ({ success: true })),
          }
          return stmt
        }),
      }
    }),
  }
  return mockDb
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
      { order_id: 'sophia_user123_123', tier: 'BASIC', invoice_url: 'link_123', period: 'monthly' },
    ])

    const req = makeRequest({ orderCode: 123456, amount: 4975000, success: true })
    const res = await POST(req)
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
    expect(body.error).toBe('Internal processing error')
  })

  it('releases lock and returns 400 when amount mismatches expected tier price', async () => {
    mockPendingOrders.set('user123', [
      { order_id: 'sophia_user123_123', tier: 'BASIC', invoice_url: 'link_123', period: 'monthly' },
    ])

    const req = makeRequest({ orderCode: 123456, amount: 10000, success: true })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toBe('Amount mismatch')

    expect(mockDbEvents.has('payos_123456')).toBe(false)
  })

  it('releases lock and returns 400 when matching pending order is not found', async () => {
    mockPendingOrders.set('user123', [])

    const req = makeRequest({ orderCode: 123456, amount: 4975000, success: true })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toBe('No pending orders')

    expect(mockDbEvents.has('payos_123456')).toBe(false)
  })

  it('releases lock and returns 500 when downstream processing throws an exception', async () => {
    mockPendingOrders.set('user123', [
      { order_id: 'sophia_user123_123', tier: 'BASIC', invoice_url: 'link_123', period: 'monthly' },
    ])
    batchFailMode = true

    const req = makeRequest({ orderCode: 123456, amount: 4975000, success: true })
    const res = await POST(req)
    expect(res.status).toBe(500)

    expect(mockDbEvents.has('payos_123456')).toBe(false)
  })

  it('successfully processes cancelled payment and marks order failed', async () => {
    mockPendingOrders.set('user123', [
      { order_id: 'sophia_user123_123', tier: 'BASIC', invoice_url: 'link_123', period: 'monthly' },
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
