/**
 * Failure-injection suite for POST /api/payos/ipn — duplicate webhook delivery
 * (replay) and forged or tampered signatures.
 *
 * These paths guard tier activation, the flow the platform must never double
 * for one paid orderCode. The suite drives the real handler against an
 * in-memory D1 so the ON CONFLICT lock is exercised, not mocked away: the
 * winner of a race is decided by the same INSERT ... DO NOTHING RETURNING the
 * route runs in production.
 *
 * @module app/api/payos/ipn/__tests__/replay-and-forgery
 */

process.env.PAYOS_CHECKSUM_KEY = 'integration-checksum-key'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/** event_id -> row mirroring the payos_events table. */
const eventRows = new Map<string, { processed: number; amount: number; status: string }>()
/** order_id -> tier, mirroring pending_orders. */
const pendingOrderRows = new Map<string, { tier: string; invoice_url: string; user_id: string }>()

let signatureVerification: 'accept' | 'reject' = 'accept'
let schemaParsing: 'accept' | 'reject' = 'accept'
const subscriptionCommits: Array<{ tier: string; orderId: string }> = []

vi.mock('@/land/payments/payos', () => ({
  FEATURE_PAYOS: true,
  verifyPayOsWebhook: vi.fn(async () => signatureVerification === 'accept'),
  getPayOsTierConfig: vi.fn(() => ({ tier: 'BASIC', vndAmount: 4975000, usdAmount: 199 })),
  payOsIpnSchema: {
    safeParse: vi.fn((body: Record<string, unknown>) => {
      if (schemaParsing === 'reject') {
        return { success: false, error: { flatten: () => ({}) } }
      }
      const data = body.data as Record<string, unknown> | undefined
      return {
        success: true,
        data: {
          success: body.success !== false,
          signature: 'any-signature',
          data: {
            orderCode: data?.orderCode ?? 0,
            amount: data?.amount ?? 0,
            description: data?.description ?? 'Sophia BASIC - monthly',
            paymentLinkId: data?.paymentLinkId ?? '',
          },
        },
      }
    }),
  },
}))

vi.mock('@/seed/auth/workspace-access', () => ({
  resolveOrgId: vi.fn(async () => 'org_ceo_778899'),
}))

