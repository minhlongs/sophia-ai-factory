/**
 * Regression coverage for the overage top-up event lock.
 *
 * The atomic lock (`INSERT ... ON CONFLICT DO NOTHING` + `meta.changes`) is what
 * makes top-up IPN processing idempotent. These tests pin every branch of the
 * acquisition path — fresh acquire, already-earned credit, in-flight rejection,
 * and stale-lock recovery — because each one decides whether a customer is
 * credited once, twice, or not at all.
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { acquireTopupEventLock } from '../overage-lock-manager'
import { resolveStaleLock } from '../topup-calculator'
import type { TopupIpnPayload } from '../types'

type RunResult = { success: boolean; meta?: { changes?: number } }

/** Route each prepared statement to the behaviour its SQL names. */
function db(over: {
  insert?: RunResult
  existing?: { processed: number; created_at: string } | null
  updateFails?: boolean
  statements?: string[]
} = {}) {
  const statements: string[] = []
  const client = {
    prepare: (sql: string) => {
      statements.push(sql)
      return {
        bind: () => ({
          run: async (): Promise<RunResult> => {
            if (sql.includes('INSERT INTO payment_events')) return over.insert ?? { success: true, meta: { changes: 1 } }
            if (sql.includes('UPDATE payment_events')) {
              if (over.updateFails) throw new Error('d1 unavailable')
              return { success: true, meta: { changes: 1 } }
            }
            return { success: true, meta: { changes: 0 } }
          },
          first: async () => {
            if (sql.includes('SELECT processed, created_at')) return over.existing ?? null
            return null
          },
        }),
      }
    },
  }
  return { client: client as unknown as Parameters<typeof acquireTopupEventLock>[0], statements }
}

const IPN = { payment_id: 'pay-1', payment_status: 'finished', price_amount: 25 } as unknown as TopupIpnPayload
const EVENT_ID = 'topup_pay-1_finished'

describe('acquireTopupEventLock', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('acquires the lock when the insert claims a new row', async () => {
    const { client } = db({ insert: { success: true, meta: { changes: 1 } } })
    await expect(acquire(client)).resolves.toEqual({ acquired: true })
  })

  it('records the top-up payload so a replay can be reconciled', async () => {
    const { client, statements } = db({ insert: { success: true, meta: { changes: 1 } } })
    await acquire(client)
    const insert = statements.find((s) => s.includes('INSERT INTO payment_events'))!
    expect(insert).toContain('ON CONFLICT(event_id) DO NOTHING')
  })

  it('replays an already-earned top-up as success without re-crediting', async () => {
    const { client } = db({
      insert: { success: true, meta: { changes: 0 } },
      existing: { processed: 1, created_at: new Date().toISOString() },
    })
    await expect(acquire(client)).resolves.toEqual({
      acquired: false,
      response: { success: true, message: 'Already processed' },
    })
  })

  it('rejects a concurrent in-flight event as still processing', async () => {
    const { client } = db({
      insert: { success: true, meta: { changes: 0 } },
      existing: { processed: 0, created_at: new Date().toISOString() },
    })
    await expect(acquire(client)).resolves.toEqual({
      acquired: false,
      response: { success: false, message: 'Already processing' },
    })
  })

  it('reports a database query failure when the row vanished', async () => {
    const { client } = db({ insert: { success: true, meta: { changes: 0 } }, existing: null })
    await expect(acquire(client)).resolves.toEqual({
      acquired: false,
      response: { success: false, message: 'Database query failure' },
    })
  })

  it('releases a lock abandoned for more than five minutes', async () => {
    const stale = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    const { client } = db({
      insert: { success: true, meta: { changes: 0 } },
      existing: { processed: 0, created_at: stale },
    })
    await expect(acquire(client)).resolves.toEqual({
      acquired: false,
      response: { success: true, message: 'Stale lock cleared (marked processed)' },
    })
  })
})

describe('resolveStaleLock', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('treats a lock older than five minutes as stale', async () => {
    const { client } = db({})
    const res = await resolveStaleLock(client, EVENT_ID, new Date(Date.now() - 6 * 60 * 1000).toISOString(), 'pay-1', new Date().toISOString())
    expect(res.isStale).toBe(true)
  })

  it('keeps a fresh lock intact', async () => {
    const { client } = db({})
    const res = await resolveStaleLock(client, EVENT_ID, new Date().toISOString(), 'pay-1', new Date().toISOString())
    expect(res.isStale).toBe(false)
  })

  it('still reports stale when the clearing update fails', async () => {
    const { client } = db({ updateFails: true })
    const res = await resolveStaleLock(
      client, EVENT_ID, new Date(Date.now() - 10 * 60 * 1000).toISOString(), 'pay-1', new Date().toISOString(),
    )
    expect(res.isStale).toBe(true)
  })
})

async function acquire(client: unknown) {
  return acquireTopupEventLock(
    client as Parameters<typeof acquireTopupEventLock>[0],
    EVENT_ID,
    IPN,
    new Date().toISOString(),
  )
}
