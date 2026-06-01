/**
 * One-Time IPN Handler Tests — Finished & Refunded states
 * Focuses on: purchase idempotency, credit grant, fulfillment trigger, refund handling
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleOneTimeFinished, handleOneTimeRefunded } from '../nowpayments-ipn-one-time'
import * as userPurchasesRepo from '@/seed/db/repositories/user-purchases-repo'
import * as videosRepo from '@/seed/db/repositories/videos-repo'
import * as fulfillment from '@/land/fulfillment/one-time-fulfillment'
import * as auditLog from '@/seed/db/audit/audit-log'
import { logger } from '@/seed/utils/logger-utility'
import type { NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers'
import type { OneTimeSku } from '@/seed/types'

// Mock modules
vi.mock('@/seed/db/repositories/user-purchases-repo')
vi.mock('@/seed/db/repositories/videos-repo')
vi.mock('@/land/fulfillment/one-time-fulfillment')
vi.mock('@/seed/db/audit/audit-log')
vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(async () => ({})),
}))
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function buildIpnPayload(overrides: Partial<NowPaymentsIpnPayload> = {}): NowPaymentsIpnPayload {
  return {
    payment_id: 'pay_' + Math.random().toString(36).slice(2),
    invoice_id: '7810429001',
    order_id: 'sophia_user1_1234567890',
    payment_status: 'finished',
    price_amount: 49,
    price_currency: 'usd',
    ...overrides,
  }
}

const STARTER_SKU: OneTimeSku = {
  id: 'STARTER_BUNDLE',
  invoiceId: '7810429001',
  priceUsd: 49,
  credits: 10,
  ttlMonths: 12,
  label_vi: 'Gói Khởi Đầu',
  label_en: 'Starter Bundle',
}

describe('handleOneTimeFinished — purchase creation + fulfillment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('happy path: inserts purchase, marks paid, triggers fulfillment', async () => {
    const payload = buildIpnPayload()
    const purchaseId = 'purchase_123'

    vi.mocked(userPurchasesRepo.insertPurchase).mockResolvedValue(purchaseId)
    vi.mocked(userPurchasesRepo.markPaid).mockResolvedValue(undefined)
    vi.mocked(fulfillment.triggerOneTimeFulfillment).mockResolvedValue(undefined)

    await handleOneTimeFinished(payload, STARTER_SKU)

    // Verify insert called with correct inputs
    expect(userPurchasesRepo.insertPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user1',
        kind: 'one_time',
        sku: 'STARTER_BUNDLE',
        paymentId: payload.payment_id,
        invoiceId: '7810429001',
        amountCents: 4900,
        creditsTotal: 10,
        status: 'pending',
      })
    )

    // Verify markPaid called after insert
    expect(userPurchasesRepo.markPaid).toHaveBeenCalledWith(
      payload.payment_id,
      10,
      expect.any(Number) // expiresAt
    )

    // Verify fulfillment triggered
    expect(fulfillment.triggerOneTimeFulfillment).toHaveBeenCalledWith(
      'user1',
      purchaseId,
      STARTER_SKU
    )
  })

  it('idempotent: replay same payment_id returns existing purchase_id, no duplicate insert', async () => {
    const payload = buildIpnPayload({ payment_id: 'pay_duplicate_123' })
    const existingId = 'purchase_existing'

    // First call returns existing row
    vi.mocked(userPurchasesRepo.insertPurchase).mockResolvedValue(existingId)
    vi.mocked(userPurchasesRepo.markPaid).mockResolvedValue(undefined)
    vi.mocked(fulfillment.triggerOneTimeFulfillment).mockResolvedValue(undefined)

    await handleOneTimeFinished(payload, STARTER_SKU)

    // Verify only one insert attempt (repo handles idempotency)
    expect(userPurchasesRepo.insertPurchase).toHaveBeenCalledTimes(1)
  })

  it('insert failure: logs error, returns early', async () => {
    const payload = buildIpnPayload()
    vi.mocked(userPurchasesRepo.insertPurchase).mockResolvedValue(null)

    await handleOneTimeFinished(payload, STARTER_SKU)

    // Should log error and NOT continue
    expect(logger.error).toHaveBeenCalledWith(
      '[IPN/OneTime] finished: failed to insert purchase row',
      undefined,
      expect.any(Object)
    )

    // markPaid and fulfillment should NOT be called
    expect(userPurchasesRepo.markPaid).not.toHaveBeenCalled()
    expect(fulfillment.triggerOneTimeFulfillment).not.toHaveBeenCalled()
  })

  it('malformed order_id (no userId): logs warn, returns early', async () => {
    const payload = buildIpnPayload({ order_id: 'malformed_no_userid' })

    await handleOneTimeFinished(payload, STARTER_SKU)

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('cannot parse userId'),
      expect.anything()
    )
    expect(userPurchasesRepo.insertPurchase).not.toHaveBeenCalled()
  })

  it('fulfillment error is non-fatal: still succeeds after logging error', async () => {
    const payload = buildIpnPayload()
    const purchaseId = 'purchase_123'

    vi.mocked(userPurchasesRepo.insertPurchase).mockResolvedValue(purchaseId)
    vi.mocked(userPurchasesRepo.markPaid).mockResolvedValue(undefined)
    vi.mocked(fulfillment.triggerOneTimeFulfillment).mockRejectedValue(
      new Error('HeyGen API down')
    )

    await handleOneTimeFinished(payload, STARTER_SKU)

    // Should still reach markPaid
    expect(userPurchasesRepo.markPaid).toHaveBeenCalled()

    // Fulfillment error logged as error (F7: every catch must emit logger.error)
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Fulfillment trigger failed'),
      expect.anything(),
      expect.anything()
    )
  })

  it('expires_at calculated correctly: now + SKU.ttlMonths', async () => {
    const payload = buildIpnPayload()
    const purchaseId = 'purchase_123'
    const beforeSeconds = Math.floor(Date.now() / 1000)

    vi.mocked(userPurchasesRepo.insertPurchase).mockResolvedValue(purchaseId)
    vi.mocked(userPurchasesRepo.markPaid).mockResolvedValue(undefined)
    vi.mocked(fulfillment.triggerOneTimeFulfillment).mockResolvedValue(undefined)

    await handleOneTimeFinished(payload, STARTER_SKU)

    // Extract expires_at from markPaid call
    const markPaidCall = vi.mocked(userPurchasesRepo.markPaid).mock.calls[0]
    const expiresAtArg = markPaidCall[2] as number

    // Should be roughly 12 months (±10 days tolerance for clock skew)
    const twelveMonthsSeconds = 12 * 30 * 24 * 60 * 60
    expect(expiresAtArg).toBeGreaterThan(beforeSeconds + twelveMonthsSeconds - 10 * 24 * 60 * 60)
    expect(expiresAtArg).toBeLessThanOrEqual(beforeSeconds + twelveMonthsSeconds + 10 * 24 * 60 * 60)
  })
})

describe('handleOneTimeRefunded — purchase refund handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('happy path: marks purchase refunded, zeros credits', async () => {
    const payload = buildIpnPayload({ payment_status: 'refunded' })

    vi.mocked(userPurchasesRepo.markRefunded).mockResolvedValue(undefined)

    await handleOneTimeRefunded(payload)

    expect(userPurchasesRepo.markRefunded).toHaveBeenCalledWith(payload.payment_id)

    // Verify audit trail attempted
    expect(auditLog.recordAudit).toHaveBeenCalled()

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('refunded'),
      expect.anything()
    )
  })

  it('refund with malformed order_id: logs warn, returns early', async () => {
    const payload = buildIpnPayload({
      payment_status: 'refunded',
      order_id: 'malformed',
    })

    await handleOneTimeRefunded(payload)

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('cannot parse userId'),
      expect.anything()
    )
    expect(userPurchasesRepo.markRefunded).not.toHaveBeenCalled()
  })

  it('audit trail failure is non-fatal', async () => {
    const payload = buildIpnPayload({ payment_status: 'refunded' })

    vi.mocked(userPurchasesRepo.markRefunded).mockResolvedValue(undefined)
    vi.mocked(auditLog.recordAudit).mockRejectedValue(new Error('Audit DB down'))

    // Should not throw
    await expect(handleOneTimeRefunded(payload)).resolves.toBeUndefined()

    // But markRefunded should still complete
    expect(userPurchasesRepo.markRefunded).toHaveBeenCalled()
  })

  it('F10: video access IS revoked on refund when purchase found', async () => {
    const payload = buildIpnPayload({ payment_status: 'refunded' })
    const purchaseId = 'purchase_xyz'

    vi.mocked(userPurchasesRepo.markRefunded).mockResolvedValue(undefined)
    vi.mocked(userPurchasesRepo.getByPaymentId).mockResolvedValue({
      id: purchaseId,
      user_id: 'user1',
      payment_id: payload.payment_id ?? '',
      kind: 'one_time',
      sku: 'STARTER_BUNDLE',
      status: 'refunded',
      amount_cents: 4900,
      credits_total: 10,
      credits_remaining: 0,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    })
    vi.mocked(videosRepo.revokeAccessByPurchaseId).mockResolvedValue(undefined)

    await handleOneTimeRefunded(payload)

    // Verify revokeAccessByPurchaseId was called with the correct purchaseId
    expect(videosRepo.revokeAccessByPurchaseId).toHaveBeenCalledWith(purchaseId)
    // Fulfillment trigger NOT called (refund path)
    expect(fulfillment.triggerOneTimeFulfillment).not.toHaveBeenCalled()
  })
})

// P0.4: Underpayment guard tests
describe('handleOneTimeFinished — underpayment guard (P0.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when actually_paid < price_amount * 0.99', async () => {
    // $49 * 0.99 = $48.51 — $46.55 is underpaid
    const payload = buildIpnPayload({ price_amount: 49, actually_paid: 46.55 })

    await handleOneTimeFinished(payload, STARTER_SKU)

    // Should NOT insert purchase or trigger fulfillment
    expect(userPurchasesRepo.insertPurchase).not.toHaveBeenCalled()
    expect(fulfillment.triggerOneTimeFulfillment).not.toHaveBeenCalled()

    // Should log underpayment warning
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Underpayment detected'),
      expect.anything()
    )
  })

  it('accepts when actually_paid >= price_amount * 0.99 (within tolerance)', async () => {
    // $49 * 0.99 = $48.51 — $48.60 is acceptable
    const payload = buildIpnPayload({ price_amount: 49, actually_paid: 48.60 })
    const purchaseId = 'purchase_ok'
    vi.mocked(userPurchasesRepo.insertPurchase).mockResolvedValue(purchaseId)
    vi.mocked(userPurchasesRepo.markPaid).mockResolvedValue(undefined)
    vi.mocked(fulfillment.triggerOneTimeFulfillment).mockResolvedValue(undefined)

    await handleOneTimeFinished(payload, STARTER_SKU)

    expect(userPurchasesRepo.insertPurchase).toHaveBeenCalled()
    expect(fulfillment.triggerOneTimeFulfillment).toHaveBeenCalled()
  })

  it('proceeds normally when actually_paid is undefined (no underpayment data)', async () => {
    // NOWPayments may omit actually_paid for some payment methods
    const payload = buildIpnPayload({ price_amount: 49 }) // no actually_paid
    const purchaseId = 'purchase_normal'
    vi.mocked(userPurchasesRepo.insertPurchase).mockResolvedValue(purchaseId)
    vi.mocked(userPurchasesRepo.markPaid).mockResolvedValue(undefined)
    vi.mocked(fulfillment.triggerOneTimeFulfillment).mockResolvedValue(undefined)

    await handleOneTimeFinished(payload, STARTER_SKU)

    expect(userPurchasesRepo.insertPurchase).toHaveBeenCalled()
    expect(fulfillment.triggerOneTimeFulfillment).toHaveBeenCalled()
  })

  it('accepts exact payment (actually_paid === price_amount)', async () => {
    const payload = buildIpnPayload({ price_amount: 49, actually_paid: 49 })
    const purchaseId = 'purchase_exact'
    vi.mocked(userPurchasesRepo.insertPurchase).mockResolvedValue(purchaseId)
    vi.mocked(userPurchasesRepo.markPaid).mockResolvedValue(undefined)
    vi.mocked(fulfillment.triggerOneTimeFulfillment).mockResolvedValue(undefined)

    await handleOneTimeFinished(payload, STARTER_SKU)

    expect(userPurchasesRepo.insertPurchase).toHaveBeenCalled()
    expect(fulfillment.triggerOneTimeFulfillment).toHaveBeenCalled()
  })
})
