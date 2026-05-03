/**
 * Send refund lifecycle emails via Resend.
 * Falls back to no-op if Resend not configured.
 *
 * @module lib/billing/email/send-refund-emails
 */

import { Resend } from 'resend'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'
import {
  buildRefundReceivedEmail,
  buildRefundApprovedEmail,
  buildRefundRejectedEmail,
  buildRefundCompletedEmail,
  type RefundEmailCtx,
} from './templates/refund-emails'

const SUPPORT_FROM = 'Sophia AI <support@sophia.agencyos.network>'

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  tag: string,
): Promise<void> {
  const resend = getResend()
  if (!resend) {
    logger.info('[RefundEmail] Resend not configured — skipping', { to, tag })
    return
  }
  try {
    const { error } = await resend.emails.send({ from: SUPPORT_FROM, to, subject, html, text, tags: [{ name: 'type', value: tag }] })
    if (error) throw new Error(error.message)
    logger.info('[RefundEmail] Sent', { to, tag })
  } catch (err) {
    logger.error('[RefundEmail] Failed', err instanceof Error ? err : undefined, { to, tag })
    throw new Error(getErrorMessage(err))
  }
}

export async function sendRefundReceivedEmail(ctx: RefundEmailCtx): Promise<void> {
  const { subject, text, html } = buildRefundReceivedEmail(ctx)
  await sendEmail(ctx.userEmail, subject, html, text, 'refund_received')

  // Also notify support
  const adminEmail = process.env.SUPPORT_EMAIL ?? 'support@sophia.agencyos.network'
  const adminCtx = { ...ctx, locale: 'en' }
  const admin = buildRefundReceivedEmail(adminCtx)
  const adminSubject = `[REFUND REQUEST] ${ctx.purchaseId} — ${ctx.userEmail}`
  await sendEmail(adminEmail, adminSubject, admin.html, admin.text, 'refund_received_admin').catch(() => null)
}

export async function sendRefundApprovedEmail(ctx: RefundEmailCtx): Promise<void> {
  const { subject, text, html } = buildRefundApprovedEmail(ctx)
  await sendEmail(ctx.userEmail, subject, html, text, 'refund_approved')
}

export async function sendRefundRejectedEmail(ctx: RefundEmailCtx): Promise<void> {
  const { subject, text, html } = buildRefundRejectedEmail(ctx)
  await sendEmail(ctx.userEmail, subject, html, text, 'refund_rejected')
}

export async function sendRefundCompletedEmail(ctx: RefundEmailCtx): Promise<void> {
  const { subject, text, html } = buildRefundCompletedEmail(ctx)
  await sendEmail(ctx.userEmail, subject, html, text, 'refund_completed')
}
