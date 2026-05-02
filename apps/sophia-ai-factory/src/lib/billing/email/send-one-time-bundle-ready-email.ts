/**
 * Send "One-Time Bundle Ready" email via Resend.
 * Idempotent: checks email_log before sending to avoid duplicates.
 *
 * @module lib/billing/email/send-one-time-bundle-ready-email
 */

import { Resend } from 'resend'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'
import { createServerClient } from '@/lib/db/client'
import {
  buildOneTimeBundleReadyEmail,
  type OneTimeBundleReadyContext,
} from './templates/one-time-bundle-ready'

let resendClient: Resend | null = null

function getResend(): Resend | null {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY
    if (!key) return null
    resendClient = new Resend(key)
  }
  return resendClient
}

const EMAIL_TYPE = 'one_time_bundle_ready'

/** Check if this email was already sent for this purchase. */
async function isAlreadySent(purchaseId: string): Promise<boolean> {
  const db = createServerClient()
  const { data } = await db
    .from('billing_events')
    .select('id')
    .eq('email_template', EMAIL_TYPE)
    .eq('user_id', purchaseId)
    .single()
  return data !== null
}

/**
 * Send bundle-ready email and log delivery.
 * Idempotent via billing_events check.
 */
export async function sendOneTimeBundleReadyEmail(
  ctx: OneTimeBundleReadyContext,
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  // Idempotency guard — don't re-send for same purchase
  const alreadySent = await isAlreadySent(ctx.purchaseId)
  if (alreadySent) {
    logger.info('[OneTimeBundleEmail] Already sent for purchase, skipping', {
      purchaseId: ctx.purchaseId,
    })
    return { success: true }
  }

  const { subject, text, html } = buildOneTimeBundleReadyEmail(ctx)
  const resend = getResend()

  try {
    if (!resend) {
      logger.info('[OneTimeBundleEmail] Resend not configured — logged only', {
        to: ctx.userEmail,
        subject,
      })
    } else {
      const { data, error } = await resend.emails.send({
        from: 'Sophia AI <billing@sophia.agencyos.network>',
        to: ctx.userEmail,
        subject,
        text,
        html,
        tags: [
          { name: 'type', value: EMAIL_TYPE },
          { name: 'purchase_id', value: ctx.purchaseId.slice(0, 16) },
        ],
      })

      if (error) throw new Error(`Resend API error: ${error.message}`)

      logger.info('[OneTimeBundleEmail] Sent', { to: ctx.userEmail, emailId: data?.id })
    }

    // Log to billing_events (using purchaseId as user_id for idempotency key)
    const db = createServerClient()
    await db.from('billing_events').insert({
      user_id: ctx.purchaseId,
      license_nonce: ctx.purchaseId.slice(0, 16),
      event_type: EMAIL_TYPE,
      event_category: 'notification',
      event_data: { purchase_id: ctx.purchaseId, credits_remaining: ctx.creditsRemaining },
      email_sent: true,
      email_template: EMAIL_TYPE,
      email_recipient: ctx.userEmail,
      email_sent_at: new Date().toISOString(),
      processed: true,
      processed_at: new Date().toISOString(),
    })

    return { success: true }
  } catch (err) {
    logger.error('[OneTimeBundleEmail] Failed to send', err instanceof Error ? err : undefined, {
      to: ctx.userEmail,
    })
    return { success: false, error: getErrorMessage(err) }
  }
}
