/**
 * Contract tests: IPN Concurrent Processing (Race Conditions)
 *
 * Verifies the TOCTOU race fix:
 * - Two concurrent `finished` with same payment_id → exactly one handler call
 * - Two concurrent `refunded` with same payment_id → exactly one handler call
 * - Stale lock recovery (> 5 min old) → stale lock cleared, returns "Stale lock cleared"
 * - Lock younger than 5 min → returns "Already processing", no handler called
 *
 * RED TESTS (it.todo): marked as TODO — require Phase 2 implementation to pass.
 * The current INSERT-then-SELECT pattern has a TOCTOU window that these tests expose.
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockDispatchFinished, mockDispatchRefunded, mockHandleFailed, mockLogger } = vi.hoisted(() => ({
  mockDispatchFinished: vi.fn().mockResolvedValue(undefined),
  mockDispatchRefunded: vi.fn().mockResolvedValue(undefined),
  mockHandleFailed: vi.fn().mockResolvedValue(undefined),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mockLogger,
}))

vi.mock('../nowpayments-ipn-dispatch', () => ({
  dispatchFinished: mockDispatchFinished,
  dispatchRefunded: mockDispatchRefunded,
}))

vi.mock('../nowpayments-ipn-subscription', () => ({
  handleFailed: mockHandleFailed,
}))

vi.mock('../nowpayments-ipn-dead-letter', () => ({
  enqueueDlqEntry: vi.fn(),
  countUnresolvedDlq: vi.fn().mockResolvedValue(0),
}))

// D1 mock — returns no existing event by default (fresh lock acquired)
const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(() => ({
    from: (table: string) => ({
      insert: (..._args: unknown[]) => ({
        then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ error: null })); return { then: () => {} } },
      }),
      select: () => ({
        eq: () => ({
          single: () => ({
            then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ data: null, error: { message: 'not found' } })); return { then: () => {} } },
          }),
          maybeSingle: () => ({
            then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ data: null, error: null })); return { then: () => {} } },
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ count: 1, error: null })); return { then: () => {} } },
          }),
          neq: () => ({
            then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ count: 0, error: null })); return { then: () => {} } },
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ count: 1, error: null })); return { then: () => {} } },
        }),
      }),
    }),
    // prepare() for raw SQL (Phase 2 PayOS-style atomic lock)
    prepare: () => ({
      bind: () => ({
        run: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ meta: { changes: 1 } })); return { then: () => {} } } }),
        first: <T>() => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn(null as T | null)); return { then: () => {} } } }),
      }),
    }),
  })),
}))

vi.mock('../nowpayments-ipn-db', () => ({
  getDb: mockGetDb,
  parseUserIdFromOrderId: vi.fn((orderId: string) => orderId?.split('_')[1] ?? null),
}))

import { processNowPaymentsIpn, type NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers'

function buildPayload(overrides: Partial<NowPaymentsIpnPayload> = {}): NowPaymentsIpnPayload {
  return {
    payment_id: 'pay_race_test',
    payment_status: 'finished',
    price_amount: 199,
    price_currency: 'USD',
    order_id: 'sophia_user_race_1',
    invoice_id: 'inv_race_001',
    ...overrides,
  }
}

describe('TOCTOU Race — concurrent finished', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => vi.clearAllMocks())

  /** RED: Two concurrent finished with same payment_id → should dispatch only once. */
  it.todo('RED: two concurrent finished with same payment_id → only one handler call — Phase 2')

  /** RED: Two concurrent refunded with same payment_id → should dispatch only once. */
  it.todo('RED: two concurrent refunded with same payment_id → only one handler call — Phase 2')
})

describe('TOCTOU Race — stale lock recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => vi.clearAllMocks())

  /** RED: Stale lock > 5 min old should be cleared without dispatching. */
  it.todo('RED: stale lock > 5 min old returns stale lock cleared, no double dispatch — Phase 2')

  /** RED: Fresh lock < 5 min old returns "Already processing". */
  it.todo('RED: fresh lock < 5 min old returns already processing, no handler called — Phase 2')
})

describe('TOCTOU Race — already processed event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: fresh lock acquired → processes normally
    mockGetDb.mockReturnValue({
      from: (table: string) => ({
        insert: (..._args: unknown[]) => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ error: null })); return { then: () => {} } } }),
        select: () => ({ eq: () => ({ single: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ data: null, error: { message: 'not found' } })); return { then: () => {} } } }), maybeSingle: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ data: null, error: null })); return { then: () => {} } } }) }) }),
        update: () => ({ eq: () => ({ eq: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ count: 1, error: null })); return { then: () => {} } } }), neq: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ count: 0, error: null })); return { then: () => {} } } }) }) }),
        delete: () => ({ eq: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ count: 1, error: null })); return { then: () => {} } } }) }),
      }),
      prepare: () => ({
        bind: () => ({
          run: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ meta: { changes: 1 } })); return { then: () => {} } } }),
          first: <T>() => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn(null as T | null)); return { then: () => {} } } }),
        }),
      }),
    } as any)
  })
  afterEach(() => vi.clearAllMocks())

  it('returns "Already processed" when event already marked processed=1', async () => {
    // Override getDb to simulate an already-processed event (changes=0 + processed=1)
    mockGetDb.mockReturnValue({
      from: (table: string) => ({
        insert: (..._args: unknown[]) => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ error: { code: 2067, message: 'UNIQUE constraint failed' } })); return { then: () => {} } } }),
        select: () => ({ eq: () => ({ single: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ data: { processed: 1, created_at: new Date().toISOString() }, error: null })); return { then: () => {} } } }), maybeSingle: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ data: { processed: 1, created_at: new Date().toISOString() }, error: null })); return { then: () => {} } } }) }) }),
        update: () => ({ eq: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ count: 0, error: null })); return { then: () => {} } } }) }),
        delete: () => ({ eq: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ count: 1, error: null })); return { then: () => {} } } }) }),
      }),
      // Key: changes=0 means lock already taken → falls through to SELECT
      prepare: () => ({
        bind: () => ({
          run: () => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ meta: { changes: 0 } })); return { then: () => {} } } }),
          first: <T>() => ({ then: (fn: (v: unknown) => unknown) => { Promise.resolve(fn({ processed: 1, created_at: new Date().toISOString() } as T)); return { then: () => {} } } }),
        }),
      }),
    } as any)

    const payload = buildPayload({ payment_id: 'pay_done' })
    const result = await processNowPaymentsIpn(payload)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Already processed')
    expect(mockDispatchFinished).not.toHaveBeenCalled()
  })
})