vi.mock('@/seed/db/client', () => {
  const queryBuilder = {
    _table: '',
    _action: undefined as string | undefined,
    _filters: [] as Array<{ col: string; val: unknown }>,
    _updates: undefined as Record<string, unknown> | undefined,
    select() {
      queryBuilder._action = 'select'
      return queryBuilder
    },
    eq(col: string, val: unknown) {
      queryBuilder._filters.push({ col, val })
      return queryBuilder
    },
    single() {
      return Promise.resolve({ data: null, error: null })
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null })
    },
    update(updates: Record<string, unknown>) {
      queryBuilder._action = 'update'
      queryBuilder._updates = updates
      return queryBuilder
    },
    delete() {
      queryBuilder._action = 'delete'
      return queryBuilder
    },
    then(resolve: (value: unknown) => void) {
      if (queryBuilder._table === 'payos_events' && queryBuilder._action === 'update') {
        const eventId = queryBuilder._filters.find((f) => f.col === 'event_id')?.val as string
        const row = eventId ? eventRows.get(eventId) : undefined
        if (row && queryBuilder._updates) {
          Object.assign(row, queryBuilder._updates)
        }
        resolve({ error: null })
        return
      }
      const rows = (() => {
        if (queryBuilder._table === 'payos_events' && queryBuilder._action === 'select') {
          const eventId = queryBuilder._filters.find((f) => f.col === 'event_id')?.val as string
          const row = eventId ? eventRows.get(eventId) : undefined
          return row ? [{ processed: row.processed }] : []
        }
        if (queryBuilder._table === 'pending_orders' && queryBuilder._action === 'select') {
          return [...pendingOrderRows.entries()].map(([orderId, order]) => ({
            order_id: orderId,
            payment_method: 'payos',
            status: 'pending',
            ...order,
          }))
        }
        return []
      })()
      resolve({ data: rows, error: null })
    },
  }

  const db = {
    from(table: string) {
      queryBuilder._table = table
      queryBuilder._action = undefined
      queryBuilder._filters = []
      queryBuilder._updates = undefined
      return queryBuilder
    },
  }

  const d1 = {
    prepare(sql: string) {
      const stmt = {
        _sql: sql,
        _bindArgs: [] as unknown[],
        bind(...args: unknown[]) {
          stmt._bindArgs = args
          return stmt
        },
        async all() {
          const sqlLower = (stmt._sql || '').toLowerCase()
          const isLockInsert =
            sqlLower.includes('insert into payos_events') &&
            // The conflict guard is the whole claim. Without it every delivery
            // inserts and wins, so the duplicate tests would go green on a
            // double activation — the mock honours the clause, not a JS guess.
            sqlLower.includes('on conflict') &&
            sqlLower.includes('do nothing') &&
            sqlLower.includes('returning')
          if (!isLockInsert) {
            // An insert that lost its guard behaves like plain SQLite REPLACE:
            // it always succeeds and always claims the row.
            const eventId = stmt._bindArgs[0] as string
            eventRows.set(eventId, {
              processed: 0,
              amount: stmt._bindArgs[3] as number,
              status: stmt._bindArgs[2] as string,
            })
            return { results: [{ processed: 0 }], success: true }
          }
          const eventId = stmt._bindArgs[0] as string
          if (eventRows.has(eventId)) {
            // A concurrent delivery already holds the row, so the insert yields
            // no RETURNING row and this caller learns it lost the race.
            return { results: [], success: true }
          }
          eventRows.set(eventId, { processed: 0, amount: stmt._bindArgs[3] as number, status: stmt._bindArgs[2] as string })
          return { results: [{ processed: 0 }], success: true }
        },
        async first() {
          if (sql.includes('SELECT processed')) {
            const row = eventRows.get(stmt._bindArgs[0] as string)
            return row ? { processed: row.processed } : null
          }
          return null
        },
        async run() {
          return { success: true }
        },
      }
      return stmt
    },
    async batch(statements: Array<{ _sql: string; _bindArgs: unknown[] }>) {
      for (const stmt of statements) {
        const sql = stmt._sql.toLowerCase()
        if (sql.includes('insert into subscriptions')) {
          subscriptionCommits.push({ tier: stmt._bindArgs[1] as string, orderId: stmt._bindArgs[0] as string })
        }
        if (sql.includes('update pending_orders')) {
          subscriptionCommits.push({ tier: 'order_completed', orderId: stmt._bindArgs[3] as string })
        }
      }
      return statements.map(() => ({ success: true }))
    },
  }

  return { createServerClient: () => db, getD1: async () => d1 }
})

vi.mock('@/seed/db/audit/audit-log', () => ({ recordAudit: vi.fn() }))

const { POST } = await import('../route')

const ORDER_CODE = 778899
const PAYMENT_LINK = 'link_integration_778899'

function makeDelivery(options: { success?: boolean; staleAgeSeconds?: number } = {}): NextRequest {
  const data: Record<string, unknown> = {
    orderCode: ORDER_CODE,
    amount: 4975000,
    description: 'Sophia BASIC - monthly',
    paymentLinkId: PAYMENT_LINK,
    code: '00',
    desc: 'success',
  }
  if (options.staleAgeSeconds !== undefined) {
    data.timestamp = Math.floor(Date.now() / 1000) - options.staleAgeSeconds
  }
  return new NextRequest('http://localhost/api/payos/ipn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '00', desc: 'success', success: options.success ?? true, data, signature: 'sig' }),
  })
}

