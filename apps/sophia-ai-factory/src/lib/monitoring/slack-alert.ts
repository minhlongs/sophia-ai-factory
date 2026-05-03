/**
 * Slack alert utility for operational monitoring.
 * Posts a structured message to the configured Slack webhook URL.
 * Falls back to email-to-support if Slack webhook is unavailable.
 *
 * @module lib/monitoring/slack-alert
 */

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'

export type AlertSeverity = 'high' | 'medium' | 'low'

/**
 * Send an alert to Slack (or fallback to support@ email log).
 * Never throws — all errors are caught and logged.
 */
export async function sendSlackAlert(
  severity: AlertSeverity,
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  const webhookUrl = process.env.SLACK_OPS_WEBHOOK_URL

  if (!webhookUrl) {
    // Fallback: structured error log (monitoring infra will email on error threshold)
    logger.error('[SlackAlert] SLACK_OPS_WEBHOOK_URL not configured — fallback alert', undefined, {
      severity,
      message,
      ...context,
    })
    return
  }

  const emoji = severity === 'high' ? ':red_circle:' : severity === 'medium' ? ':large_yellow_circle:' : ':large_green_circle:'
  const payload = {
    text: `${emoji} *[${severity.toUpperCase()}]* ${message}`,
    attachments: context
      ? [
          {
            color: severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'good',
            fields: Object.entries(context).map(([k, v]) => ({
              title: k,
              value: String(v),
              short: true,
            })),
          },
        ]
      : undefined,
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      logger.warn('[SlackAlert] Webhook POST returned non-OK', { status: res.status, severity })
    }
  } catch (err) {
    logger.warn('[SlackAlert] POST failed', { error: getErrorMessage(err), severity })
  }
}
