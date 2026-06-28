/**
 * Receipt email orchestrator — idempotent send via Resend.
 * Checks payment_events.receipt_sent before sending to avoid duplicates.
 * @module billing/email/receipt-email-sender
 */

import { Resend } from 'resend'
import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { renderReceipt } from './receipt-email-template'
import type { ReceiptInput } from './receipt-email-template'
import { resolveEmailBranding, appendEmailFooter, buildLogoImgTag } from './tenant-branding-resolver'

export type { ReceiptInput }

let resendClient: Resend | null = null

function getResend(): Resend | null {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY
    if (!key) return null
    resendClient = new Resend(key)
  }
  return resendClient
}

/**
 * Send receipt email for a completed payment.
 * Idempotent: skips if receipt_sent=1 for this payment_id in payment_events.
 */
export async function sendReceiptEmail(input: ReceiptInput): Promise<void> {
  const eventId = `nowpayments_${input.paymentId}`
  const db = createServerClient()

  // Check idempotency
  try {
    const { data } = await db
      .from('payment_events')
      .select('receipt_sent')
      .eq('event_id', eventId)
      .single()
    if (data?.receipt_sent === 1 || data?.receipt_sent === true) {
      logger.info('[Receipt] Already sent, skipping', { paymentId: input.paymentId })
      return
    }
  } catch { /* no row yet — proceed */ }

  const { subject, html: rawHtml, text } = renderReceipt(input)
  const resend = getResend()

  if (!resend) {
    logger.warn('[Receipt] Resend not configured — email logged only', { to: input.email, subject })
    return
  }

  // Additive branding: load tenant overrides, fall back to defaults if unavailable
  const tenantBranding = await resolveEmailBranding(input.email).catch(() => ({
    fromName: null, footerMarkdown: null, logoUrl: null,
  }))

  let finalHtml = rawHtml
  if (tenantBranding.logoUrl) {
    const logoTag = buildLogoImgTag(tenantBranding.logoUrl)
    finalHtml = finalHtml.replace('<body', `<body`).replace(/(<body[^>]*>)/, `$1${logoTag}`)
  }
  finalHtml = appendEmailFooter(finalHtml, tenantBranding.footerMarkdown)

  const FROM_DEFAULT = process.env.RESEND_FROM_EMAIL || 'noreply@sophia.agencyos.network'
  const fromDisplay = tenantBranding.fromName
    ? `${tenantBranding.fromName} <${FROM_DEFAULT}>`
    : FROM_DEFAULT

  await resend.emails.send({
    from: fromDisplay,
    to: input.email,
    subject,
    html: finalHtml,
    text,
    tags: [{ name: 'type', value: 'receipt' }],
  })

  // Mark sent
  try {
    await db
      .from('payment_events')
      .update({ receipt_sent: 1 })
      .eq('event_id', eventId)
  } catch (err) {
    logger.warn('[Receipt] Failed to mark receipt_sent (non-fatal)', { paymentId: input.paymentId, error: String(err) })
  }

  logger.info('[Receipt] Sent successfully', { to: input.email, tier: input.tier, paymentId: input.paymentId })
}
