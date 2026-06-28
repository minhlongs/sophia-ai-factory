/**
 * Send "Bundle Outage Apology" email via Resend.
 * Idempotent: checks billing_events for prior send to avoid duplicate emails.
 * Uses event kind 'outage_apology_sent_<purchase_id_prefix>' as dedup key.
 *
 * @module lib/billing/email/send-bundle-outage-apology-email
 */

import { Resend } from 'resend'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { createServerClient } from '@/seed/db/client'
import {
  buildBundleOutageApologyEmail,
  type BundleOutageApologyContext,
} from './templates/bundle-outage-apology'

let resendClient: Resend | null = null

function getResend(): Resend | null {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY
    if (!key) return null
    resendClient = new Resend(key)
  }
  return resendClient
}

const EMAIL_TYPE = 'outage_apology_sent'

/** Check if outage apology was already sent for this purchase (idempotency guard). */
async function isAlreadySent(purchaseId: string): Promise<boolean> {
  try {
    const db = createServerClient()
    const { data } = await db
      .from('billing_events')
      .select('id')
      .eq('email_template', EMAIL_TYPE)
      .eq('license_nonce', purchaseId.slice(0, 16))
      .single()
    return data !== null
  } catch {
    return false
  }
}

export interface SendBundleOutageApologyInput extends BundleOutageApologyContext {
  userEmail?: string
}

/**
 * Send outage apology email and log delivery.
 * Idempotent via billing_events check on (email_template, license_nonce).
 */
export async function sendBundleOutageApologyEmail(
  ctx: SendBundleOutageApologyInput,
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const alreadySent = await isAlreadySent(ctx.purchaseId)
  if (alreadySent) {
    logger.info('[BundleOutageApologyEmail] Already sent for purchase, skipping', {
      purchaseId: ctx.purchaseId,
    })
    return { success: true, skipped: true }
  }

  const { subject, text, html } = buildBundleOutageApologyEmail(ctx)
  const resend = getResend()
  const toEmail = ctx.userEmail

  try {
    if (!toEmail) {
      logger.warn('[BundleOutageApologyEmail] No email address — logging only', {
        purchaseId: ctx.purchaseId,
      })
    } else if (!resend) {
      logger.warn('[BundleOutageApologyEmail] Resend not configured — logging only', {
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

      logger.info('[BundleOutageApologyEmail] Sent', { to: toEmail, emailId: data?.id })
    }

    // Audit log (always — even when skipped due to missing address)
    const db = createServerClient()
    await db.from('billing_events').insert({
      user_id: ctx.userId,
      license_nonce: ctx.purchaseId.slice(0, 16),
      event_type: EMAIL_TYPE,
      event_category: 'notification',
      event_data: { purchase_id: ctx.purchaseId, opened_at: ctx.openedAt },
      email_sent: !!toEmail && !!resend,
      email_template: EMAIL_TYPE,
      email_recipient: toEmail ?? null,
      email_sent_at: new Date().toISOString(),
      processed: true,
      processed_at: new Date().toISOString(),
    })

    return { success: true }
  } catch (err) {
    logger.error('[BundleOutageApologyEmail] Failed to send', err instanceof Error ? err : undefined, {
      purchaseId: ctx.purchaseId,
    })
    return { success: false, error: getErrorMessage(err) }
  }
}
