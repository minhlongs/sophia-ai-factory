/**
 * Contract validation split — pins the disjoint invariants of the finished and
 * refunded contract guards in the IPN dispatcher.
 *
 * The two guards share most clauses but are NOT equivalent: the refunded path
 * carries invariants the finished path lacks, and vice versa. These tests assert
 * both directions so a refactor can never silently unify them.
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dispatchFinished, dispatchRefunded } from '../nowpayments-ipn-dispatch'
import * as subscriptionHandler from '../nowpayments-ipn-subscription'
import * as contractConverter from '@/land/contracts/workflow/contract-converter'
import * as contractFulfillment from '@/land/contracts/workflow/nowpayments-contract-fulfillment'
import * as contractRefund from '@/land/contracts/workflow/nowpayments-contract-refund'
import type { D1Client } from '@/seed/db/d1-client-rpc'
import type { NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers'

vi.mock('@/tree/clients/nowpayments-client')
vi.mock('../nowpayments-ipn-subscription')
vi.mock('../nowpayments-ipn-one-time')
vi.mock('@/land/contracts/workflow/contract-converter')
vi.mock('@/land/contracts/workflow/nowpayments-contract-refund')
vi.mock('@/land/contracts/workflow/nowpayments-contract-fulfillment')

type Row = Record<string, unknown>

/** Per-clause fixture; `null` means "this row is absent". */
type Fixture = {
  ipn?: Partial<NowPaymentsIpnPayload>
  order?: Row | null
  invoice?: Row | null
  lock?: Row | null
  grant?: Row | null
  contract?: Row | null
  correlation?: Row[]
}

const BASE_ORDER: Row = {
  order_id: 'contract-order-1', user_id: 'buyer-1', contract_id: 'contract-1',
  invoice_id: 'invoice-1', amount_usd_cents: 350000, provider_payment_id: 'provider-invoice-1',
  status: 'completed', payment_id: 'contract-payment-1',
}
const BASE_INVOICE: Row = { total_amount_cents: 350000, currency: 'USD', status: 'paid' }
const BASE_CONTRACT: Row = {
  id: 'contract-1', orgId: 'org-1', lastInvoiceId: 'invoice-1',
  mcuCapacityMonthly: 50000, status: 'signed',
}
const LOCK: Row = { created_at: 'lock-1' }
const GRANT: Row = { payment_reference: 'contract-payment-1' }

const FINISHED_MISMATCH = /did not match its persisted invoice and payment amount/
const REFUND_MISMATCH = /did not match its persisted invoice and payment$/

function merge<T extends Row>(base: T, over: Row | null | undefined): Row | null {
  if (over === null) return null
  return { ...base, ...over }
}

function fixtureDb(f: Fixture = {}): D1Client {
  const order = merge(BASE_ORDER, f.order)
  const invoice = merge(BASE_INVOICE, f.invoice)
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        first: async () => {
          if (sql.includes('pending_orders')) return order
          if (sql.includes('payment_events')) return merge(LOCK, f.lock)
          if (sql.includes('mcu_transactions')) return merge(GRANT, f.grant)
          return invoice
        },
        all: async () => ({ results: f.correlation ?? [] }),
      }),
    }),
    unwrap: () => ({}),
  } as unknown as D1Client
}

function mockContract(f: Fixture): void {
  vi.mocked(contractConverter.getContractById).mockResolvedValue(
    merge(BASE_CONTRACT, f.contract) as never)
}

function finishedPayload(over: Partial<NowPaymentsIpnPayload> = {}): NowPaymentsIpnPayload {
  return { payment_id: 'contract-payment-1', invoice_id: 'provider-invoice-1',
    order_id: 'contract-order-1', payment_status: 'finished', price_amount: 3500,
    price_currency: 'USD', actually_paid: 0.005, pay_amount: 0.005, ...over }
}

function refundedPayload(over: Partial<NowPaymentsIpnPayload> = {}): NowPaymentsIpnPayload {
  return finishedPayload({ payment_status: 'refunded', ...over })
}

