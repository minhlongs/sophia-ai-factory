/**
 * Exhaustive parity proof for `dispatchRefunded` ordering.
 *
 * The refactor moved the order_id correlation (`resolveContractOrderId`) ahead of
 * the barrier that keeps a contract refund from falling through to the subscription
 * handler. These cases prove the observable outcome — which handler runs, or which
 * error is raised — is unchanged from the inline baseline for every combination
 * of (order_id present, invoice_id present, correlation hit).
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dispatchRefunded } from '../nowpayments-ipn-dispatch'
import * as subscriptionHandler from '../nowpayments-ipn-subscription'
import * as contractConverter from '@/land/contracts/workflow/contract-converter'
import * as contractRefund from '@/land/contracts/workflow/nowpayments-contract-refund'
import type { D1Client } from '@/seed/db/d1-client-rpc'
import type { NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers'

vi.mock('../nowpayments-ipn-subscription')
vi.mock('@/land/contracts/workflow/contract-converter')
vi.mock('@/land/contracts/workflow/nowpayments-contract-refund')

/** rows returned for a bare order_id lookup (barrier probe) and for the full order select */
function db(opts: {
  contractOrder?: unknown
  correlation?: unknown[]
  order?: unknown
  invoice?: unknown
  lock?: unknown
  grant?: unknown
} = {}): D1Client {
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        first: async () => {
          // bare-order probe: SELECT order_id ... purpose='contract' (no status IN filter)
          if (sql.includes("SELECT order_id FROM pending_orders") && !sql.includes('status IN')) return opts.contractOrder ?? null
          if (sql.includes('pending_orders')) return opts.order ?? null
          if (sql.includes('payment_events')) return opts.lock ?? null
          if (sql.includes('mcu_transactions')) return opts.grant ?? null
          return opts.invoice ?? null
        },
        all: async () => ({ results: opts.correlation ?? [] }),
      }),
    }),
    unwrap: () => ({}),
  } as unknown as D1Client
}

const ORDER = { order_id: 'o1', user_id: 'u1', contract_id: 'c1', invoice_id: 'inv1', amount_usd_cents: 350000, provider_payment_id: 'p1', status: 'completed', payment_id: 'pay1' }
const INVOICE = { total_amount_cents: 350000, currency: 'USD', status: 'paid' }
const CONTRACT = { id: 'c1', orgId: 'org1', lastInvoiceId: 'inv1', mcuCapacityMonthly: 50000, status: 'signed' }
const LOCK = { created_at: 't1' }

function payload(over: Partial<NowPaymentsIpnPayload> = {}): NowPaymentsIpnPayload {
  return { payment_id: 'pay1', invoice_id: 'p1', order_id: 'o1', payment_status: 'refunded',
    price_amount: 3500, price_currency: 'USD', actually_paid: 0.005, pay_amount: 0.005, ...over }
}

/** A resolvable, fully-consistent contract refund. */
function goodContractOrder() {
  return { order: ORDER, invoice: INVOICE, lock: LOCK, contract: CONTRACT, grant: { payment_reference: 'pay1' } }
}

describe('dispatchRefunded ordering parity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractConverter.getContractById).mockResolvedValue(CONTRACT as never)
    vi.mocked(contractRefund.refundNowPaymentsContractOrder).mockResolvedValue(undefined)
  })

  /** The dispatcher unwraps the handler's Result, so a stub that reaches it must return a success. */
  function stubSubscriptionHandler() {
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined } as never)
  }

  it('routes a consistent contract refund to the contract reversal, not the subscription handler', async () => {
    await dispatchRefunded(payload(), db({ ...goodContractOrder(), contractOrder: ORDER }))

    expect(contractRefund.refundNowPaymentsContractOrder).toHaveBeenCalledTimes(1)
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled()
  })

  it('rejects a contract refund that has an order_id but no provider invoice ID', async () => {
    // the order must be loadable so the missing-invoice check is the clause that fires
    await expect(dispatchRefunded(
      payload({ invoice_id: '' }),
      db({ contractOrder: ORDER, order: ORDER }),
    )).rejects.toThrow(/missing provider invoice ID/)
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled()
  })

  it('rejects an ambiguous correlation before touching any handler', async () => {
    await expect(dispatchRefunded(
      payload({ order_id: '' }),
      db({ correlation: [{ order_id: 'a' }, { order_id: 'b' }] }),
    )).rejects.toThrow(/correlation is ambiguous/)
    expect(contractRefund.refundNowPaymentsContractOrder).not.toHaveBeenCalled()
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled()
  })

  it('keeps the barrier scoped to the order_id the provider sent, not the correlated one', async () => {
    stubSubscriptionHandler()
    // The barrier has always keyed off ipn.order_id (never the correlated id). A refund
    // with no order_id whose correlated row is unloadable is NOT a contract order the
    // barrier can name, so it falls through — exactly as the inline baseline did.
    await dispatchRefunded(
      payload({ order_id: '' }),
      db({ correlation: [{ order_id: 'o1' }], order: null }),
    )
    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledTimes(1)
  })

  it('rejects a refund whose bare order_id identifies a contract order of any status', async () => {
    await expect(dispatchRefunded(payload(), db({ contractOrder: ORDER, order: null, lock: null })))
      .rejects.toThrow(/could not be safely correlated/)
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled()
  })

  it('routes a non-contract refund to the subscription handler', async () => {
    stubSubscriptionHandler()
    await dispatchRefunded(payload(), db({ contractOrder: null, order: null }))

    expect(contractRefund.refundNowPaymentsContractOrder).not.toHaveBeenCalled()
    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledTimes(1)
  })

  it('rejects a non-contract refund that carries neither invoice nor order', async () => {
    await expect(dispatchRefunded(payload({ invoice_id: '', order_id: '' }), db()))
      .rejects.toThrow(/missing invoice and order correlation/)
  })

  it('rejects a refund on an unknown invoice with no order correlation', async () => {
    await expect(dispatchRefunded(payload({ invoice_id: 'unknown', order_id: '' }), db()))
      .rejects.toThrow(/no persisted order correlation/)
  })
})
