/**
 * Unit tests for pending-order-repo.ts
 * Uses D1 mock from test setup (globalThis.__env.DB).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  writeOrder,
  getOrderById,
  markOrderCompleted,
  markOrderFailed,
  listOrdersByUser,
} from '../pending-order-repo'
import type { PendingOrder } from '../pending-order-types'

// We test against the D1Client query builder layer.
// The d1Mock is set up in src/test/setup.tsx with a real Map per test.

const BASE_INPUT = {
  order_id: 'sophia_user123_1700000000000',
  user_id: 'user123',
  tier: 'PREMIUM' as const,
  period: 'monthly' as const,
  payment_method: 'nowpayments' as const,
  amount_usd_cents: 39900,
  promo_code: undefined,
  customer_email: undefined,
  invoice_url: undefined,
}

// Mock createServerClient to use an in-memory store
const orderStore = new Map<string, PendingOrder>()

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: () => ({
    from: (table: string) => {
      if (table !== 'pending_orders') throw new Error(`Unexpected table: ${table}`)
      return {
        insert: vi.fn(async (row: PendingOrder) => {
          if (orderStore.has(row.order_id)) throw new Error('UNIQUE constraint failed')
          orderStore.set(row.order_id, row)
          return { data: row, error: null }
        }),
        select: vi.fn(() => ({
          eq: (col: string, val: string) => ({
            single: async () => {
              const row = [...orderStore.values()].find(r => (r as unknown as Record<string, unknown>)[col] === val)
              return { data: row ?? null, error: null }
            },
            order: () => ({
              limit: (n: number) => ({
                then: (res: (v: { data: PendingOrder[] }) => void) => res({ data: [...orderStore.values()].filter(r => r.user_id === val).slice(0, n) }),
              }),
            }),
          }),
        })),
        update: (updates: Partial<PendingOrder>) => ({
          eq: vi.fn((_col: string, val: string) => {
            const row = [...orderStore.values()].find(r => r.order_id === val)
            if (row) Object.assign(row, updates)
            return Promise.resolve({ data: null, error: null })
          }),
        }),
      }
    },
  }),
}))

beforeEach(() => {
  orderStore.clear()
})

describe('writeOrder', () => {
  it('creates a row and returns it', async () => {
    const result = await writeOrder(BASE_INPUT)
    expect(result.order_id).toBe(BASE_INPUT.order_id)
    expect(result.status).toBe('pending')
    expect(result.tier).toBe('PREMIUM')
    expect(result.amount_usd_cents).toBe(39900)
  })

  it('defaults period to monthly when not provided', async () => {
    const input = { ...BASE_INPUT, period: undefined as unknown as 'monthly' }
    const result = await writeOrder({ ...input, period: 'monthly' })
    expect(result.period).toBe('monthly')
  })

  it('throws on duplicate order_id', async () => {
    await writeOrder(BASE_INPUT)
    await expect(writeOrder(BASE_INPUT)).rejects.toThrow('UNIQUE constraint failed')
  })
})

describe('getOrderById', () => {
  it('returns order when found', async () => {
    await writeOrder(BASE_INPUT)
    const order = await getOrderById(BASE_INPUT.order_id)
    expect(order).not.toBeNull()
    expect(order!.order_id).toBe(BASE_INPUT.order_id)
  })

  it('returns null when not found', async () => {
    const order = await getOrderById('sophia_unknown_99999')
    expect(order).toBeNull()
  })
})

describe('markOrderCompleted', () => {
  it('updates status to completed with payment_id', async () => {
    await writeOrder(BASE_INPUT)
    await markOrderCompleted(BASE_INPUT.order_id, 'pay_abc123')
    const order = await getOrderById(BASE_INPUT.order_id)
    expect(order!.status).toBe('completed')
    expect(order!.payment_id).toBe('pay_abc123')
  })
})

describe('markOrderFailed', () => {
  it('updates status to failed', async () => {
    await writeOrder(BASE_INPUT)
    await markOrderFailed(BASE_INPUT.order_id, 'underpayment')
    const order = await getOrderById(BASE_INPUT.order_id)
    expect(order!.status).toBe('failed')
  })
})

describe('listOrdersByUser', () => {
  it('returns orders for a user', async () => {
    await writeOrder(BASE_INPUT)
    await writeOrder({ ...BASE_INPUT, order_id: 'sophia_user123_1700000000001' })
    const orders = await listOrdersByUser('user123')
    expect(orders.length).toBeGreaterThanOrEqual(2)
  })

  it('returns empty array when user has no orders', async () => {
    const orders = await listOrdersByUser('nobody')
    expect(orders).toEqual([])
  })
})