describe('dispatchFinished — contract payment guard', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it.each<[string, Fixture]>([
    ['the contract no longer points at the persisted order invoice', { contract: { lastInvoiceId: 'drifted-invoice' } }],
    ['the crypto payment is underpaid', { ipn: { actually_paid: 0.001 } }],
    ['the persisted invoice is not denominated in USD', { invoice: { currency: 'VND' } }],
    ['the persisted invoice amount differs from the order amount', { invoice: { total_amount_cents: 349999 } }],
    ['the provider reports a non-USD price currency', { ipn: { price_currency: 'EUR' } }],
    ['the provider price amount differs from the invoice amount', { ipn: { price_amount: 3400 } }],
    ['the provider invoice ID is missing', { ipn: { invoice_id: '' } }],
    ['the order is linked to a different provider invoice', { order: { provider_payment_id: 'other-invoice' } }],
    ['the event lock is missing', { lock: null }],
    ['the contract no longer exists', { contract: null }],
    ['the persisted invoice no longer exists', { invoice: null }],
  ])('rejects a finished contract payment when %s', async (_label, fixture) => {
    mockContract(fixture)
    vi.mocked(contractFulfillment.fulfillNowPaymentsContractOrder).mockResolvedValue(undefined)

    await expect(dispatchFinished(finishedPayload(fixture.ipn), fixtureDb(fixture)))
      .rejects.toThrow(FINISHED_MISMATCH)
    expect(contractFulfillment.fulfillNowPaymentsContractOrder).not.toHaveBeenCalled()
  })

  it.each<[string, Fixture]>([
    ['the order carries a stale payment id', { order: { payment_id: 'stale-payment' } }],
    ['the invoice was never marked paid', { invoice: { status: 'draft' } }],
    ['an MCU grant exists without a paid invoice', { grant: { payment_reference: 'x' }, invoice: { status: 'draft' } }],
  ])('still fulfills when %s — a refund-only invariant is violated', async (_label, fixture) => {
    mockContract(fixture)
    vi.mocked(contractFulfillment.fulfillNowPaymentsContractOrder).mockResolvedValue(undefined)

    await dispatchFinished(finishedPayload(fixture.ipn), fixtureDb(fixture))

    expect(contractFulfillment.fulfillNowPaymentsContractOrder).toHaveBeenCalledTimes(1)
    expect(subscriptionHandler.handleFinished).not.toHaveBeenCalled()
  })
})

describe('dispatchRefunded — contract refund guard', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it.each<[string, Fixture]>([
    ['the order is linked to a different provider payment', { order: { payment_id: 'other-payment' } }],
    ['the invoice is paid but no MCU grant was recorded', { grant: null }],
    ['an MCU grant exists but the invoice was never paid', { invoice: { status: 'draft' } }],
    ['the order completed without a matching paid invoice and grant', { order: { status: 'completed' }, grant: null }],
    ['the persisted invoice is not denominated in USD', { invoice: { currency: 'VND' } }],
    ['the persisted invoice amount differs from the order amount', { invoice: { total_amount_cents: 349999 } }],
    ['the provider reports a non-USD price currency', { ipn: { price_currency: 'EUR' } }],
    ['the event lock is missing', { lock: null }],
    ['the contract no longer exists', { contract: null }],
  ])('rejects a refunded contract payment when %s', async (_label, fixture) => {
    mockContract(fixture)
    vi.mocked(contractRefund.refundNowPaymentsContractOrder).mockResolvedValue(undefined)

    await expect(dispatchRefunded(refundedPayload(fixture.ipn), fixtureDb(fixture)))
      .rejects.toThrow(REFUND_MISMATCH)
    expect(contractRefund.refundNowPaymentsContractOrder).not.toHaveBeenCalled()
  })

  it.each<[string, Fixture]>([
    ['the contract no longer points at the persisted order invoice', { contract: { lastInvoiceId: 'drifted-invoice' } }],
    ['the provider payment is underpaid', { ipn: { actually_paid: 0.001 } }],
  ])('still refunds when %s — a finished-only invariant is violated', async (_label, fixture) => {
    mockContract(fixture)
    vi.mocked(contractRefund.refundNowPaymentsContractOrder).mockResolvedValue(undefined)

    await dispatchRefunded(refundedPayload(fixture.ipn), fixtureDb(fixture))

    expect(contractRefund.refundNowPaymentsContractOrder).toHaveBeenCalledTimes(1)
  })
})

describe('dispatchRefunded — contract correlation guards', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('rejects a refund whose persisted contract order is ambiguous', async () => {
    const db = fixtureDb({ correlation: [{ order_id: 'contract-order-1' }, { order_id: 'contract-order-2' }] })

    await expect(dispatchRefunded(refundedPayload({ order_id: '' }), db))
      .rejects.toThrow(/correlation is ambiguous/)
  })

  it('rejects a contract refund that carries no provider invoice ID', async () => {
    await expect(dispatchRefunded(refundedPayload({ invoice_id: '', order_id: 'contract-order-1' }), fixtureDb()))
      .rejects.toThrow(/missing provider invoice ID/)
  })

  it('never routes a contract order through the subscription refund handler', async () => {
    const db = {
      prepare: (sql: string) => ({ bind: () => ({ first: async () =>
        sql.includes("status IN ('pending', 'expired', 'failed', 'completed')") ? null : { order_id: 'contract-order-1' } }) }),
    } as unknown as D1Client

    await expect(dispatchRefunded(refundedPayload(), db)).rejects.toThrow(/could not be safely correlated/)
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled()
  })
})
