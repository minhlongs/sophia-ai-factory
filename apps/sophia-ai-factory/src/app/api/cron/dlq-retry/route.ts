/**
 * POST /api/cron/dlq-retry
 *
 * DLQ retry cron: re-processes stale DLQ entries after manual/automated trigger.
 * Auth via CRON_SECRET (Bearer, x-cron-secret header, or ?token= query param).
 *
 * Batch size limited to BATCH_SIZE to keep request under Worker timeout.
 * Each entry is checked for max retries (MAX_RETRIES) — exhausted entries are
 * resolved as dead (resolved=1, resolved_at set).
 *
 * @module app/api/cron/dlq-retry
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/seed/security/cron-auth'
import { logger } from '@/seed/utils/logger-utility'
import { getDb } from '@/land/billing/nowpayments-ipn-db'
import { processNowPaymentsIpn } from '@/land/billing/nowpayments-ipn-handlers'
import { getStaleDlqEntries, resolveDlqEntry, type D1LikeClient } from '@/land/billing/nowpayments-ipn-dead-letter'

export const dynamic = 'force-dynamic'

const BATCH_SIZE = 10
const MAX_RETRIES = 3
const STALE_HOURS = 1 // entries older than 1 hour are "stale"

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const db = getDb()

  try {
    const staleEntries = await getStaleDlqEntries(
      db as unknown as D1LikeClient,
      STALE_HOURS,
      BATCH_SIZE,
    )

    if (staleEntries.length === 0) {
      logger.debug('[DLQ Retry] No stale entries found')
      return NextResponse.json({ ok: true, retried: 0, skipped: 0, dead: 0 })
    }

    let retried = 0
    let skipped = 0
    let dead = 0

    for (const entry of staleEntries) {
      // Exhausted: max retries reached → mark as dead
      if (entry.retry_count >= MAX_RETRIES) {
        try {
          await resolveDlqEntry(db as unknown as D1LikeClient, entry.event_id)
          dead++
          logger.warn('[DLQ Retry] Entry exhausted — marked resolved', {
            event_id: entry.event_id,
            retry_count: entry.retry_count,
          })
        } catch (e) {
          logger.error('[DLQ Retry] Failed to resolve exhausted entry', {
            event_id: entry.event_id,
            error: String(e),
          })
        }
        continue
      }

      // Re-process: parse stored payload and call processNowPaymentsIpn
      try {
        const payload = typeof entry.payload === 'string'
          ? JSON.parse(entry.payload as string)
          : entry.payload

        const result = await processNowPaymentsIpn(payload)
        if (result.success) {
          retried++
          logger.info('[DLQ Retry] Entry reprocessed successfully', {
            event_id: entry.event_id,
            result: result.message,
          })
        } else {
          skipped++
          logger.warn('[DLQ Retry] Entry reprocessed but returned failure', {
            event_id: entry.event_id,
            reason: result.message,
          })
        }
      } catch (e) {
        skipped++
        logger.error('[DLQ Retry] Reprocess failed', {
          event_id: entry.event_id,
          error: String(e),
        })
      }
    }

    return NextResponse.json({
      ok: true,
      retried,
      skipped,
      dead,
      total: staleEntries.length,
    })
  } catch (err) {
    logger.error('[DLQ Retry] Cron failed', { error: String(err) })
    return NextResponse.json(
      { ok: false, reason: 'DLQ retry cron error' },
      { status: 500 },
    )
  }
}
