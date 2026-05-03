/**
 * GET /api/admin/pricing/list — list all SKU prices with effective values (admin only).
 *
 * @module app/api/admin/pricing/list/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getAllEffectivePrices, listPricingOverrides } from '@/lib/config/pricing-resolver'
import { ONE_TIME_SKUS } from '@/config/one-time-skus'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  const [effectivePrices, overrides] = await Promise.all([
    getAllEffectivePrices(),
    listPricingOverrides(),
  ])

  const overrideMap: Record<string, { price_cents: number; enabled: number }> = {}
  for (const o of overrides) {
    overrideMap[o.sku] = { price_cents: o.price_cents, enabled: o.enabled }
  }

  const skus = Object.entries(ONE_TIME_SKUS).map(([id, sku]) => ({
    sku: id,
    default_price_cents: Math.round(sku.priceUsd * 100),
    override: overrideMap[id] ?? null,
    effective_price_cents: effectivePrices[id] ?? Math.round(sku.priceUsd * 100),
    label_vi: sku.label_vi,
    label_en: sku.label_en,
  }))

  return NextResponse.json({ skus })
}
