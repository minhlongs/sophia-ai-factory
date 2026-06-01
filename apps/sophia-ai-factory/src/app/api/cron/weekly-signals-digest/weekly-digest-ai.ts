/**
 * PostHog fetch + OpenRouter AI summarize for weekly digest
 * @module api/cron/weekly-signals-digest/weekly-digest-ai
 */

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { lookupCache, writeCache, type CacheKey } from '@/land/llm/cache/llm-cache'
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'

const POSTHOG_QUERY_URL = 'https://us.i.posthog.com/api/projects/@current/events/'

interface PostHogEvent { event: string; count?: number }
interface PostHogEventsResponse { results?: PostHogEvent[] }

export async function fetchTopEvents(): Promise<PostHogEvent[]> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  if (!apiKey) { logger.warn('[digest] POSTHOG_PERSONAL_API_KEY not set'); return [] }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  try {
    const res = await fetch(`${POSTHOG_QUERY_URL}?after=${since}&limit=100`, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!res.ok) { logger.warn('[digest] PostHog events API non-OK', { status: res.status }); return [] }
    const data = (await res.json()) as PostHogEventsResponse
    return data.results ?? []
  } catch (err) {
    logger.warn('[digest] PostHog events fetch failed', { error: getErrorMessage(err) })
    return []
  }
}

export function buildEventSummaryText(events: PostHogEvent[]): string {
  if (events.length === 0) return 'No events recorded this week / Không có sự kiện nào tuần này'
  const eventCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.event] = (acc[e.event] ?? 0) + (e.count ?? 1)
    return acc
  }, {})
  return Object.entries(eventCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([name, count]) => `${name}: ${count}`)
    .join('\n')
}

export async function summarizeWithAI(eventsSummary: string): Promise<string> {
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
  const cacheKey: CacheKey = { provider: 'openrouter', model: 'openai/gpt-4o-mini', messages, orgId: 'system' }

  const cached = await lookupCache(cacheKey)
  if (cached) { logger.info('[digest] LLM cache hit — skipping OpenRouter call'); return cached.response }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openRouterKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://sophia.agencyos.network' },
      body: JSON.stringify({ model: 'openai/gpt-4o-mini', messages, max_tokens: 600 }),
    })
    if (res.ok) {
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } }
      const content = data.choices?.[0]?.message?.content ?? eventsSummary
      void writeCache(cacheKey, { response: content, inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens }).catch(() => {})
      return content
    }
  } catch (err) {
    logger.warn('[digest] OpenRouter summarize failed', { error: getErrorMessage(err) })
  }
  return eventsSummary
}
