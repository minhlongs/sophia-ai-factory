/**
 * Send "Bundle Render Failed" email via Resend.
 * Idempotent: checks billing_events before sending to avoid duplicates.
 *
 * @module lib/billing/email/send-bundle-render-failed-email
 */

import { Resend } from 'resend'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'
import { createServerClient } from '@/lib/db/client'
import {
  buildBundleRenderFailedEmail,
  type BundleRenderFailedContext,
} from './templates/bundle-render-failed'

let resendClient: Resend | null = null

function getResend(): Resend | null {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY
    if (!key) return null
    resendClient = new Resend(key)
  }
  return resendClient
}

const EMAIL_TYPE = 'bundle_render_failed'

/** Check if this failure email was already sent for this purchase. */
async function isAlreadySent(purchaseId: string): Promise<boolean> {
  const db = createServerClient()
  const { data } = await db
    .from('billing_events')
    .select('id')
    .eq('email_template', EMAIL_TYPE)
    .eq('license_nonce', purchaseId.slice(0, 16))
    .single()
  return data !== null
}

export interface SendBundleRenderFailedInput {
  userEmail?: string
  userId: string
  purchaseId: string
  locale?: string
}

/**
 * Send bundle-render-failed email and log delivery.
 * Idempotent via billing_events check.
 * Requires userEmail to send; falls back to logger-only if missing.
 */
export async function sendBundleRenderFailedEmail(
  ctx: SendBundleRenderFailedInput,
): Promise<{ success: boolean; error?: string }> {
  const alreadySent = await isAlreadySent(ctx.purchaseId)
  if (alreadySent) {
    logger.info('[BundleRenderFailedEmail] Already sent for purchase, skipping', {
      purchaseId: ctx.purchaseId,
    })
    return { success: true }
  }

  const { subject, text, html } = buildBundleRenderFailedEmail(ctx)
  const resend = getResend()
  const toEmail = ctx.userEmail

  try {
    if (!toEmail) {
      logger.warn('[BundleRenderFailedEmail] No email address — logging only', {
        purchaseId: ctx.purchaseId,
      })
    } else if (!resend) {
      logger.warn('[BundleRenderFailedEmail] Resend not configured — logging only', {
        to: toEmail,
        subject,
        purchaseId: ctx.purchaseId,
      })
    } else {
      const { data, error } = await resend.emails.send({
        from: 'Sophia AI <billing@sophia.agencyos.network>',
        to: toEmail,
        subject,
        text,
        html,
        tags: [
          { name: 'type', value: EMAIL_TYPE },
          { name: 'purchase_id', value: ctx.purchaseId.slice(0, 16) },
        ],
      })

      if (error) throw new Error(`Resend API error: ${error.message}`)

      logger.info('[BundleRenderFailedEmail] Sent', { to: toEmail, emailId: data?.id })
    }

    // Audit log (always, even if email skipped due to missing address)
    const db = createServerClient()
    await db.from('billing_events').insert({
      user_id: ctx.userId,
      license_nonce: ctx.purchaseId.slice(0, 16),
      event_type: EMAIL_TYPE,
      event_category: 'notification',
      event_data: { purchase_id: ctx.purchaseId },
      email_sent: !!toEmail && !!resend,
      email_template: EMAIL_TYPE,
      email_recipient: toEmail ?? null,
      email_sent_at: new Date().toISOString(),
      processed: true,
      processed_at: new Date().toISOString(),
    })

    return { success: true }
  } catch (err) {
    logger.error('[BundleRenderFailedEmail] Failed to send', err instanceof Error ? err : undefined, {
      purchaseId: ctx.purchaseId,
    })
    return { success: false, error: getErrorMessage(err) }
  }
}
