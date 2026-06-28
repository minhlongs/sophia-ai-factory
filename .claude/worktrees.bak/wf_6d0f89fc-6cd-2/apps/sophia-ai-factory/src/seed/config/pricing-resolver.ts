/**
 * Pricing resolver — returns effective price for a SKU.
 * DB override takes precedence over hardcoded defaults.
 * Admin-configurable without code changes.
 *
 * @module lib/config/pricing-resolver
 */

import { getD1 } from '@/seed/db/client'
import { ONE_TIME_SKUS } from '@/seed/config/one-time-skus'
import { logger } from '@/seed/utils/logger-utility'

interface PricingOverrideRow {
  sku: string
  price_cents: number
  enabled: number
  metadata: string | null
}

/**
 * Returns the effective price in cents for a SKU.
 * DB override (if exists and enabled) > hardcoded default.
 */
export async function getEffectiveSkuPrice(skuId: string): Promise<number> {
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;
    const row = await db
      .prepare('SELECT sku, price_cents, enabled FROM pricing_overrides WHERE sku = ?1')
      .bind(skuId)
      .first<PricingOverrideRow>()

    if (row && row.enabled === 1) {
      return row.price_cents
    }
  } catch (err) {
    logger.error('[PricingResolver] DB lookup failed, using default', err instanceof Error ? err : undefined, { skuId })
  }

  // Fallback to hardcoded catalog
  const sku = (ONE_TIME_SKUS as Record<string, { priceUsd: number } | undefined>)[skuId]
  return sku ? Math.round(sku.priceUsd * 100) : 0
}

/**
 * Set or update a SKU price override (admin-only caller ensures authorization).
 */
export async function setSkuPrice(
  skuId: string,
  priceCents: number,
  adminUserId: string,
): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  await db
    .prepare(
      `INSERT INTO pricing_overrides (sku, price_cents, enabled, updated_at, updated_by_user_id)
       VALUES (?1, ?2, 1, strftime('%s','now'), ?3)
       ON CONFLICT(sku) DO UPDATE SET
         price_cents = excluded.price_cents,
         enabled = 1,
         updated_at = excluded.updated_at,
         updated_by_user_id = excluded.updated_by_user_id`,
    )
    .bind(skuId, priceCents, adminUserId)
    .run()
}

/**
 * List all pricing overrides for admin display.
 */
export async function listPricingOverrides(): Promise<PricingOverrideRow[]> {
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;
    const result = await db.prepare('SELECT * FROM pricing_overrides ORDER BY sku').all<PricingOverrideRow>()
    return result.results ?? []
  } catch {
    return []
  }
}

/**
 * Get effective prices for all known SKUs (merged with overrides).
 */
export async function getAllEffectivePrices(): Promise<Record<string, number>> {
  const overrides: Record<string, number> = {}
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const result = await db.prepare('SELECT sku, price_cents, enabled FROM pricing_overrides').all<PricingOverrideRow>()
    for (const row of result.results ?? []) {
      if (row.enabled === 1) overrides[row.sku] = row.price_cents
    }
  } catch {
    // ignore, return defaults
  }

  const prices: Record<string, number> = {}
  for (const [id, sku] of Object.entries(ONE_TIME_SKUS)) {
    prices[id] = overrides[id] ?? Math.round(sku.priceUsd * 100)
  }
  return prices
}
