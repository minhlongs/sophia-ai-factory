/**
 * IPN Dispatcher Tests — 16 cases covering subscription + one-time routing
 * Matrix: 4 subscription tiers × 2 outcomes + 1 one-time SKU × 2 outcomes + 4 edge cases + 2 status branches
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dispatchFinished, dispatchRefunded } from '../nowpayments-ipn-dispatch'
import * as subscriptionHandler from '../nowpayments-ipn-subscription'
import * as oneTimeHandler from '../nowpayments-ipn-one-time'
import * as nowpaymentsClient from '@/tree/clients/nowpayments-client'
import type { NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers'
import type { OneTimeSku } from '@/seed/types'

// Mock modules
vi.mock('@/tree/clients/nowpayments-client')
vi.mock('../nowpayments-ipn-subscription')
vi.mock('../nowpayments-ipn-one-time')

// Helper to build IPN payload
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

describe('dispatchFinished — subscription + one-time routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── Subscription Cases (1-4): Finished ────────────────────────────────────

  it('case 1: BASIC tier finished → subscription handler', async () => {
    const payload = buildIpnPayload({ invoice_id: '5710519960' })
    const config = {
      kind: 'subscription' as const,
      tier: 'BASIC' as const,
      config: {
        tier: 'BASIC' as const,
        invoiceId: '5710519960',
        price: 199,
        currency: 'USD',
        name: 'Starter',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue(undefined)

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
    expect(oneTimeHandler.handleOneTimeFinished).not.toHaveBeenCalled()
  })

  it('case 2: PREMIUM tier finished → subscription handler', async () => {
    const payload = buildIpnPayload({ invoice_id: '4559269964' })
    const config = {
      kind: 'subscription' as const,
      tier: 'PREMIUM' as const,
      config: {
        tier: 'PREMIUM' as const,
        invoiceId: '4559269964',
        price: 399,
        currency: 'USD',
        name: 'Growth',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue(undefined)

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 3: ENTERPRISE tier finished → subscription handler', async () => {
    const payload = buildIpnPayload({ invoice_id: '6336799275' })
    const config = {
      kind: 'subscription' as const,
      tier: 'ENTERPRISE' as const,
      config: {
        tier: 'ENTERPRISE' as const,
        invoiceId: '6336799275',
        price: 799,
        currency: 'USD',
        name: 'Premium',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue(undefined)

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 4: MASTER tier finished → subscription handler', async () => {
    const payload = buildIpnPayload({ invoice_id: '5589879034' })
    const config = {
      kind: 'subscription' as const,
      tier: 'MASTER' as const,
      config: {
        tier: 'MASTER' as const,
        invoiceId: '5589879034',
        price: 4999,
        currency: 'USD',
        name: 'Master',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue(undefined)

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  // ─── One-Time Cases (9): Finished ──────────────────────────────────────────

  it('case 9: STARTER_BUNDLE one_time finished → one-time handler', async () => {
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
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue(undefined)

    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalledWith(payload, sku)
    expect(subscriptionHandler.handleFinished).not.toHaveBeenCalled()
  })

  // ─── Edge Cases (11-14): Finished ──────────────────────────────────────────

  it('case 11: unknown invoice_id → log warn, no handler call', async () => {
    const payload = buildIpnPayload({ invoice_id: 'unknown_9999999999' })
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(null)

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).not.toHaveBeenCalled()
    expect(oneTimeHandler.handleOneTimeFinished).not.toHaveBeenCalled()
  })

  it('case 12: malformed order_id → still dispatch based on invoice_id', async () => {
    const payload = buildIpnPayload({ invoice_id: '5710519960', order_id: 'malformed' })
    const config = {
      kind: 'subscription' as const,
      tier: 'BASIC' as const,
      config: {
        tier: 'BASIC' as const,
        invoiceId: '5710519960',
        price: 199,
        currency: 'USD',
        name: 'Starter',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue(undefined)

    await dispatchFinished(payload)

    // Dispatcher routes based on invoice_id, not order_id validation — handler validates order_id
    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 13: missing invoice_id → fall through to subscription handler', async () => {
    const payload = buildIpnPayload({ invoice_id: undefined })
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue(undefined)

    await dispatchFinished(payload)

    // No invoice_id — fall through to subscription (backward compat)
    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 14: missing payment_id → still processes', async () => {
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
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue(undefined)

    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalled()
  })

  // ─── Status Branch Cases (15-16): Finished ────────────────────────────────

  it('case 15: payment_status=failed → no special handling (payload passed as-is)', async () => {
    const payload = buildIpnPayload({
      invoice_id: '7810429001',
      payment_status: 'failed',
    })
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
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue(undefined)

    // Dispatcher doesn't filter by payment_status — routes based on invoice_id
    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalled()
  })

  it('case 16: payment_status=expired → no special handling', async () => {
    const payload = buildIpnPayload({
      invoice_id: '7810429001',
      payment_status: 'expired',
    })
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
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue(undefined)

    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalled()
  })
})

describe('dispatchRefunded — subscription + one-time refund routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── Subscription Cases (5-8): Refunded ────────────────────────────────────

  it('case 5: BASIC tier refunded → subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: '5710519960',
      payment_status: 'refunded',
    })
    const config = {
      kind: 'subscription' as const,
      tier: 'BASIC' as const,
      config: {
        tier: 'BASIC' as const,
        invoiceId: '5710519960',
        price: 199,
        currency: 'USD',
        name: 'Starter',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue(undefined)

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('case 6: PREMIUM tier refunded → subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: '4559269964',
      payment_status: 'refunded',
    })
    const config = {
      kind: 'subscription' as const,
      tier: 'PREMIUM' as const,
      config: {
        tier: 'PREMIUM' as const,
        invoiceId: '4559269964',
        price: 399,
        currency: 'USD',
        name: 'Growth',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue(undefined)

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('case 7: ENTERPRISE tier refunded → subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: '6336799275',
      payment_status: 'refunded',
    })
    const config = {
      kind: 'subscription' as const,
      tier: 'ENTERPRISE' as const,
      config: {
        tier: 'ENTERPRISE' as const,
        invoiceId: '6336799275',
        price: 799,
        currency: 'USD',
        name: 'Premium',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue(undefined)

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('case 8: MASTER tier refunded → subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: '5589879034',
      payment_status: 'refunded',
    })
    const config = {
      kind: 'subscription' as const,
      tier: 'MASTER' as const,
      config: {
        tier: 'MASTER' as const,
        invoiceId: '5589879034',
        price: 4999,
        currency: 'USD',
        name: 'Master',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue(undefined)

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  // ─── One-Time Case (10): Refunded ──────────────────────────────────────────

  it('case 10: STARTER_BUNDLE one_time refunded → one-time handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: '7810429001',
      payment_status: 'refunded',
    })
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
    vi.mocked(oneTimeHandler.handleOneTimeRefunded).mockResolvedValue(undefined)

    await dispatchRefunded(payload)

    expect(oneTimeHandler.handleOneTimeRefunded).toHaveBeenCalledWith(payload)
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled()
  })

  it('refund with no invoice_id → fall through to subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: undefined,
      payment_status: 'refunded',
    })
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue(undefined)

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('refund with unknown invoice_id → still fall through to subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: 'unknown_9999999999',
      payment_status: 'refunded',
    })
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(null)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue(undefined)

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })
})
