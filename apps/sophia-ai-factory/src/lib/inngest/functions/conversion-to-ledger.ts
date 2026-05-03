/**
 * Conversion-to-Ledger Inngest Function
 *
 * Listens for `conversion.created` events emitted by Phase 9 affiliate webhooks.
 * Calculates commission (with optional VN PIT 5% withholding) and inserts a
 * pending commission_ledger row. Idempotent via UNIQUE(conversion_event_id).
 *
 * @module inngest/functions/conversion-to-ledger
 */

import { inngest } from '@/lib/inngest/client'
import { calculateCommission } from '@/lib/affiliates/commission-calculator'
import { insertPendingLedger } from '@/lib/payouts/commission-ledger'
import { toCents } from '@/lib/payouts/commission-cents'
import { getD1Raw } from '@/seed/db/client'

const CLAWBACK_WINDOW_DAYS = 14
const SECONDS_PER_DAY = 86400
const VN_PIT_RATE = 0.05

interface ConversionRow {
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

export const conversionToLedger = inngest.createFunction(
  {
    id: 'conversion-to-ledger',
    name: 'Conversion → Commission Ledger',
  },
  { event: 'conversion.created' },
  async ({ event, step }) => {
    const { conversionEventId, tenantId } = event.data

    const conversion = await step.run('fetch-conversion', async () => {
      const db = await getD1Raw()
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
    })

    if (!conversion) {
      return { skipped: true, reason: 'Conversion event not found' }
    }

    if (conversion.status === 'rejected') {
      return { skipped: true, reason: 'Conversion already rejected' }
    }

    const tenantTier = await step.run('fetch-tenant-tier', async () => {
      const db = await getD1Raw()
      const row = await db
        .prepare(`SELECT tier FROM users WHERE id = ? LIMIT 1`)
        .bind(conversion.affiliate_id)
        .first<{ tier: string }>()
      return row?.tier ?? 'BASIC'
    })

    // H1: check VN PIT flag for tenant
    const vnPitEnabled = await step.run('fetch-tenant-vn-pit', async () => {
      const db = await getD1Raw()
      const row = await db
        .prepare(`SELECT vn_pit_enabled FROM tenant_settings WHERE tenant_id = ? LIMIT 1`)
        .bind(tenantId)
        .first<{ vn_pit_enabled: number }>()
      return (row?.vn_pit_enabled ?? 0) === 1
    })

    const { commissionUsd, commissionPct } = await step.run('calculate-commission', async () => {
      return calculateCommission({
        grossAmountUsd: conversion.gross_amount_usd,
        offerCommissionPct: conversion.commission_pct ?? 0.3,
        tenantTier,
      })
    })

    // H1: compute VN PIT withholding in cents (floor to avoid over-withholding)
    const commissionCents = toCents(commissionUsd)
    const withheldCents = vnPitEnabled ? Math.floor(commissionCents * VN_PIT_RATE) : 0

    const payableAt = conversion.attributed_at + CLAWBACK_WINDOW_DAYS * SECONDS_PER_DAY
    const ledgerId = `ldg_${conversionEventId}`

    await step.run('insert-ledger', async () => {
      await insertPendingLedger({
        id: ledgerId,
        tenant_id: conversion.tenant_id,
        affiliate_id: conversion.affiliate_id,
        conversion_event_id: conversionEventId,
        offer_id: conversion.offer_id,
        gross_amount_usd: conversion.gross_amount_usd,
        commission_pct: commissionPct,
        commission_usd: commissionUsd,
        payable_at: payableAt,
        withheld_cents: withheldCents,
      })
    })

    return {
      ledgerId,
      commissionUsd,
      commissionPct,
      withheldCents,
      payableAt,
    }
  },
)
