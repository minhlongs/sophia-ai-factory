/**
 * Telegram Poster — Weekly Digest TL;DR + GH Issue URL
 *
 * Sends a short Telegram message: 1-paragraph TL;DR + link to GH Issue.
 * Full digest lives in the GH Issue body; Telegram is notifications only.
 *
 * Constraints:
 * - Message ≤ 4096 chars (Telegram API hard limit)
 * - Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID → log + skip (no CI red)
 * - Uses TELEGRAM_CHAT_ID (standard env var shared with canary-rollback.yml)
 */

import { logger } from '@/lib/utils/logger-utility'

export interface TelegramPostParams {
  tldr: string
  issueUrl?: string | null
  weekLabel: string
}

export interface TelegramPostResult {
  ok: boolean
  skipped?: boolean
  reason?: string
}

const TELEGRAM_API = 'https://api.telegram.org'
const MAX_MESSAGE_CHARS = 4096

/**
 * Build the Telegram message text.
 * Format: header + TL;DR + optional GH Issue link.
 * Truncates tldr if combined length exceeds limit.
 */
export function buildTelegramMessage(params: TelegramPostParams): string {
  const { tldr, issueUrl, weekLabel } = params

  const header = `📊 *Sophia AI Factory — ${weekLabel}*\n\n`
  const link = issueUrl ? `\n\n🔗 [Full report on GitHub](${issueUrl})` : ''
  const footer = `\n\n_sophia.agencyos.network_`

  // Reserve space for header + link + footer, truncate tldr if needed
  const reserved = header.length + link.length + footer.length
  const available = MAX_MESSAGE_CHARS - reserved - 10 // 10 char buffer
  const safeTldr = tldr.length > available ? tldr.slice(0, available) + '…' : tldr

  return `${header}${safeTldr}${link}${footer}`
}

/**
 * POST a Telegram message to the founder chat.
 *
 * Missing env vars → returns { ok: false, skipped: true } — never throws.
 * Uses TELEGRAM_CHAT_ID (same as canary-rollback.yml convention).
 */
export async function postTelegramDigest(
  params: TelegramPostParams,
): Promise<TelegramPostResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    logger.warn('[digest/telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping')
    return { ok: false, skipped: true, reason: 'missing_env' }
  }

  const text = buildTelegramMessage(params)

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      logger.warn('[digest/telegram] sendMessage non-OK', { status: res.status, body: body.slice(0, 200) })
      return { ok: false, reason: `http_${res.status}` }
    }

    logger.info('[digest/telegram] message sent')
    return { ok: true }
  } catch (err) {
    logger.warn('[digest/telegram] sendMessage failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, reason: 'fetch_error' }
  }
}
