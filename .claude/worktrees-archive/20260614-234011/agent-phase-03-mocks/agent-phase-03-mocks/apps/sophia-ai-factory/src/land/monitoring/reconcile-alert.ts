/**
 * Reconciliation alert — sends email to support@ when orphan purchases detected.
 * Uses Resend directly (same pattern as billing emails).
 * Falls back to logger.error if Resend is not configured (monitoring picks up from error log).
 *
 * @module lib/monitoring/reconcile-alert
 */

import { Resend } from 'resend'
import { logger } from '@/seed/utils/logger-utility'
import type { ReconcileResult } from './reconcile-query'

const SUPPORT_EMAIL = 'support@mekongmind.com'
const FROM_EMAIL = 'Sophia AI <ops@sophia.agencyos.network>'

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function buildAlertEmail(result: ReconcileResult): { subject: string; text: string; html: string } {
  const subject = `[ALERT] ${result.orphanCount} orphan purchase(s) detected — fulfillment drift`

  const rows = result.orphans
    .map((o) => `  - ${o.id.slice(0, 12)}… | SKU: ${o.sku}`)
    .join('\n')

  const text = [
    `Fulfillment Reconciliation Alert`,
    ``,
    `Orphan purchases (paid but no completed video): ${result.orphanCount}`,
    `Total paid in window: ${result.paidCount}`,
    `Delivered: ${result.deliveredCount}`,
    `Permanent failures: ${result.permanentFailCount}`,
    ``,
    `Orphan purchase IDs:`,
    rows,
    ``,
    `Action required: investigate orphan purchases and re-trigger fulfillment if needed.`,
  ].join('\n')

  const htmlRows = result.orphans
    .map((o) => `<tr><td>${o.id.slice(0, 12)}…</td><td>${o.sku}</td></tr>`)
    .join('')

  const html = `
<h2 style="color:#dc2626">Fulfillment Reconciliation Alert</h2>
<p><strong>Orphan purchases (paid, no video):</strong> ${result.orphanCount}</p>
<table border="1" cellpadding="6" style="border-collapse:collapse;font-family:monospace">
  <thead><tr><th>Purchase ID</th><th>SKU</th></tr></thead>
  <tbody>${htmlRows}</tbody>
</table>
<p>Total paid in window: ${result.paidCount} | Delivered: ${result.deliveredCount} | Permanent failures: ${result.permanentFailCount}</p>
<p>Action required: investigate and re-trigger fulfillment if needed.</p>
`

  return { subject, text, html }
}

/**
 * Send reconciliation alert email to support.
 * Non-throwing — falls back to structured error log if Resend unavailable.
 */
export async function sendReconcileAlert(result: ReconcileResult): Promise<void> {
  const resend = getResend()
  const { subject, text, html } = buildAlertEmail(result)

  if (!resend) {
    logger.error('[ReconcileAlert] Resend not configured — alert email not sent', undefined, {
      orphanCount: result.orphanCount,
      subject,
    })
    return
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: SUPPORT_EMAIL,
    subject,
    text,
    html,
    tags: [{ name: 'type', value: 'reconcile_alert' }],
  })

  if (error) {
    logger.error('[ReconcileAlert] Resend API error', undefined, {
      orphanCount: result.orphanCount,
      resendError: error.message,
    })
    return
  }

  logger.info('[ReconcileAlert] Alert sent to support', { to: SUPPORT_EMAIL, orphanCount: result.orphanCount })
}
