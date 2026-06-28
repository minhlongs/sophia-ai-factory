vi.hoisted(() => { process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key' })

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Tier } from '@/seed/types'

// Mock payos module FIRST (before route import)
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
    if (desc.includes('sophia_')) return desc.match(/sophia_(\w+)/)?.[1] || 'user123'
    return 'user123'
  }),
  getPayOsTierConfig: vi.fn((tier: Tier) => {
    const map: Record<Tier, number> = { BASIC: 4975000, PREMIUM: 9975000, ENTERPRISE: 19975000, MASTER: 124975000 }
    return { tier, vndAmount: map[tier] || 4975000, usdAmount: 199 }
  }),
}))

// Shared mock state — declared OUTSIDE mock factory so test can reference it
const mockDbEvents = new Map<string, any>()
const mockPendingOrders = new Map<string, Array<{ order_id: string; tier: string; invoice_url: string | null; period: string }>>()
let orgIdForUser: string | null = 'org_123'
let existingSubId: string | null = 'sub_123'
let batchFailMode = false
let processShouldThrow = false
let selectFailMode = false

// Single unified mock for @/seed/db/client — includes from/createServerClient AND getD1
vi.mock('@/seed/db/client', () => {
  let queryBuilder: any
  const mockDb = {
    from: vi.fn((table: string) => {
      queryBuilder = {
        _table: table,
        _action: undefined as string | undefined,
        _updates: undefined as Record<string, any> | undefined,
        _filters: [] as any[],
        _bindArgs: [] as any[],
        select(cols: string) {
          this._action = 'select'
          this._cols = cols
          return this
        },
        eq(col: string, val: any) {
          this._filters.push({ col, op: 'eq', val })
          return this
        },
        neq(col: string, val: any) {
          this._filters.push({ col, op: 'neq', val })
          return this
        },
        single() { return this },
        limit(n: number) { return this },
        insert(data: any) {
          this._action = 'insert'
          this._insertData = data
          return this
        },
        update(data: any) {
          this._action = 'update'
          this._updates = data
          return this
        },
        delete() {
          this._action = 'delete'
          return this
        },
        then(resolve: any, reject: any) {
          const result = (() => {
          // Handle payos_events INSERT (lock acquisition)
          if (this._table === 'payos_events' && this._action === 'insert') {
            if (selectFailMode) throw new Error('SELECT failed')
            const eventId = this._bindArgs[0]
            const existing = mockDbEvents.get(eventId)
            if (existing) {
              return Promise.resolve({ results: [], error: null })
            }
            const row = {
              event_id: eventId,
              order_code: this._bindArgs[1],
              status: this._bindArgs[2],
              amount: this._bindArgs[3],
              currency: this._bindArgs[4],
              payload: this._bindArgs[5],
              processed: 0,
              created_at: this._bindArgs[6],
            }
            mockDbEvents.set(eventId, row)
            return Promise.resolve({ results: [row], error: null })
          }
          // Handle payos_events SELECT (check lock state)
          if (this._table === 'payos_events' && this._action === 'select') {
            if (selectFailMode) throw new Error('SELECT failed')
            const eventIdFilter = this._filters?.find((f: any) => f.col === 'event_id')
            if (eventIdFilter) {
              const row = mockDbEvents.get(eventIdFilter.val)
              if (row) return { data: [{ processed: row.processed }], error: null }
            }
            return { data: [], error: null }
          }
          // Handle org_members
          if (this._table === 'org_members') {
            return { data: orgIdForUser ? { org_id: orgIdForUser } : null, error: null }
          }
          // Handle pending_orders SELECT
          if (this._table === 'pending_orders' && this._action === 'select') {
            const allOrders: any[] = []
            for (const [uid, orders] of mockPendingOrders.entries()) {
              allOrders.push(...orders.map((o: any) => ({ ...o, user_id: uid })))
            }
            let filtered = allOrders
            for (const f of this._filters) {
              if (f.op === 'eq') filtered = filtered.filter((r: any) => r[f.col] === f.val)
            }
            if (this._cols === 'tier') {
              return { data: filtered.map((r: any) => ({ tier: r.tier })), error: null }
            }
            return { data: filtered, error: null }
          }
          // Handle pending_orders UPDATE (markOrderCompleted)
          if (this._table === 'pending_orders' && this._action === 'update') {
            const orderIdFilter = this._filters?.find((f: any) => f.col === 'order_id')
            if (orderIdFilter) {
              for (const [uid, orders] of mockPendingOrders.entries()) {
                const idx = orders.findIndex(o => o.order_id === orderIdFilter.val)
                if (idx !== -1) {
                  orders[idx] = { ...orders[idx], ...this._updates }
                  break
                }
              }
            }
            return { data: [], error: null }
          }
          // Handle subscriptions SELECT
          if (this._table === 'subscriptions' && this._action === 'select') {
            return { data: existingSubId ? [{ id: existingSubId }] : [], error: null }
          }
          // Handle subscriptions UPDATE
          if (this._table === 'subscriptions' && this._action === 'update') {
            return { data: [], error: null }
          }
          // Handle organizations UPDATE
          if (this._table === 'organizations' && this._action === 'update') {
            return { data: [], error: null }
          }
          // Handle audit_log INSERT
          if (this._table === 'audit_log') {
            return { data: [{ id: 'audit_1' }], error: null }
          }
          // Handle payos_events DELETE
          if (this._table === 'payos_events' && this._action === 'delete') {
            const eventIdFilter = this._filters?.find((f: any) => f.col === 'event_id')
            if (eventIdFilter) {
              mockDbEvents.delete(eventIdFilter.val)
            }
            return { error: null }
          }
          // Handle payos_events UPDATE (mark processed)
          if (this._table === 'payos_events' && this._action === 'update') {
            const eventIdFilter = this._filters?.find((f: any) => f.col === 'event_id')
            if (eventIdFilter) {
              const row = mockDbEvents.get(eventIdFilter.val)
              if (row) {
                Object.assign(row, this._updates)
                mockDbEvents.set(eventIdFilter.val, row)
              }
            }
            return { error: null }
          }
          return { data: [], error: null }
          })()
          resolve(result)
        },
      }
      return queryBuilder
    }),
  }
  const d1Root: any = {
    batch: vi.fn(async (stmts: any[]) => {
      if (batchFailMode) throw new Error('batch failed')
      return stmts.map((s: any) => ({ success: true, ...s }))
    }),
    run: vi.fn(async () => ({ success: true })),
    exec: vi.fn(async () => ({ success: true })),
    prepare: vi.fn((sql: string) => {
      const stmt: any = {
        _sql: sql,
        bind(...args: any[]) {
          stmt._bindArgs = args
          return stmt
        },
        first() {
          if (stmt._sql?.includes('subscriptions') && stmt._sql?.includes('SELECT')) {
            return Promise.resolve(existingSubId ? { id: existingSubId } : null)
          }
          if (stmt._sql?.includes('payos_events') && stmt._sql?.includes('SELECT')) {
            const eventId = stmt._bindArgs?.[0]
            const row = eventId ? mockDbEvents.get(eventId) : null
            return Promise.resolve(row ? { processed: row.processed } : null)
          }
          return Promise.resolve(null)
        },
        all() {
          if (stmt._sql?.toLowerCase().includes('insert into payos_events')) {
            const eventId = stmt._bindArgs?.[0]
            if (!eventId) return Promise.resolve({ results: [], error: null })
            if (mockDbEvents.has(eventId)) return Promise.resolve({ results: [], error: null })
            const row = {
              event_id: eventId,
              order_code: stmt._bindArgs?.[1],
              status: stmt._bindArgs?.[2],
              amount: stmt._bindArgs?.[3],
              currency: stmt._bindArgs?.[4],
              payload: stmt._bindArgs?.[5],
              processed: 0,
              created_at: stmt._bindArgs?.[6],
            }
            mockDbEvents.set(eventId, row)
            return Promise.resolve({ results: [row], error: null })
          }
          return Promise.resolve({ results: [], error: null })
        },
      }
      return stmt
    }),
  }
  return { createServerClient: vi.fn(() => mockDb), getD1: vi.fn(() => d1Root) }
})

// Mock audit log
vi.mock('@/seed/db/audit/audit-log', () => ({
  recordAudit: vi.fn(async () => {}),
}))

import { POST } from '../route'

function makeRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/payos/ipn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PayOS IPN Debug', () => {
  beforeEach(() => {
    mockDbEvents.clear()
    mockPendingOrders.clear()
    orgIdForUser = 'org_123'
    existingSubId = 'sub_123'
    batchFailMode = false
    processShouldThrow = false
    selectFailMode = false
    vi.clearAllMocks()
  })

  it('successfully processes new webhook', async () => {
    mockPendingOrders.set('user123', [
      { order_id: 'sophia_user123_123', tier: 'BASIC', invoice_url: 'link_123', period: 'monthly', payment_method: 'payos', status: 'pending' },
    ])

    const req = makeRequest({ orderCode: 123456, amount: 4975000, success: true })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const event = mockDbEvents.get('payos_123456')
    expect(event).toBeDefined()
    expect(event.processed).toBe(1)
  })
})
