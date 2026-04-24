/**
 * GET /api/cron/weekly-signals-digest — Monday 06:00 UTC weekly signals digest
 * RED-TEAM #3: CRON_SECRET bearer only (no session — server-to-server)
 * Flow: PostHog Query API → OpenRouter summarize → Resend email + Telegram
 *       + D1 aggregates → GH Issue upsert + Telegram TL;DR (Phase 3 extension)
 * Bilingual: VN + EN digest
 */

import { NextRequest } from 'next/server'
import { requireCron } from '@/lib/signals/auth-helper'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'
import {
  querySignupStats,
  queryConversionsByTier,
  queryPaymentStats,
  queryTopByokProviders,
  queryAgentDispatches,
} from '@/lib/signals/digest/d1-aggregates'
import { renderDigestMarkdown, buildTldr, type DigestData } from '@/lib/signals/digest/markdown-renderer'
import { upsertGithubIssue, buildIssueTitle } from '@/lib/signals/digest/github-issue-poster'
import { postTelegramDigest } from '@/lib/signals/digest/telegram-poster'
import { lookupCache, writeCache, type CacheKey } from '@/lib/llm/cache/llm-cache'
import { resolveUserApiKey } from '@/lib/byok/resolve-user-api-key'

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
      error: getErrorMessage(err),
    })
    return []
  }
}

/** Summarize events via OpenRouter (cheap model — gpt-4o-mini). Phase 4E: cache first.
 *  Phase 8A: BYOK symmetry — library-consistent resolver call (no userId: cron is systemic).
 *  Resolver short-circuits on null userId → returns envFallback as-is. */
async function summarizeWithAI(eventsSummary: string): Promise<string> {
  const openRouterKey = await resolveUserApiKey(null, 'openrouter', process.env.OPENROUTER_API_KEY)
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

  const messages = [{ role: 'user', content: prompt }]
  const cacheKey: CacheKey = {
    provider: 'openrouter',
    model:    'openai/gpt-4o-mini',
    messages,
    orgId:    'system',
  }

  // Phase 4E: serve from cache on hit (env-gated; null when disabled or miss).
  const cached = await lookupCache(cacheKey)
  if (cached) {
    logger.info('[digest] LLM cache hit — skipping OpenRouter call')
    return cached.response
  }

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
        messages,
        max_tokens: 600,
      }),
    })

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
        usage?:   { prompt_tokens?: number; completion_tokens?: number }
      }
      const content = data.choices?.[0]?.message?.content ?? eventsSummary

      // Phase 4E: fire-and-forget cache write (env-gated + error-swallowed inside).
      void writeCache(cacheKey, {
        response:     content,
        inputTokens:  data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
      }).catch(() => {
        // Defensive: writeCache already swallows internally.
      })

      return content
    }
  } catch (err) {
    logger.warn('[digest] OpenRouter summarize failed', {
      error: getErrorMessage(err),
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
      error: getErrorMessage(err),
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
      error: getErrorMessage(err),
    })
  }
}

/** Get D1 binding from CF Workers runtime env (same pattern as track.ts) */
function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
    if (env?.DB) return env.DB as D1Database

    const ctxSymbol = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol]
    if (ctx?.env?.DB) return ctx.env.DB as D1Database

    return null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireCron(req)
  if (auth instanceof Response) return auth

  logger.info('[digest] Starting weekly signals digest')

  // ── Existing path: PostHog + OpenRouter summarize + email + legacy Telegram ──
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

  // ── Phase 3 extension: D1 aggregates → GH Issue + Telegram TL;DR ────────────
  const db = getD1()
  let issueUrl: string | null = null
  let telegramOk = false

  if (!db) {
    logger.warn('[digest] D1 binding not available — skipping D1 aggregates')
  } else {
    const now = new Date()
    const weekLabel = buildIssueTitle(now)

    // Fetch all 5 aggregates in parallel (independent queries)
    const [signups, conversions, payments, byokProviders, agentDispatches] =
      await Promise.all([
        querySignupStats(db).catch(() => ({ count: 0 })),
        queryConversionsByTier(db).catch(() => []),
        queryPaymentStats(db).catch(() => ({ success_count: 0, failed_count: 0, total_usd: 0 })),
        queryTopByokProviders(db).catch(() => []),
        queryAgentDispatches(db).catch(() => []),
      ])

    const digestData: DigestData = {
      weekLabel,
      signups,
      conversions,
      payments,
      byokProviders,
      agentDispatches,
      posthogSummary: summary !== eventSummaryText ? summary : undefined,
    }

    const markdownBody = renderDigestMarkdown(digestData)
    const tldr = buildTldr(digestData)

    // GH Issue upsert + Telegram post — independent failure isolation
    const [ghResult, tgResult] = await Promise.allSettled([
      upsertGithubIssue({ title: weekLabel, body: markdownBody }),
      // Telegram sent after GH so we can include the issue URL — but we
      // still isolate failures via allSettled, passing null URL if GH fails
      Promise.resolve(null), // placeholder; real Telegram call below
    ])

    issueUrl =
      ghResult.status === 'fulfilled' && ghResult.value
        ? ghResult.value.url
        : null

    // Now post Telegram with the resolved issue URL
    const tgFinal = await postTelegramDigest({ tldr, issueUrl, weekLabel }).catch((err) => {
      logger.warn('[digest] Telegram post threw', {
        error: getErrorMessage(err),
      })
      return { ok: false, reason: 'thrown' }
    })
    telegramOk = tgFinal.ok

    void tgResult // satisfy no-unused-vars (placeholder settled above)

    logger.info('[digest] D1 digest complete', {
      issueUrl,
      issueAction: ghResult.status === 'fulfilled' ? ghResult.value?.action : 'failed',
      telegramOk,
    })
  }

  logger.info('[digest] Weekly signals digest sent')

  return Response.json({
    ok: true,
    eventCount: events.length,
    issue_url: issueUrl,
    telegram_ok: telegramOk,
    sources: ['posthog', 'd1'],
  })
}
