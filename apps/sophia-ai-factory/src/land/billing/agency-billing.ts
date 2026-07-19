/**
 * Agency billing logic for WhiteLabel Video Engine.
 *
 * Handles NOWPayments IPN events for agency tier payments.
 * Agency orders use "ag_" prefix in order_id.
 *
 * Uses raw D1 prepared statements (not Supabase ORM) following project pattern.
 * D1 .first<T>() returns T | null directly (NOT {data, error}).
 *
 * @module billing/agency-billing
 */

import { getDb, parseAgencyIdFromOrderId } from './nowpayments-ipn-db'
import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { AGENCY_TIERS, type AgencyTier } from '@/seed/config/tiers/tier-configs'
import { lookupAgencyInvoice, type AgencyInvoiceConfig } from '@/tree/clients/nowpayments-client'
import { success, failure, type Result } from '@/seed/types/result'
import type { D1Database } from '@cloudflare/workers-types'
import { Resend } from 'resend'

// ── Types ────────────────────────────────────────────────────────────────────

/** Minimal shape accepted by agency IPN handlers (avoids circular import) */
export type NowPaymentsIpnPayloadLike = {
  payment_id: string
  payment_status: string
  order_id?: string
  price_amount: number
  price_currency: string
  invoice_id?: string
  actually_paid?: number
  customer_email?: string
}

export interface AgencyPaymentResult {
  agencyId: number
  slug: string
  tier: AgencyTier
  monthlyPrice: number
  status: 'activated' | 'already_active' | 'upgraded' | 'skipped'
}

// ── Constants ────────────────────────────────────────────────────────────────

const AGENCY_ORDER_PREFIX = 'ag_'
const AMOUNT_TOLERANCE_PCT = 0.01

// ── Synchronous validation (no DB) ──────────────────────────────────────────

export function processAgencyPayment(
  ipn: {
    order_id: string | undefined
    payment_status: string
    price_amount: number
    payment_id: string
    invoice_id?: string
  },
): Result<AgencyPaymentResult, { code: string; message: string }> {
  if (!ipn.order_id?.startsWith(AGENCY_ORDER_PREFIX)) {
    return failure({
      code: 'NOT_AN_AGENCY_ORDER',
      message: `order_id does not have agency prefix "${AGENCY_ORDER_PREFIX}"`,
    })
  }

  const agencyId = parseAgencyIdFromOrderId(ipn.order_id)
  if (!agencyId) {
    return failure({
      code: 'INVALID_AGENCY_ORDER_ID',
      message: `Cannot parse agency ID from order_id: ${ipn.order_id}`,
    })
  }

  if (ipn.payment_status !== 'finished') {
    return failure({
      code: 'PAYMENT_NOT_FINISHED',
      message: `Agency payment status is "${ipn.payment_status}", expected "finished"`,
    })
  }

  // Option C: prefer invoice-level routing, fallback to amount detection for backward compat
  let tierConfig: { tier: AgencyTier; monthlyPrice: number } | undefined | null
  if (ipn.invoice_id) {
    const agencyConfig = lookupAgencyInvoice(ipn.invoice_id)
    if (agencyConfig) {
      tierConfig = { tier: agencyConfig.tier, monthlyPrice: agencyConfig.monthlyPrice }
      logger.info('[AgencyBilling] Tier resolved via agency invoice lookup', {
        invoiceId: ipn.invoice_id,
        tier: tierConfig.tier,
        monthlyPrice: tierConfig.monthlyPrice,
      })
    }
  }

  // Fallback to existing amount detection when invoice not registered or missing
  if (!tierConfig) {
    tierConfig = inferTierFromAmount(ipn.price_amount)
    if (tierConfig) {
      logger.info('[AgencyBilling] Tier resolved via amount detection (fallback)', {
        amount: ipn.price_amount,
        tier: tierConfig.tier,
      })
    }
  }

  if (!tierConfig) {
    return failure({
      code: 'UNKNOWN_AGENCY_TIER',
      message: ipn.invoice_id
        ? `Invoice ${ipn.invoice_id} not registered in agency invoice config and amount ${ipn.price_amount} does not match any agency tier`
        : `Payment amount ${ipn.price_amount} does not match any agency tier`,
    })
  }

  const agencyIdNum = Number.parseInt(agencyId, 10)
  if (Number.isNaN(agencyIdNum)) {
    return failure({
      code: 'INVALID_AGENCY_ID',
      message: `Agency ID is not a valid number: ${agencyId}`,
    })
  }

  return success({
    agencyId: agencyIdNum,
    slug: '',
    tier: tierConfig.tier,
    monthlyPrice: tierConfig.monthlyPrice,
    status: 'activated',
  })
}

// ── Full async IPN handler ───────────────────────────────────────────────────

