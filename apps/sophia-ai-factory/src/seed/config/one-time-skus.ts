/**
 * One-Time SKU catalog — SSOT for one-time bundle offerings.
 * Separate from NOWPAYMENTS_TIERS (subscription) to avoid collision.
 * CEO decision: STARTER_BUNDLE — $49 / 10 credits / 12-month TTL.
 *
 * @module config/one-time-skus
 */

import { z } from 'zod'
import type { OneTimeSku, OneTimeSkuId } from '@/seed/types'

// ── Zod validation ─────────────────────────────────────────────────────────────

export const OneTimeSkuSchema = z.object({
  id: z.string().min(1),
  invoiceId: z.string().min(1),
  priceUsd: z.number().positive(),
  credits: z.number().int().positive(),
  ttlMonths: z.number().int().positive(),
  label_vi: z.string().min(1),
  label_en: z.string().min(1),
})

export const OneTimeSkuMapSchema = z.record(z.string(), OneTimeSkuSchema)

// ── SKU catalog ────────────────────────────────────────────────────────────────

/**
 * One-time purchase SKU catalog.
 * invoice IDs are pre-created in NOWPayments dashboard — MUST NOT overlap with NOWPAYMENTS_TIERS.
 */
export const ONE_TIME_SKUS: Record<OneTimeSkuId, OneTimeSku> = {
  STARTER_BUNDLE: {
    id: 'STARTER_BUNDLE',
    invoiceId: '7810429001',
    priceUsd: 49,
    credits: 10,
    ttlMonths: 12,
    label_vi: 'Gói Khởi Đầu — 10 video / 12 tháng',
    label_en: 'Starter Bundle — 10 videos / 12 months',
  },
  CREDIT_PACK_STARTER: {
    id: 'CREDIT_PACK_STARTER',
    invoiceId: '4448829105',
    priceUsd: 29,
    credits: 10,
    ttlMonths: 3,
    label_vi: 'Gói Credits Khởi Đầu — 10 credits / 3 tháng',
    label_en: 'Credit Pack Starter — 10 credits / 3 months',
  },
  CREDIT_PACK_STANDARD: {
    id: 'CREDIT_PACK_STANDARD',
    invoiceId: '6342179908',
    priceUsd: 129,
    credits: 50,
    ttlMonths: 3,
    label_vi: 'Gói Credits Tiêu Chuẩn — 50 credits / 3 tháng',
    label_en: 'Credit Pack Standard — 50 credits / 3 months',
  },
  CREDIT_PACK_POWER: {
    id: 'CREDIT_PACK_POWER',
    invoiceId: '6129425474',
    priceUsd: 449,
    credits: 200,
    ttlMonths: 3,
    label_vi: 'Gói Credits Nâng Cao — 200 credits / 3 tháng',
    label_en: 'Credit Pack Power — 200 credits / 3 months',
  },
}

// Validate catalog at module load (fail-fast if misconfigured)
OneTimeSkuMapSchema.parse(ONE_TIME_SKUS)

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/** Find a SKU by its NOWPayments invoiceId. Returns null if not found. */
export function getOneTimeSkuByInvoiceId(invoiceId: string): OneTimeSku | null {
  return (
    Object.values(ONE_TIME_SKUS).find((s) => s.invoiceId === invoiceId) ?? null
  )
}

/** Find a SKU by its SKU id. Returns null if not found. */
export function getOneTimeSkuById(id: string): OneTimeSku | null {
  return (ONE_TIME_SKUS as Record<string, OneTimeSku>)[id] ?? null
}

/** All NOWPayments invoice IDs registered for one-time SKUs. */
export const ONE_TIME_INVOICE_IDS: Set<string> = new Set(
  Object.values(ONE_TIME_SKUS).map((s) => s.invoiceId),
)
