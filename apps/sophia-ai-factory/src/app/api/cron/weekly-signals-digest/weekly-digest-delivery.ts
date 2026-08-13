/**
 * Email + Telegram delivery helpers for weekly digest
 * @module api/cron/weekly-signals-digest/weekly-digest-delivery
 */

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind'

const SERVICE_NAME_RESEND = 'resend-email'
const SERVICE_NAME_TELEGRAM = 'telegram-bot'

export async function sendEmail(summary: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  const founderEmail = process.env.FOUNDER_EMAIL
  if (!resendKey || !founderEmail) { logger.warn('[digest] RESEND_API_KEY or FOUNDER_EMAIL not set — skipping email'); return }

  if (!shouldAllowRequest(SERVICE_NAME_RESEND)) {
    throw new Error(`[${SERVICE_NAME_RESEND}] Circuit breaker open`)
  }

  const weekStr = new Date().toISOString().slice(0, 10)
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Sophia Digest <digest@sophia.agencyos.network>',
        to: [founderEmail],
        subject: `[Sophia] Weekly Signals Digest — ${weekStr} / Báo Cáo Tín Hiệu Tuần`,
        text: summary,
      }),
    })
    if (!res.ok) {
      const kind = classifyHttpStatus(res.status)
      recordFailure(SERVICE_NAME_RESEND, kind)
      logger.warn('[digest] Resend email non-OK', { status: res.status })
      return
    }
    recordSuccess(SERVICE_NAME_RESEND)
  } catch (err) {
    if (err instanceof Error && err.message.includes('Circuit breaker open')) throw err
    const kind = classifyError(err)
    recordFailure(SERVICE_NAME_RESEND, kind)
    logger.warn('[digest] Resend email failed', { error: getErrorMessage(err) })
  }
}

export async function sendTelegram(summary: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_FOUNDER_CHAT_ID
  if (!botToken || !chatId) return

  if (!shouldAllowRequest(SERVICE_NAME_TELEGRAM)) {
    throw new Error(`[${SERVICE_NAME_TELEGRAM}] Circuit breaker open`)
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `📊 *Weekly Signals Digest*\n\n${summary.slice(0, 3800)}`, parse_mode: 'Markdown' }),
    })
    if (!res.ok) {
      const kind = classifyHttpStatus(res.status)
      recordFailure(SERVICE_NAME_TELEGRAM, kind)
    } else {
      recordSuccess(SERVICE_NAME_TELEGRAM)
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Circuit breaker open')) throw err
    const kind = classifyError(err)
    recordFailure(SERVICE_NAME_TELEGRAM, kind)
    logger.warn('[digest] Telegram send failed', { error: getErrorMessage(err) })
  }
}

export function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
    if (env?.DB) return env.DB as D1Database
    const ctxSymbol = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol]
    if (ctx?.env?.DB) return ctx.env.DB as D1Database
    return null
  } catch { return null }
}