export async function handleAgencyIPN(
  ipn: NowPaymentsIpnPayloadLike,
): Promise<Result<void, { code: string; message: string }>> {
  const _d1 = getD1()
  if (!_d1) return failure({ code: 'D1_UNAVAILABLE', message: 'D1 binding not available' })
  const d1: D1Database = _d1

  const eventId = `nowpayments_${ipn.payment_id}_${ipn.payment_status}`

  try {
    // ── 1. Validate ──────────────────────────────────────────────────────
    const validation = processAgencyPayment({
      order_id: ipn.order_id,
      payment_status: ipn.payment_status,
      price_amount: ipn.price_amount,
      payment_id: ipn.payment_id,
    })

    if (!validation.ok) {
      const err = validation.error as { code: string; message: string }
      logger.warn('[AgencyBilling] Validation failed', {
        eventId,
        error: err,
        orderId: ipn.order_id,
        paymentId: ipn.payment_id,
      })
      return failure({ code: err.code, message: err.message })
    }

    const validated = validation.value
    const agencyId = validated.agencyId

    // ── 2. Look up agency via raw D1 ─────────────────────────────────────
    // .first<T>() returns T | null directly (NOT {data, error})
    const agencyRow = await d1.prepare('SELECT * FROM agency WHERE id = ?1').bind(agencyId).first<AgencyRow>()
    if (!agencyRow) {
      return failure({ code: 'AGENCY_NOT_FOUND', message: `Agency ${agencyId} not found` })
    }
    const agency: AgencyRow = agencyRow

    // ── 3. Amount validation against tier price ──────────────────────────
    const expectedPrice = AGENCY_TIERS[agency.tier]?.monthlyPrice
    if (expectedPrice !== undefined && ipn.price_amount !== undefined) {
      if (ipn.price_amount < expectedPrice * (1 - AMOUNT_TOLERANCE_PCT)) {
        return failure({
          code: 'AMOUNT_MISMATCH',
          message: `Expected ~${expectedPrice}, got ${ipn.price_amount}`,
        })
      }
    }

    // ── 4. Idempotency ───────────────────────────────────────────────────
    // .first<T>() returns T | null — use ?? null coalescing
    const eventRow = await d1.prepare('SELECT processed FROM payment_events WHERE event_id = ?1').bind(eventId).first<{ processed: number | boolean | null }>()
    const processed = eventRow?.processed ?? null
    if (processed === 1 || processed === true) {
      return success(undefined)
    }

    // ── 5. Update agency tier if changed via raw D1 ─────────────────────
    const tierChanged = agency.tier !== validated.tier
    const now = Math.floor(Date.now() / 1000)

    if (tierChanged) {
      const updResult = await d1.prepare('UPDATE agency SET tier = ?1, updated_at = ?2 WHERE id = ?3').bind(validated.tier, now, agencyId).run()
      if (updResult.error) {
        return failure({ code: 'TIER_UPDATE_FAILED', message: toError(updResult.error).message })
      }
      logger.info('[AgencyBilling] Tier updated', { agencyId, oldTier: agency.tier, newTier: validated.tier })
    }

    // ── 6. Audit trail via raw D1 ────────────────────────────────────────
    try {
      await d1.prepare('INSERT INTO audit_log (table_name, row_id, action, actor_id, after, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
        .bind('agency', String(agencyId), tierChanged ? 'update' : 'read', String(agency.owner_user_id), JSON.stringify({ agencyId, slug: agency.slug, tier: validated.tier, paymentId: ipn.payment_id, amount: ipn.price_amount, tierChanged }), new Date().toISOString())
        .run()
    } catch (_auditErr) {
      // non-fatal
    }

    // ── 7. Notification (non-fatal) ──────────────────────────────────────
    try {
      await sendAgencyPaymentNotification(agency, validated, ipn)
    } catch (_notifyErr) {
      // non-fatal
    }

    // ── 8. Mark event processed ──────────────────────────────────────────
    await d1.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run()

    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[AgencyBilling] handleAgencyIPN failed', { eventId, paymentId: ipn.payment_id, error: message })
    return failure({ code: 'AGENCY_BILLING_ERROR', message })
  }
}

// ── assignAgencyTier (fulfillment) ──────────────────────────────────────────

export async function assignAgencyTier(
  agencyId: number,
  tier: AgencyTier,
): Promise<Result<void, { code: string; message: string }>> {
  const _d1 = getD1()
  if (!_d1) return failure({ code: 'D1_UNAVAILABLE', message: 'D1 binding not available' })
  const d1: D1Database = _d1

  try {
    const agencyRow = await d1.prepare('SELECT * FROM agency WHERE id = ?1').bind(agencyId).first<AgencyRow>()
    if (!agencyRow) {
      return failure({ code: 'AGENCY_NOT_FOUND', message: `Agency ${agencyId} not found` })
    }
    const agency: AgencyRow = agencyRow

    if (agency.tier === tier) return success(undefined)

    const now = Math.floor(Date.now() / 1000)
    const updResult = await d1.prepare('UPDATE agency SET tier = ?1, updated_at = ?2 WHERE id = ?3').bind(tier, now, agencyId).run()
    if (updResult.error) {
      return failure({ code: 'TIER_UPDATE_FAILED', message: toError(updResult.error).message })
    }

    logger.info('[AgencyBilling] Tier assigned', { agencyId, tier })

    await sendAgencyPaymentNotification(agency, { tier, monthlyPrice: AGENCY_TIERS[tier].monthlyPrice }, { payment_id: 'manual_assign' })

    return success(undefined)
  } catch (err) {
    return failure({ code: 'ASSIGN_TIER_ERROR', message: err instanceof Error ? err.message : String(err) })
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function inferTierFromAmount(amount: number): { tier: AgencyTier; monthlyPrice: number } | null {
  const tiers: { tier: AgencyTier; monthlyPrice: number }[] = [
    { tier: 'starter', monthlyPrice: AGENCY_TIERS.starter.monthlyPrice },
    { tier: 'growth', monthlyPrice: AGENCY_TIERS.growth.monthlyPrice },
    { tier: 'enterprise', monthlyPrice: AGENCY_TIERS.enterprise.monthlyPrice },
  ]
  for (const entry of tiers) {
    if (Math.abs(amount - entry.monthlyPrice) <= entry.monthlyPrice * AMOUNT_TOLERANCE_PCT) {
      return entry
    }
  }
  return null
}

async function sendAgencyPaymentNotification(
  agency: AgencyRow,
  result: { tier: AgencyTier; monthlyPrice: number },
  ipn: { payment_id: string; customer_email?: string },
): Promise<void> {
  const billingEmail = agency.billing_email || ipn.customer_email || ''
  if (!billingEmail) return

  const resend = getResendClient()
  if (!resend) {
    logger.info('[AgencyBilling] Resend not configured — notification logged only', { agencyId: agency.id, tier: result.tier })
    return
  }

  const tierLabel = result.tier.charAt(0).toUpperCase() + result.tier.slice(1)
  const adminPortalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'}/agency/${agency.slug}/dashboard`

  const { data, error } = await resend.emails.send({
    from: 'Sophia AI <billing@sophia.agencyos.network>',
    to: billingEmail,
    subject: `[Sophia AI] Agency "${agency.name}" activated — ${tierLabel} plan`,
    text: buildConfirmationText(agency, result, adminPortalUrl),
    html: buildConfirmationHtml(agency, result, adminPortalUrl),
    tags: [
      { name: 'type', value: 'agency_payment_confirmed' },
      { name: 'agency_id', value: String(agency.id) },
      { name: 'tier', value: result.tier },
    ],
  })

  if (error) {
    logger.error('[AgencyBilling] Resend failed', { agencyId: agency.id, error: error.message })
    return
  }

  logger.info('[AgencyBilling] Notification sent', { agencyId: agency.id, email: billingEmail, emailId: data?.id })
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

function buildConfirmationText(agency: AgencyRow, result: { tier: AgencyTier; monthlyPrice: number }, portalUrl: string): string {
  const tierLabel = result.tier.charAt(0).toUpperCase() + result.tier.slice(1)
  return `Agency Activation Confirmed

Agency: ${agency.name} (${agency.slug})
Plan: ${tierLabel}
Monthly Price: $${result.monthlyPrice}/month
Status: Active

Admin Portal: ${portalUrl}

Your agency is now ready to onboard sub-tenants.
Contact support if you have any questions.

— Sophia AI Factory Team`.trim()
}

function buildConfirmationHtml(agency: AgencyRow, result: { tier: AgencyTier; monthlyPrice: number }, portalUrl: string): string {
  const tierLabel = result.tier.charAt(0).toUpperCase() + result.tier.slice(1)
  return `<!DOCTYPE html><html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;"><h1>Agency Activation Confirmed</h1><p><strong>Agency:</strong> ${agency.name} (${agency.slug})</p><p><strong>Plan:</strong> ${tierLabel}</p><p><strong>Monthly Price:</strong> $${result.monthlyPrice}/month</p><p><strong>Status:</strong> Active</p><hr/><p><a href="${portalUrl}">Open Admin Portal</a></p><p>Your agency is now ready to onboard sub-tenants.</p></body></html>`.trim()
}

// ── Local AgencyRow type (avoids circular import from seed/db/repositories) ──

interface AgencyRow {
  id: number
  slug: string
  name: string
  tier: AgencyTier
  api_key_hash: string
  api_key_prefix: string | null
  owner_user_id: number
  billing_email: string | null
  status: 'active' | 'suspended' | 'cancelled'
  created_at: number
  updated_at: number
}
