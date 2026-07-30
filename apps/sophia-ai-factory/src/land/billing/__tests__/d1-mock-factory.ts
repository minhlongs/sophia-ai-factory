/**
 * Reusable D1 mock factory for IPN contract tests.
 *
 * Provides a fluent mock matching the D1LikeClient interface:
 *   db.from(table).insert(row)           -> { error }
 *   db.from(table).update(obj).eq(k,v)   -> { count, error }
 *   db.from(table).select(cols).eq(k,v)  -> { data, error }
 *   db.from(table).delete().eq(k,v)      -> { count, error }
 *
 * Used by all IPN contract tests. Each test can customize behavior via hooks.
 */

import type { D1LikeClient } from '../nowpayments-ipn-dead-letter'

// ── Thenable (awaitable object) ──────────────────────────────────────────────

type Thenable<T> = { then: (fn: (v: T) => unknown) => Thenable<T> }

function makeThenable<T>(value: T): Thenable<T> {
  return {
    then: (fn: (v: T) => unknown) => {
      Promise.resolve(fn(value)).catch(() => {})
      return makeThenable(value)
    },
  }
}

// ── Error builders ───────────────────────────────────────────────────────────

export function uniqueViolationError() {
  return { code: 2067, message: 'UNIQUE constraint failed: payment_events.event_id' }
}

export function notNullViolationError() {
  return { code: 1299, message: 'NOT NULL constraint failed' }
}

export function genericDbError(message = 'database error') {
  return { code: 1, message }
}

// ── Fluent chain builders ────────────────────────────────────────────────────

interface EqChain {
  eq: (col: string, val: unknown) => EqChain
  neq: (col: string, val: unknown) => EqChain
  gte: (col: string, val: string) => EqChain
  lt: (col: string, val: string) => EqChain
  maybeSingle: () => Thenable<{ data: Record<string, unknown> | null; error: null }>
  single: () => Thenable<{ data: Record<string, unknown> | null; error: Record<string, unknown> | null }>
  limit: (n: number) => { order: (col: string, opts: { ascending: boolean }) => Thenable<{ data: unknown[]; error: null }> }
  order: (col: string, opts: { ascending: boolean }) => Thenable<{ data: unknown[]; error: null }>
  select: (cols?: string, opts?: { count?: string; head?: boolean }) => EqChain
}

// ── Mock builder ─────────────────────────────────────────────────────────────

export interface D1MockConfig {
  insertError?: Record<string, unknown> | null
  insertResult?: Record<string, unknown> | null
  selectSingleResult?: { data: Record<string, unknown> | null; error: Record<string, unknown> | null }
  selectListResult?: { data: unknown[]; error: Record<string, unknown> | null }
  /** For count queries: select('*', { count: 'exact', head: true }) returns { count, error } */
  selectCountResult?: { count: number | null; error: Record<string, unknown> | null }
  updateResult?: { count?: number; error?: Record<string, unknown> | null }
  deleteResult?: { count?: number; error?: Record<string, unknown> | null }
  onInsert?: (row: Record<string, unknown>) => void
  insertLog?: Array<Record<string, unknown>>
}

export function buildD1Mock(config: D1MockConfig = {}) {
  const insertLog = config.insertLog ?? []

  // Base thenable resolve value — varies by query pattern
  let resolveValue: Record<string, unknown> = {}

  const eqChain: Record<string, unknown> & { then: (fn: (v: unknown) => unknown) => unknown } = {
    then: (fn: (v: unknown) => unknown) => {
      const v = resolveValue
      resolveValue = {} // reset after use
      Promise.resolve(fn(v)).catch(() => {})
      return { then: () => {} }
    },
    eq: () => eqChain,
    neq: () => eqChain,
    gte: () => eqChain,
    lt: () => eqChain,
    maybeSingle: () => {
      resolveValue = {
        data: config.selectSingleResult?.data ?? null,
        error: null,
      }
      return eqChain
    },
    single: () => {
      resolveValue = config.selectSingleResult ?? { data: null, error: null }
      return eqChain
    },
    limit: () => ({ order: () => eqChain, ...eqChain }),
    order: () => eqChain,
    select: (...args: unknown[]) => {
      // If called with count options, return count-style result
      if (args.length > 1 && typeof args[1] === 'object' && (args[1] as Record<string, unknown>)?.count) {
        resolveValue = config.selectCountResult ?? { count: 0, error: null }
      } else if (config.selectListResult) {
        // For list queries: select('*') then chain .eq().lt().order()
        resolveValue = config.selectListResult as unknown as Record<string, unknown>
      }
      return eqChain
    },
  }

  const mock = {
    from: (_table: string) => ({
      insert: (row: Record<string, unknown>) => {
        insertLog.push(row)
        config.onInsert?.(row)
        return makeThenable({
          error: config.insertError ?? config.insertResult ?? null,
        })
      },
      update: (obj: Record<string, unknown>) => {
        insertLog.push(obj)
        const updateResult = config.updateResult ?? { count: 1, error: null }
        return {
  eq: (_col: string, _val: unknown) => {
    const t = makeThenable(updateResult)
    return Object.assign(t, {
      eq: (_c2: string, _v2: unknown) => t,
      neq: () => t,
      lt: (_c2: string, _v2: unknown) => t,
      select: () => eqChain,
      limit: () => eqChain,
      order: () => makeThenable({ data: config.selectListResult?.data ?? [], error: null }),
    })
  },
        }
      },
      select: (...args: unknown[]) => {
        // Delegate to eqChain.select to handle count/head options
        return (eqChain.select as (...a: unknown[]) => typeof eqChain)(...args)
      },
      delete: () => ({
        eq: () => makeThenable(config.deleteResult ?? { count: 1, error: null }),
      }),
    }),
    prepare: (_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: <T>() => makeThenable((config.selectSingleResult?.data ?? null) as T | null),
        run: () => makeThenable(config.updateResult ?? { success: true }),
        raw: <T>() => makeThenable((config.selectListResult?.data ?? []) as T[]),
      }),
    }),
  }
  return mock as unknown as D1LikeClient
}

// ── IPN payload builder ──────────────────────────────────────────────────────

export function buildIpnPayload(overrides: Partial<{
  payment_id: string
  payment_status: 'waiting' | 'confirming' | 'confirmed' | 'sending' | 'partially_paid' | 'finished' | 'failed' | 'refunded' | 'expired'
  price_amount: number
  price_currency: string
  order_id: string
  invoice_id: string
  actually_paid: number
  customer_email: string
  outcome_amount: number
  outcome_currency: string
  pay_address: string
  pay_amount: number
  pay_currency: string
  order_description: string
}> = {}): {
  payment_id: string
  payment_status: 'waiting' | 'confirming' | 'confirmed' | 'sending' | 'partially_paid' | 'finished' | 'failed' | 'refunded' | 'expired'
  price_amount: number
  price_currency: string
  order_id: string
  invoice_id: string
  actually_paid: number
  customer_email: string
  outcome_amount?: number
  outcome_currency?: string
  pay_address?: string
  pay_amount?: number
  pay_currency?: string
  order_description?: string
} {
  const defaults = {
    payment_id: `pay_${Math.random().toString(36).slice(2, 10)}`,
    payment_status: 'finished' as const,
    price_amount: 199,
    price_currency: 'USD',
    order_id: `sophia_user_test123_${Date.now()}`,
    invoice_id: 'inv_test_001',
    actually_paid: 199,
    customer_email: 'test@example.com',
  }
  return { ...defaults, ...overrides }
}
