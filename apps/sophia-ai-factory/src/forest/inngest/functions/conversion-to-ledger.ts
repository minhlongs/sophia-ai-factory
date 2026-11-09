/**
 * Conversion-to-Ledger Inngest Function
 *
 * Listens for `conversion.created` events emitted by affiliate webhooks.
 * Calculates commission (with optional VN PIT 5% withholding) and inserts a
 * pending commission_ledger row. Idempotent via UNIQUE(conversion_event_id).
 *
 * @module inngest/functions/conversion-to-ledger
 */

import { inngest } from '@/seed/inngest/client'
import { calculateCommission } from '@/land/affiliates/commission-calculator'
import { insertPendingLedger } from '@/land/payouts/commission-ledger'
import { toCents } from '@/land/payouts/commission-cents'
import { writeConversionRevenueEvent } from '@/land/analytics/tiktok-revenue-ingestion'
import {
  detectSelfReferral,
  evaluateCommissionEscrowEligibility,
} from '@/tree/affiliate/fraud/affiliate-escrow-guard'
import { logger } from '@/seed/utils/logger-utility'
import {
  fetchConversionRow,
  fetchTenantTierForAffiliate,
  fetchTenantVnPitEnabled,
} from './conversion-to-ledger-queries'

export {
  fetchConversionRow,
  fetchTenantTierForAffiliate,
  fetchTenantVnPitEnabled,
  type ConversionRow,
} from './conversion-to-ledger-queries'

const CLAWBACK_WINDOW_DAYS = 14
const SECONDS_PER_DAY = 86400
const VN_PIT_RATE = 0.05

export const conversionToLedger = inngest.createFunction(
  {
    id: 'conversion-to-ledger',
    name: 'Conversion → Commission Ledger',
  },
  { event: 'conversion.created' },
  async ({ event, step }) => {
    const { conversionEventId, tenantId } = event.data

    const conversion = await step.run('fetch-conversion', async () =>
      fetchConversionRow(conversionEventId, tenantId),
    )

    if (!conversion) {
      return { skipped: true, reason: 'Conversion event not found' }
    }

    if (conversion.status === 'rejected') {
      return { skipped: true, reason: 'Conversion already rejected' }
    }

    const rawEventData = event.data as Record<string, unknown>
    const buyerUserId =
      typeof rawEventData.buyerUserId === 'string' ? rawEventData.buyerUserId : ''
    const selfRefCheck = detectSelfReferral({
      affiliateUserId: conversion.affiliate_id,
      buyerUserId,
    })
    if (selfRefCheck.isSelfReferral) {
      logger.warn('[conversion-to-ledger] Self-referral blocked by SEC-07 guard', {
        conversionEventId,
        affiliateId: conversion.affiliate_id,
        reason: selfRefCheck.reason,
      })
      return { skipped: true, reason: selfRefCheck.reason ?? 'SELF_REFERRAL_BLOCKED' }
    }

    const escrowCheck = evaluateCommissionEscrowEligibility({
      conversionTimestampMs: conversion.attributed_at * 1000,
    })

    const tenantTier = await step.run('fetch-tenant-tier', async () =>
      fetchTenantTierForAffiliate(conversion.affiliate_id),
    )

    const vnPitEnabled = await step.run('fetch-tenant-vn-pit', async () =>
      fetchTenantVnPitEnabled(tenantId),
    )

    const { commissionUsd, commissionPct } = await step.run('calculate-commission', async () => {
      return calculateCommission({
        grossAmountUsd: conversion.gross_amount_usd,
        offerCommissionPct: conversion.commission_pct ?? 0.3,
        tenantTier,
      })
    })

    // Compute VN PIT withholding in cents (floor to avoid over-withholding)
    const commissionCents = toCents(commissionUsd)
    const withheldCents = vnPitEnabled ? Math.floor(commissionCents * VN_PIT_RATE) : 0

    const escrowReleaseSec = Math.floor(escrowCheck.releaseAtTimestampMs / 1000)
    const payableAt =
      rawEventData.enforceSec07EscrowHold === true
        ? escrowReleaseSec
        : conversion.attributed_at + CLAWBACK_WINDOW_DAYS * SECONDS_PER_DAY
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

    // Bridge to performance_events so affiliate revenue shows in the
    // creative economy dashboard. Never fails the handler — dashboard
    // visibility is best-effort, the ledger row above is the source of truth.
    const revenueWritten = await step.run('write-performance-event', async () => {
      try {
        const result = await writeConversionRevenueEvent({
          conversionEventId,
          tenantId,
          affiliateId: conversion.affiliate_id,
          grossAmountUsd: conversion.gross_amount_usd,
          commissionUsd,
          attributedAt: conversion.attributed_at,
          offerId: conversion.offer_id,
        })
        return result.written
      } catch (err) {
        logger.warn('[conversion-to-ledger] performance event write failed', {
          conversionEventId,
          error: err instanceof Error ? err.message : String(err),
        })
        return 0
      }
    })

    return {
      ledgerId,
      commissionUsd,
      commissionPct,
      withheldCents,
      payableAt,
      escrowStatus: escrowCheck.status,
      revenueWritten,
    }
  },
)