describe('POST /api/payos/ipn — duplicate delivery', () => {
  beforeEach(() => {
    eventRows.clear()
    pendingOrderRows.clear()
    subscriptionCommits.length = 0
    signatureVerification = 'accept'
    schemaParsing = 'accept'
    vi.clearAllMocks()
    pendingOrderRows.set('sophia_ceo_778899', {
      tier: 'BASIC',
      invoice_url: PAYMENT_LINK,
      user_id: 'ceo_user',
    })
  })

  it('activates the tier exactly once when the same delivery arrives 50 times at once', async () => {
    const deliveries = Array.from({ length: 50 }, () => makeDelivery())
    const responses = await Promise.all(deliveries.map((req) => POST(req)))

    const bodies = await Promise.all(responses.map(async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> })))
    const activated = bodies.filter((b) => b.status === 200 && b.body.received === true && !('note' in b.body))
    const refused = bodies.filter((b) => b.status === 409 || b.body.note === 'Already processed')

    // Exactly one delivery owns the event row and activates the tier; the other
    // 49 are refused, never re-applied.
    expect(activated).toHaveLength(1)
    expect(refused).toHaveLength(49)

    // The subscription commit for the order happened once.
    const orderCompletions = subscriptionCommits.filter((c) => c.orderId === 'sophia_ceo_778899' && c.tier === 'order_completed')
    expect(orderCompletions).toHaveLength(1)

    // The event row is marked processed, not left open for a later replay.
    expect(eventRows.get(`payos_${ORDER_CODE}`)?.processed).toBe(1)
  })

  it('refuses a replay sent after the tier is already activated', async () => {
    const first = await POST(makeDelivery())
    expect(first.status).toBe(200)

    const replay = await POST(makeDelivery())
    expect(replay.status).toBe(200)
    expect(await replay.json()).toMatchObject({ note: 'Already processed' })
  })

  it('refuses a concurrent delivery that arrives while the first is still in flight', async () => {
    eventRows.set(`payos_${ORDER_CODE}`, { processed: 0, amount: 4975000, status: 'PAID' })

    const res = await POST(makeDelivery())
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'Already processing' })
    expect(subscriptionCommits).toHaveLength(0)
  })

  it('refuses a delivery whose event timestamp is older than the replay window', async () => {
    const res = await POST(makeDelivery({ staleAgeSeconds: 3600 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'REPLAY_DETECTED' })
    expect(eventRows.has(`payos_${ORDER_CODE}`)).toBe(false)
    expect(subscriptionCommits).toHaveLength(0)
  })
})

describe('POST /api/payos/ipn — forged and tampered signatures', () => {
  beforeEach(() => {
    eventRows.clear()
    pendingOrderRows.clear()
    subscriptionCommits.length = 0
    signatureVerification = 'accept'
    schemaParsing = 'accept'
    vi.clearAllMocks()
    pendingOrderRows.set('sophia_ceo_778899', {
      tier: 'BASIC',
      invoice_url: PAYMENT_LINK,
      user_id: 'ceo_user',
    })
  })

  it('rejects a forged signature with 401 and activates nothing', async () => {
    signatureVerification = 'reject'

    const res = await POST(makeDelivery())
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'Invalid signature' })
    expect(eventRows.size).toBe(0)
    expect(subscriptionCommits).toHaveLength(0)
  })

  it('rejects a malformed payload with 400 before the lock is taken', async () => {
    schemaParsing = 'reject'

    const res = await POST(makeDelivery())
    expect(res.status).toBe(400)
    expect(eventRows.size).toBe(0)
    expect(subscriptionCommits).toHaveLength(0)
  })

  it('keeps rejecting a forged signature across repeated retries', async () => {
    signatureVerification = 'reject'

    const responses = await Promise.all(Array.from({ length: 10 }, () => POST(makeDelivery())))
    for (const res of responses) {
      expect(res.status).toBe(401)
    }
    expect(eventRows.size).toBe(0)
    expect(subscriptionCommits).toHaveLength(0)
  })
})
