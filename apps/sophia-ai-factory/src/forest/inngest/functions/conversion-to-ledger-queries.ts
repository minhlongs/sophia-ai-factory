/**
 * Conversion-to-Ledger D1 Query Helpers
 *
 * Layer: forest/inngest/functions
 */

import { getD1 } from '@/seed/db/client'

export interface ConversionRow {
  id: string
  tenant_id: string
  gross_amount_usd: number
  commission_usd: number
  attributed_at: number
  status: string
  affiliate_id: string
  offer_id: string
  commission_pct: number | null
}

export async function fetchConversionRow(
  conversionEventId: string,
  tenantId: string,
): Promise<ConversionRow | null> {
  const _db = await getD1()
  if (!_db) throw new Error('D1 database binding not available')
  const db = _db
  return db
    .prepare(
      `SELECT ce.id, ce.tenant_id, ce.gross_amount_usd, ce.commission_usd,
              ce.attributed_at, ce.status,
              al.user_id AS affiliate_id,
              ao.id AS offer_id, ao.commission_pct
       FROM conversion_events ce
       JOIN affiliate_links al ON al.id = ce.link_id
       JOIN affiliate_offers ao ON ao.id = al.offer_id
       WHERE ce.id = ? AND ce.tenant_id = ?`,
    )
    .bind(conversionEventId, tenantId)
    .first<ConversionRow>()
}

export async function fetchTenantTierForAffiliate(affiliateId: string): Promise<string> {
  const _db = await getD1()
  if (!_db) throw new Error('D1 database binding not available')
  const db = _db
  const row = await db
    .prepare(`SELECT tier FROM users WHERE id = ? LIMIT 1`)
    .bind(affiliateId)
    .first<{ tier: string }>()
  return row?.tier ?? 'BASIC'
}

/**
 * Reads the canonical namespaced tenant_settings schema (migration 0085):
 * one row per (tenant_id, namespace) with a JSON `value` payload.
 */
export async function fetchTenantVnPitEnabled(tenantId: string): Promise<boolean> {
  const _db = await getD1()
  if (!_db) throw new Error('D1 database binding not available')
  const db = _db
  const row = await db
    .prepare(
      `SELECT value FROM tenant_settings WHERE tenant_id = ? AND namespace = 'vn_pit' LIMIT 1`,
    )
    .bind(tenantId)
    .first<{ value: string }>()
  if (!row?.value) return false
  try {
    const parsed = JSON.parse(row.value) as { enabled?: boolean }
    return parsed.enabled === true
  } catch {
    return false
  }
}
