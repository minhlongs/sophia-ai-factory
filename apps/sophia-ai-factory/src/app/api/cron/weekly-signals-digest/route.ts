/**
 * GET /api/cron/weekly-signals-digest — Monday 06:00 UTC weekly signals digest
 * RED-TEAM #3: CRON_SECRET bearer only (no session — server-to-server)
 * Flow: PostHog Query API → OpenRouter summarize → Resend email + Telegram
 *       + D1 aggregates → GH Issue upsert + Telegram TL;DR (Phase 3 extension)
 */

import { NextRequest } from 'next/server'
import { requireCron } from '@/lib/signals/auth-helper'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
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
import { fetchTopEvents, buildEventSummaryText, summarizeWithAI } from './weekly-digest-ai'
import { sendEmail, sendTelegram, getD1 } from './weekly-digest-delivery'
import { recordCronRun, wasRecentlyRun } from '@/lib/cron/run-tracker'

const CRON_NAME = 'weekly-signals-digest'
/** Weekly — skip if ran within last 3 days */
const IDEMPOTENCY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const auth = await requireCron(req)
  if (auth instanceof Response) return auth

  const db = getD1()

  if (db && await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    return Response.json({ ok: true, skipped: 'recent_run' })
  }

  logger.info('[digest] Starting weekly signals digest')

  try {
    const events = await fetchTopEvents()
    const eventSummaryText = buildEventSummaryText(events)
    const summary = await summarizeWithAI(eventSummaryText)

    await Promise.allSettled([sendEmail(summary), sendTelegram(summary)])

    let issueUrl: string | null = null
    let telegramOk = false

    if (!db) {
      logger.warn('[digest] D1 binding not available — skipping D1 aggregates')
    } else {
      const now = new Date()
      const weekLabel = buildIssueTitle(now)

      const [signups, conversions, payments, byokProviders, agentDispatches] = await Promise.all([
        querySignupStats(db).catch(() => ({ count: 0 })),
        queryConversionsByTier(db).catch(() => []),
        queryPaymentStats(db).catch(() => ({ success_count: 0, failed_count: 0, total_usd: 0 })),
        queryTopByokProviders(db).catch(() => []),
        queryAgentDispatches(db).catch(() => []),
      ])

      const digestData: DigestData = {
        weekLabel, signups, conversions, payments, byokProviders, agentDispatches,
        posthogSummary: summary !== eventSummaryText ? summary : undefined,
      }

      const markdownBody = renderDigestMarkdown(digestData)
      const tldr = buildTldr(digestData)

      const [ghResult] = await Promise.allSettled([
        upsertGithubIssue({ title: weekLabel, body: markdownBody }),
        Promise.resolve(null),
      ])

      issueUrl = ghResult.status === 'fulfilled' && ghResult.value ? ghResult.value.url : null

      const tgFinal = await postTelegramDigest({ tldr, issueUrl, weekLabel }).catch((err) => {
        logger.warn('[digest] Telegram post threw', { error: getErrorMessage(err) })
        return { ok: false, reason: 'thrown' }
      })
      telegramOk = tgFinal.ok

      logger.info('[digest] D1 digest complete', { issueUrl, issueAction: ghResult.status === 'fulfilled' ? ghResult.value?.action : 'failed', telegramOk })
    }

    logger.info('[digest] Weekly signals digest sent')
    if (db) await recordCronRun(db, CRON_NAME, 'success')
    return Response.json({ ok: true, eventCount: events.length, issue_url: issueUrl, telegram_ok: telegramOk, sources: ['posthog', 'd1'] })
  } catch (err) {
    const msg = getErrorMessage(err)
    if (db) await recordCronRun(db, CRON_NAME, 'failure', msg)
    throw err
  }
}
