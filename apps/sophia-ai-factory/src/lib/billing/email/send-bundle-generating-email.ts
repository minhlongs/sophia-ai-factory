/**
 * Send "Bundle Generating" email via Resend.
 * Fired immediately when a videos row is inserted with status='queued'.
 * Idempotent: checks billing_events before sending to prevent duplicate sends.
 *
 * @module lib/billing/email/send-bundle-generating-email
 */

import { Resend } from 'resend'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'
import { createServerClient } from '@/lib/db/client'
import {
  buildBundleGeneratingEmail,
  type BundleGeneratingContext,
} from './templates/bundle-generating'

let resendClient: Resend | null = null

function getResend(): Resend | null {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY
    if (!key) return null
    resendClient = new Resend(key)
  }
  return resendClient
}

const EMAIL_TYPE = 'bundle_generating'

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

export interface SendBundleGeneratingInput {
  userEmail: string
  userId: string
  purchaseId: string
  sku: string
  skuLabel: string
  creditsTotal: number
  locale?: string
}

/**
 * Send bundle-generating email and log delivery.
 * Idempotent via billing_events check.
 * Never throws — all errors are caught and returned as result.
 */
export async function sendBundleGeneratingEmail(
  ctx: SendBundleGeneratingInput,
): Promise<{ success: boolean; alreadySent?: boolean; error?: string }> {
  // Guard against duplicate sends
  const alreadySent = await isAlreadySent(ctx.purchaseId)
  if (alreadySent) {
    logger.info('[BundleGeneratingEmail] Already sent, skipping', { purchaseId: ctx.purchaseId })
    return { success: true, alreadySent: true }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'
  const locale = ctx.locale?.startsWith('vi') ? 'vi' as const : 'en' as const
  const statusPageUrl = `${appUrl}/${locale}/dashboard/orders`

  const templateCtx: BundleGeneratingContext = {
    userEmail: ctx.userEmail,
    userId: ctx.userId,
    purchaseId: ctx.purchaseId,
    skuLabel: ctx.skuLabel,
    creditsTotal: ctx.creditsTotal,
    etaMinutes: 10,
    statusPageUrl,
    locale,
  }

  const { subject, text, html } = buildBundleGeneratingEmail(templateCtx)
  const resend = getResend()

  try {
    if (!resend) {
      logger.warn('[BundleGeneratingEmail] Resend not configured — logging only', {
        to: ctx.userEmail,
        purchaseId: ctx.purchaseId,
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

      logger.info('[BundleGeneratingEmail] Sent', { to: ctx.userEmail, emailId: data?.id })
    }

    // Audit log (always, even when Resend not configured)
    const db = createServerClient()
    await db.from('billing_events').insert({
      user_id: ctx.userId,
      license_nonce: ctx.purchaseId.slice(0, 16),
      event_type: EMAIL_TYPE,
      event_category: 'notification',
      event_data: { purchase_id: ctx.purchaseId, sku: ctx.sku },
      email_sent: !!resend,
      email_template: EMAIL_TYPE,
      email_recipient: ctx.userEmail,
      email_sent_at: new Date().toISOString(),
      processed: true,
      processed_at: new Date().toISOString(),
    })

    return { success: true }
  } catch (err) {
    logger.error('[BundleGeneratingEmail] Failed', err instanceof Error ? err : undefined, {
      to: ctx.userEmail,
      purchaseId: ctx.purchaseId,
    })
    return { success: false, error: getErrorMessage(err) }
  }
}
