/**
 * GET /api/cron/weekly-signals-digest — Monday 06:00 UTC weekly signals digest
 * RED-TEAM #3: CRON_SECRET bearer only (no session — server-to-server)
 * Flow: PostHog Query API → OpenRouter summarize → Resend email + Telegram
 * Bilingual: VN + EN digest
 */

import { NextRequest } from 'next/server'
import { requireCron } from '@/lib/signals/auth-helper'
import { logger } from '@/lib/utils/logger-utility'

const POSTHOG_QUERY_URL = 'https://us.i.posthog.com/api/projects/@current/events/'

interface PostHogEvent {
  event: string
  count?: number
}

interface PostHogEventsResponse {
  results?: PostHogEvent[]
}

/** Fetch top events from PostHog Insights API (last 7 days) */
async function fetchTopEvents(): Promise<PostHogEvent[]> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  if (!apiKey) {
    logger.warn('[digest] POSTHOG_PERSONAL_API_KEY not set')
    return []
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const res = await fetch(
      `${POSTHOG_QUERY_URL}?after=${since}&limit=100`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    )
    if (!res.ok) {
      logger.warn('[digest] PostHog events API non-OK', { status: res.status })
      return []
    }
    const data = (await res.json()) as PostHogEventsResponse
    return data.results ?? []
  } catch (err) {
    logger.warn('[digest] PostHog events fetch failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

/** Summarize events via OpenRouter (cheap model — gpt-4o-mini) */
async function summarizeWithAI(eventsSummary: string): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY
  if (!openRouterKey) return eventsSummary

  const prompt = [
    'You are a growth analyst for Sophia AI Factory (B2B SaaS video platform).',
    'Analyze these PostHog events from the past 7 days and provide:',
    '1. Top 3 winners (highest engagement / conversion events)',
    '2. Top 3 losers (drop-off signals or low activity)',
    '3. 3 recommended actions to improve conversion',
    '',
    'Respond in both Vietnamese and English. Be concise (< 300 words total).',
    '',
    'Events data:',
    eventsSummary,
  ].join('\n')

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sophia.agencyos.network',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
      }),
    })

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      return data.choices?.[0]?.message?.content ?? eventsSummary
    }
  } catch (err) {
    logger.warn('[digest] OpenRouter summarize failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return eventsSummary
}

/** Send digest email via Resend */
async function sendEmail(summary: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  const founderEmail = process.env.FOUNDER_EMAIL
  if (!resendKey || !founderEmail) {
    logger.warn('[digest] RESEND_API_KEY or FOUNDER_EMAIL not set — skipping email')
    return
  }

  const weekStr = new Date().toISOString().slice(0, 10)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sophia Digest <digest@sophia.agencyos.network>',
        to: [founderEmail],
        subject: `[Sophia] Weekly Signals Digest — ${weekStr} / Báo Cáo Tín Hiệu Tuần`,
        text: summary,
      }),
    })
    if (!res.ok) {
      logger.warn('[digest] Resend email non-OK', { status: res.status })
    }
  } catch (err) {
    logger.warn('[digest] Resend email failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/** Send digest to Telegram founder chat */
async function sendTelegram(summary: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_FOUNDER_CHAT_ID
  if (!botToken || !chatId) return

  const text = `📊 *Weekly Signals Digest*\n\n${summary.slice(0, 3800)}`

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch (err) {
    logger.warn('[digest] Telegram send failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireCron(req)
  if (auth instanceof Response) return auth

  logger.info('[digest] Starting weekly signals digest')

  const events = await fetchTopEvents()

  const eventCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.event] = (acc[e.event] ?? 0) + (e.count ?? 1)
    return acc
  }, {})

  const eventSummaryText =
    events.length > 0
      ? Object.entries(eventCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 20)
          .map(([name, count]) => `${name}: ${count}`)
          .join('\n')
      : 'No events recorded this week / Không có sự kiện nào tuần này'

  const summary = await summarizeWithAI(eventSummaryText)

  await Promise.allSettled([sendEmail(summary), sendTelegram(summary)])

  logger.info('[digest] Weekly signals digest sent')

  return Response.json({ ok: true, eventCount: events.length })
}
