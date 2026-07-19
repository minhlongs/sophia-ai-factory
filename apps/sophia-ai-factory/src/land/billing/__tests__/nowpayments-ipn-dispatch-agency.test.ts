/**
 * @vitest
 *
 * Agency IPN dispatcher tests — covers routing from main dispatcher:
 *   - Agency order (order_id "ag_") → agency handler
 *   - Non-agency order → existing subscription/one-time handlers unchanged
 *   - Zero regression on existing subscription + one-time routing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to mock modules before importing the dispatcher
vi.mock('@/tree/clients/nowpayments-client')
vi.mock('../nowpayments-ipn-subscription')
vi.mock('../nowpayments-ipn-one-time')
vi.mock('../agency-billing')

import { dispatchFinished, dispatchRefunded } from '../nowpayments-ipn-dispatch'
import * as nowpaymentsClient from '@/tree/clients/nowpayments-client'
import * as subscriptionHandler from '../nowpayments-ipn-subscription'
import * as oneTimeHandler from '../nowpayments-ipn-one-time'
import * as agencyHandler from '../agency-billing'
import type { NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers'
import type { OneTimeSku } from '@/seed/types'

// ── Helpers ─────────────────────────────────────────────────────────────

function buildIpnPayload(overrides: Partial<NowPaymentsIpnPayload> = {}): NowPaymentsIpnPayload {
  return {
    payment_id: 'pay_' + Math.random().toString(36).slice(2),
    invoice_id: '5710519960',
    order_id: 'sophia_user1_1234567890',
    payment_status: 'finished',
    price_amount: 199,
    price_currency: 'usd',
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Zero Regression — existing subscription + one-time routing unchanged
// ═══════════════════════════════════════════════════════════════════════

describe('ZERO REGRESSION — existing routing unchanged', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── Subscription cases (1-4): finished ─────────────────────────────

  it('case 1: BASIC tier finished → subscription handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '5710519960' })
    const config = {
      kind: 'subscription' as const,
      tier: 'BASIC' as const,
      config: { tier: 'BASIC' as const, invoiceId: '5710519960', price: 199, currency: 'USD', name: 'Starter' },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
    expect(oneTimeHandler.handleOneTimeFinished).not.toHaveBeenCalled()
    expect(agencyHandler.handleAgencyIPN).not.toHaveBeenCalled()
  })

  it('case 2: PREMIUM tier finished → subscription handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '4559269964' })
    const config = {
      kind: 'subscription' as const,
      tier: 'PREMIUM' as const,
      config: { tier: 'PREMIUM' as const, invoiceId: '4559269964', price: 399, currency: 'USD', name: 'Growth' },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 3: ENTERPRISE tier finished → subscription handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '6336799275' })
    const config = {
      kind: 'subscription' as const,
      tier: 'ENTERPRISE' as const,
      config: { tier: 'ENTERPRISE' as const, invoiceId: '6336799275', price: 799, currency: 'USD', name: 'Premium' },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 4: MASTER tier finished → subscription handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '5589879034' })
    const config = {
      kind: 'subscription' as const,
      tier: 'MASTER' as const,
      config: { tier: 'MASTER' as const, invoiceId: '5589879034', price: 4999, currency: 'USD', name: 'Master' },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  // ─── One-time cases (9): finished ───────────────────────────────────

  it('case 9: STARTER_BUNDLE one_time finished → one-time handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '7810429001' })
    const sku: OneTimeSku = {
      id: 'STARTER_BUNDLE',
      invoiceId: '7810429001',
      priceUsd: 49,
      credits: 10,
      ttlMonths: 12,
      label_vi: 'Gói Khởi Đầu',
      label_en: 'Starter Bundle',
    }
    const config = { kind: 'one_time' as const, sku }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalledWith(payload, sku)
    expect(subscriptionHandler.handleFinished).not.toHaveBeenCalled()
    expect(agencyHandler.handleAgencyIPN).not.toHaveBeenCalled()
  })

  // ─── Edge cases (11-14): finished ───────────────────────────────────

  it('case 11: unknown invoice_id → log warn, no handler call (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: 'unknown_9999999999' })
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(null)

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).not.toHaveBeenCalled()
    expect(oneTimeHandler.handleOneTimeFinished).not.toHaveBeenCalled()
    expect(agencyHandler.handleAgencyIPN).not.toHaveBeenCalled()
  })

  it('case 12: malformed order_id → still dispatch based on invoice_id (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '5710519960', order_id: 'malformed' })
    const config = {
      kind: 'subscription' as const,
      tier: 'BASIC' as const,
      config: { tier: 'BASIC' as const, invoiceId: '5710519960', price: 199, currency: 'USD', name: 'Starter' },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 13: missing invoice_id → fall through to subscription handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: undefined })
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 14: missing payment_id → still processes (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '7810429001', payment_id: '' })
    const sku: OneTimeSku = {
      id: 'STARTER_BUNDLE',
      invoiceId: '7810429001',
      priceUsd: 49,
      credits: 10,
      ttlMonths: 12,
      label_vi: 'Gói Khởi Đầu',
      label_en: 'Starter Bundle',
    }
    const config = { kind: 'one_time' as const, sku }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalled()
  })

  // ─── Status branch cases (15-16): finished ──────────────────────────

  it('case 15: payment_status=failed → no special handling (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '7810429001', payment_status: 'failed' })
    const sku: OneTimeSku = {
      id: 'STARTER_BUNDLE',
      invoiceId: '7810429001',
      priceUsd: 49,
      credits: 10,
      ttlMonths: 12,
      label_vi: 'Gói Khởi Đầu',
      label_en: 'Starter Bundle',
    }
    const config = { kind: 'one_time' as const, sku }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalled()
  })

  it('case 16: payment_status=expired → no special handling (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '7810429001', payment_status: 'expired' })
    const sku: OneTimeSku = {
      id: 'STARTER_BUNDLE',
      invoiceId: '7810429001',
      priceUsd: 49,
      credits: 10,
      ttlMonths: 12,
      label_vi: 'Gói Khởi Đầu',
      label_en: 'Starter Bundle',
    }
    const config = { kind: 'one_time' as const, sku }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalled()
  })

  // ─── Subscription cases (5-8): refunded ─────────────────────────────

  it('case 5: BASIC tier refunded → subscription handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '5710519960', payment_status: 'refunded' })
    const config = {
      kind: 'subscription' as const,
      tier: 'BASIC' as const,
      config: { tier: 'BASIC' as const, invoiceId: '5710519960', price: 199, currency: 'USD', name: 'Starter' },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('case 6: PREMIUM tier refunded → subscription handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '4559269964', payment_status: 'refunded' })
    const config = {
      kind: 'subscription' as const,
      tier: 'PREMIUM' as const,
      config: { tier: 'PREMIUM' as const, invoiceId: '4559269964', price: 399, currency: 'USD', name: 'Growth' },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('case 7: ENTERPRISE tier refunded → subscription handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '6336799275', payment_status: 'refunded' })
    const config = {
      kind: 'subscription' as const,
      tier: 'ENTERPRISE' as const,
      config: { tier: 'ENTERPRISE' as const, invoiceId: '6336799275', price: 799, currency: 'USD', name: 'Premium' },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('case 8: MASTER tier refunded → subscription handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '5589879034', payment_status: 'refunded' })
    const config = {
      kind: 'subscription' as const,
      tier: 'MASTER' as const,
      config: { tier: 'MASTER' as const, invoiceId: '5589879034', price: 4999, currency: 'USD', name: 'Master' },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  // ─── One-time case (10): refunded ──────────────────────────────────

  it('case 10: STARTER_BUNDLE one_time refunded → one-time handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: '7810429001', payment_status: 'refunded' })
    const sku: OneTimeSku = {
      id: 'STARTER_BUNDLE',
      invoiceId: '7810429001',
      priceUsd: 49,
      credits: 10,
      ttlMonths: 12,
      label_vi: 'Gói Khởi Đầu',
      label_en: 'Starter Bundle',
    }
    const config = { kind: 'one_time' as const, sku }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(oneTimeHandler.handleOneTimeRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(oneTimeHandler.handleOneTimeRefunded).toHaveBeenCalledWith(payload)
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled()
  })

  it('refund with no invoice_id → fall through to subscription handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: undefined, payment_status: 'refunded' })
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('refund with unknown invoice_id → still fall through to subscription handler (unchanged)', async () => {
    const payload = buildIpnPayload({ invoice_id: 'unknown_9999999999', payment_status: 'refunded' })
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(null)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Agency branch — NEW routing via order_id prefix
// ═══════════════════════════════════════════════════════════════════════

describe('Agency branch routing (order_id "ag_" prefix)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('routes agency order (ag_ prefix) → agency handler on finished', async () => {
    const payload = buildIpnPayload({
      order_id: 'ag_42_1700000000',
      payment_status: 'agency_tier_growth',
      price_amount: 1500,
      invoice_id: 'inv_agency_growth',
    })
    vi.mocked(agencyHandler.handleAgencyIPN).mockResolvedValue({ ok: true, value: undefined })
    // lookupInvoice returns null (agency invoice not in subscription/one-time registry)
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(null)

    await dispatchFinished(payload)

    // The dispatcher checks order_id.startsWith('ag_') BEFORE the lookup result
    // so agency handler should be called even if lookupInvoice returns null
    expect(agencyHandler.handleAgencyIPN).toHaveBeenCalledWith(payload)
    expect(subscriptionHandler.handleFinished).not.toHaveBeenCalled()
    expect(oneTimeHandler.handleOneTimeFinished).not.toHaveBeenCalled()
  })

  it('routes agency order with known subscription invoice → agency handler takes priority', async () => {
    const payload = buildIpnPayload({
      invoice_id: '5710519960', // Basic subscription invoice
      order_id: 'ag_1_1700000000', // BUT agency prefix
      payment_status: 'finished',
      price_amount: 500,
    })
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue({
      kind: 'subscription',
      tier: 'BASIC',
      config: {
        tier: 'BASIC',
        invoiceId: '5710519960',
        price: 199,
        currency: 'USD',
        name: 'Starter',
      },
    })
    vi.mocked(agencyHandler.handleAgencyIPN).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    // Agency branch fires because order_id starts with "ag_"
    expect(agencyHandler.handleAgencyIPN).toHaveBeenCalledWith(payload)
    expect(subscriptionHandler.handleFinished).not.toHaveBeenCalled()
  })

  it('normal user order (sophia_ prefix) does NOT route to agency', async () => {
    const payload = buildIpnPayload({
      invoice_id: '5710519960',
      order_id: 'sophia_user1_1700000000', // normal user prefix
      payment_status: 'finished',
    })
    const config = {
      kind: 'subscription' as const,
      tier: 'BASIC' as const,
      config: { tier: 'BASIC' as const, invoiceId: '5710519960', price: 199, currency: 'USD', name: 'Starter' },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })
    vi.mocked(agencyHandler.handleAgencyIPN).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
    expect(agencyHandler.handleAgencyIPN).not.toHaveBeenCalled()
  })

  it('agency handler failure throws to trigger DLQ', async () => {
    const payload = buildIpnPayload({
      order_id: 'ag_1_1700000000',
      payment_status: 'finished',
      price_amount: 500,
      invoice_id: 'inv_agency_starter',
    })
    vi.mocked(agencyHandler.handleAgencyIPN).mockRejectedValue(
      new Error('AGENCY_BILLING_ERROR: simulated failure'),
    )
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(null)

    await expect(dispatchFinished(payload)).rejects.toThrow()
  })
})
