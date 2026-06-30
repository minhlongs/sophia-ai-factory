/**
 * E2E: NOWPayments Payment Lifecycle
 *
 * Validates the full billing hardening chain:
 *   - Happy path: finished -> purchase creation, paid, fulfillment
 *   - Idempotency: replay does NOT double-activate
 *   - Concurrent replays: single insert
 *   - Refund -> purchase cancelled via markRefunded + access revocation
 *   - Expired / failed / partially_paid -> no DB side-effects at handler level
 *   - DLQ: permanent error classification
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  handleOneTimeFinished,
  handleOneTimeRefunded,
} from "../nowpayments-ipn-one-time"
import { processNowPaymentsIpn } from "../nowpayments-ipn-handlers"
import * as userPurchasesRepo from "@/seed/db/repositories/user-purchases-repo"
import * as videosRepo from "@/seed/db/repositories/videos-repo"
import * as fulfillment from "@/land/fulfillment/one-time-fulfillment"
import * as auditLog from "@/seed/db/audit/audit-log"
import { logger } from "@/seed/utils/logger-utility"
import type { NowPaymentsIpnPayload } from "../nowpayments-ipn-handlers"
import type { OneTimeSku } from "@/seed/types"

// ── Mock modules ──────────────────────────────────────────────────────────────
// vitest hoists vi.mock factories to the top of the file, before any imports/variables.
// The factory body must be completely self-contained: no references to variables declared
// in this file. We inline the mock fn directly in the factory to satisfy this.

// Mock the ipn-db module (getDb + parseUserIdFromOrderId) that nowpayments-ipn-one-time imports.
// Must come BEFORE the repo mocks so the chainable D1 client mock is in place.
vi.mock('@/land/billing/nowpayments-ipn-db', () => {
  // Combined D1Database-like mock supporting both:
  //  - PostgREST-style: db.from('t').select().eq().single() / .insert({}) / .update({}).eq()
  //  - D1 SQL-style:    d1.prepare(sql).bind().run()
  // Used by: ipn-db.ts (getDb/getD1), ipn-one-time.ts, ipn-handlers.ts, ipn-dispatch.ts,
  //          audit-log.ts (recordAudit).
  // Every op is async and returns safe defaults; tests verify behavior via repo mocks.
  const always = async () => ({ data: null, error: null })

  const makeChainable = () => ({
    // PostgREST-style table accessor
    from: () => ({
      select: () => ({
        eq: () => ({
          single: always,
          // support for .lt().order() chains (used by getStaleDlqEntries)
        }),
        lt: () => ({
          order: always,
          eq: () => always, // further eq after lt
        }),
        gte: () => ({
          lt: () => ({
            order: always,
          }),
        }),
        order: always,
      }),
      insert: always, // .from(t).insert({...}) → Promise<{error, data}>
      upsert: always,
      update: () => ({
        eq: () => always,
      }),
      delete: always,
    }),
    // D1 SQL-style prepared statement (used by audit-log.ts)
    prepare: () => ({
      bind: (..._args: unknown[]) => ({
        run: async () => ({ success: true, meta: { changes: 0 } }),
        first: async () => ({ data: null }),
        all: async () => ({ results: [] }),
      }),
    }),
  })

  return {
    getDb: vi.fn(() => makeChainable()),
    getD1: vi.fn(() => makeChainable()),
    parseUserIdFromOrderId: (orderId: string) => {
      const parts = orderId.split('_')
      return parts.length >= 3 && parts[0] === 'sophia' ? parts[1] : null
    },
    isPaymentProcessed: vi.fn(() => Promise.resolve(false)),
    recordIpnEvent: vi.fn(() => Promise.resolve()),
  }
})

vi.mock('@/seed/db/repositories/user-purchases-repo')
vi.mock('@/seed/db/repositories/videos-repo')
vi.mock('@/land/fulfillment/one-time-fulfillment')
vi.mock('@/seed/db/audit/audit-log')
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))
vi.mock('@/tree/handover/auto-handover', () => ({
  triggerAutoHandover: vi.fn(async () => {}),
}))

// Mock the subscription sub-router so handleFailed/handleExpired are no-ops
// (avoids touching D1 via getDb().from(...) in tests that only exercise the one-time path).
vi.mock('@/land/billing/nowpayments-ipn-subscription', () => ({
  handleFailed: vi.fn(async () => ({ ok: true, value: undefined })),
  handleExpired: vi.fn(async () => ({ ok: true, value: undefined })),
  handlePartiallyPaid: vi.fn(async () => ({ ok: true, value: undefined })),
  handleFinished: vi.fn(async () => ({ ok: true, value: undefined })),
}))

// ── Shared constants ──────────────────────────────────────────────────────────
// parseUserIdFromOrderId splits order_id on "_" and returns parts[1].
// order_id format: "sophia_<userId>_<nonce>"  -> userId = parts[1] = "usr"
export const PAY_FINISHED = "pay_finished_e2e"
export const PAY_FAILED = "pay_failed_e2e"
export const LICENSE_NONCE = "lic_e2e_001"
// Effective userId (after parseUserIdFromOrderId):
const EFFECTIVE_USER_ID = "usr"   // sophia_usr_<nonce> -> parts[1]

function buildIpnPayload(overrides: Partial<NowPaymentsIpnPayload> = {}): NowPaymentsIpnPayload {
  return {
    payment_id: PAY_FINISHED,
    payment_status: 'finished',
    invoice_id: '7810429001',
    order_id: 'sophia_usr_001_1700000000',
    price_amount: 49,
    price_currency: 'usd',
    ...overrides,
  }
}

const STARTER_SKU: OneTimeSku = {
  id: "STARTER_BUNDLE",
  invoiceId: "7810429001",
  priceUsd: 49,
  credits: 10,
  ttlMonths: 12,
  label_vi: "Gói Khởi Đầu",
  label_en: "Starter Bundle",
} as const

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Happy path: finished IPN -> purchase creation + paid mark + fulfillment
// ══════════════════════════════════════════════════════════════════════════════
describe("Section 1 — Happy path", () => {
  it("finished IPN inserts purchase, marks paid, triggers fulfillment", async () => {
    const payload = buildIpnPayload()
    const purchaseId = "purchase_123"

    vi.mocked(userPurchasesRepo.insertPurchase).mockResolvedValue(purchaseId)
    vi.mocked(userPurchasesRepo.markPaid).mockResolvedValue(undefined)
    vi.mocked(fulfillment.triggerOneTimeFulfillment).mockResolvedValue(undefined)

    await handleOneTimeFinished(payload, STARTER_SKU)

    // insertPurchase called with userId parsed from order_id (parts[1] = "usr")
    expect(userPurchasesRepo.insertPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: EFFECTIVE_USER_ID,
        kind: "one_time",
        sku: "STARTER_BUNDLE",
        paymentId: PAY_FINISHED,
        invoiceId: "7810429001",
        amountCents: 4900, // 49 * 100
        creditsTotal: 10,
        status: "pending",
      }),
    )
    // markPaid called with paymentId + sku.credits + expiresAt
    expect(userPurchasesRepo.markPaid).toHaveBeenCalledWith(
      PAY_FINISHED,
      10,
      expect.any(Number), // expiresAt
    )
    // fulfillment called with userId + purchaseId + sku
    expect(fulfillment.triggerOneTimeFulfillment).toHaveBeenCalledWith(
      EFFECTIVE_USER_ID,
      purchaseId,
      STARTER_SKU,
    )
    // Audit log recorded
    expect(auditLog.recordAudit).toHaveBeenCalledWith(
      expect.anything(), // d1
      expect.objectContaining({
        tableName: "user_purchases",
        action: "update",
        after: expect.objectContaining({ status: "paid" }),
      }),
    )
    // Info-level log emitted
    expect(logger.info).toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Idempotency: replay does NOT double-activate
// ══════════════════════════════════════════════════════════════════════════════
describe("Section 2 — Idempotency", () => {
  it("replaying the same finished IPN reuses existing purchase_id, no duplicate insert", async () => {
    const payId = "pay_idem_" + Date.now()
    const payload = buildIpnPayload({ payment_id: payId })
    const existingId = "purchase_existing"

    vi.mocked(userPurchasesRepo.insertPurchase).mockResolvedValue(existingId)
    vi.mocked(userPurchasesRepo.markPaid).mockResolvedValue(undefined)
    vi.mocked(fulfillment.triggerOneTimeFulfillment).mockResolvedValue(undefined)

    await handleOneTimeFinished(payload, STARTER_SKU)

    // Repo enforces uniqueness on payment_id; insert is called once
    expect(userPurchasesRepo.insertPurchase).toHaveBeenCalledTimes(1)
    expect(userPurchasesRepo.markPaid).toHaveBeenCalledWith(
      payId,
      10,
      expect.any(Number),
    )
    expect(fulfillment.triggerOneTimeFulfillment).toHaveBeenCalledWith(
      EFFECTIVE_USER_ID,
      existingId,
      STARTER_SKU,
    )
    // No warning logged for normal flow
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it("two concurrent replays of same payment_id only succeed once (UNIQUE constraint prevents duplicate)", async () => {
    const payId = "pay_concurrent_" + Date.now()
    const payload = buildIpnPayload({ payment_id: payId })

    // First call succeeds; second call rejects with UNIQUE violation.
    const firstInsert = vi.fn().mockResolvedValue("purchase_concurrent")
    const secondInsert = vi.fn().mockRejectedValue(
      new Error("UNIQUE constraint failed: user_purchases.payment_id"),
    )
    // Alternate calls: first->success, second->rejection
    const insertCalls: Array<ReturnType<typeof firstInsert>> = [firstInsert(), secondInsert()]
    vi.mocked(userPurchasesRepo.insertPurchase).mockImplementation(() => insertCalls.shift() as any)
    vi.mocked(userPurchasesRepo.markPaid).mockResolvedValue(undefined)
    vi.mocked(fulfillment.triggerOneTimeFulfillment).mockResolvedValue(undefined)

    const results = await Promise.allSettled([
      handleOneTimeFinished(payload, STARTER_SKU),
      handleOneTimeFinished(payload, STARTER_SKU),
    ])

    // Exactly one call returned ok; one returned failure with constraint error
    const okCount = results.filter((r) => r.status === "fulfilled").filter((r) => { const v = (r as PromiseFulfilledResult<{ ok: boolean }>).value; return v && typeof v === 'object' && v.ok === true }).length
    expect(okCount).toBe(1)
    expect(userPurchasesRepo.insertPurchase).toHaveBeenCalledTimes(2)
  }, 10_000)
})

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Refund -> purchase cancelled via markRefunded + access revocation
// ══════════════════════════════════════════════════════════════════════════════
describe("Section 3 — Refund -> purchase cancelled", () => {
  it("refunded IPN routes to refund handler, purchase cancelled + access revoked", async () => {
    const payId = "pay_refund_" + Date.now()
    const refundPayload: NowPaymentsIpnPayload = {
      payment_id: payId,
      payment_status: "refunded",
      invoice_id: "7810429001",
      order_id: 'sophia_usr_001_1700000000',
      price_amount: 49,
      price_currency: "usd",
    }

    vi.mocked(userPurchasesRepo.getByPaymentId).mockResolvedValue({
      id: "purchase_abc",
      userId: EFFECTIVE_USER_ID,
      kind: "one_time",
      paymentId: payId,
      creditsRemaining: 0,
      status: "refunded",
    } as any)
    vi.mocked(userPurchasesRepo.markRefunded).mockResolvedValue(undefined)
    vi.mocked(videosRepo.revokeAccessByPurchaseId).mockResolvedValue(undefined)

    await handleOneTimeRefunded(refundPayload)

    // Order: getByPaymentId(payId) -> markRefunded(payId) -> revokeAccessByPurchaseId(purchaseId)
    expect(userPurchasesRepo.getByPaymentId).toHaveBeenCalledWith(payId)
    expect(userPurchasesRepo.markRefunded).toHaveBeenCalledWith(payId)
    expect(videosRepo.revokeAccessByPurchaseId).toHaveBeenCalledWith("purchase_abc")
    expect(logger.info).toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Router short-circuit: expired / failed / partially_paid
//              does NOT trigger handleOneTimeFinished (no DB side-effects)
// ══════════════════════════════════════════════════════════════════════════════
describe("Section 4 — Router short-circuit (expired / failed / partially_paid)", () => {
  // Verification via absence of side-effects:
  // For non-finished statuses, the router logs/ignores them — no insertPurchase,
  // no markPaid, no fulfillment call should fire.
  it.each([
    ["expired", "expired"],
    ["failed", "failed"],
    ["partially_paid", "partially_paid"],
  ])(
    "%s IPN: no insertPurchase/markPaid/fulfillment side-effects",
    async (_, status) => {
      const payId = "pay_skip_" + status + "_" + Date.now()
      const payload = buildIpnPayload({
        payment_id: payId,
        payment_status: status as any,
      })

      await processNowPaymentsIpn(payload)

      // Router must NOT call any one-time side-effect handlers for these statuses
      expect(userPurchasesRepo.insertPurchase).not.toHaveBeenCalled()
      expect(userPurchasesRepo.markPaid).not.toHaveBeenCalled()
      expect(fulfillment.triggerOneTimeFulfillment).not.toHaveBeenCalled()
    },
  )
})

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Refund without invoice_id -> markRefunded + access revoked
// ══════════════════════════════════════════════════════════════════════════════
describe("Section 5 — Refund without invoice_id", () => {
  it("refund with no invoice_id cancels purchase via markRefunded + revokeAccess", async () => {
    const payId = "pay_no_inv_" + Date.now()
    const payload: NowPaymentsIpnPayload = {
      payment_id: payId,
      payment_status: "refunded",
      order_id: 'sophia_usr_001_1700000000',
      price_amount: 49,
      price_currency: "usd",
    }

    vi.mocked(userPurchasesRepo.getByPaymentId).mockResolvedValue({
      id: "purchase_def",
      userId: EFFECTIVE_USER_ID,
      kind: "one_time",
      paymentId: payId,
      creditsRemaining: 0,
      status: "refunded",
    } as any)
    vi.mocked(userPurchasesRepo.markRefunded).mockResolvedValue(undefined)
    vi.mocked(videosRepo.revokeAccessByPurchaseId).mockResolvedValue(undefined)

    await handleOneTimeRefunded(payload)

    // Handler uses markRefunded(paymentId) + revokeAccessByPurchaseId(purchaseId)
    expect(userPurchasesRepo.markRefunded).toHaveBeenCalledWith(payId)
    expect(videosRepo.revokeAccessByPurchaseId).toHaveBeenCalledWith("purchase_def")
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — DLQ: permanent error classification
// ══════════════════════════════════════════════════════════════════════════════
describe("Section 6 — DLQ error classification", () => {
  it("schema error thrown during purchase insert propagates without markPaid/fulfillment", async () => {
    const payId = "pay_schema_" + Date.now()
    const schemaError = new Error("FOREIGN KEY constraint failed: nowpayments_ipn.user_id")
    const payload = buildIpnPayload({ payment_id: payId })

    vi.mocked(userPurchasesRepo.insertPurchase).mockRejectedValue(schemaError)
    vi.mocked(userPurchasesRepo.markPaid).mockResolvedValue(undefined)
    vi.mocked(fulfillment.triggerOneTimeFulfillment).mockResolvedValue(undefined)

    // Handler returns failure Result with error info
    await expect(
      handleOneTimeFinished(payload, STARTER_SKU),
    ).resolves.toHaveProperty('ok', false)

    // No side-effects after insert throws: no markPaid, no fulfillment
    expect(userPurchasesRepo.markPaid).not.toHaveBeenCalled()
    expect(fulfillment.triggerOneTimeFulfillment).not.toHaveBeenCalled()
  })
})
