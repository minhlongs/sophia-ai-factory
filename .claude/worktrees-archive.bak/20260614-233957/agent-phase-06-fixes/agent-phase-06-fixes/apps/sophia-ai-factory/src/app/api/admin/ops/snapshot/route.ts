/**
 * GET /api/admin/ops/snapshot
 *
 * Admin-only: real-time ops health snapshot for the go-live dashboard.
 * Returns deployment version, cron runs, queue counts, recent failures,
 * reconciliation stats, HeyGen health, and circuit breaker state.
 *
 * @module app/api/admin/ops/snapshot/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { getD1Raw } from '@/seed/db/client'
import { getBuildMetadata } from '@/seed/health/build-metadata'
import { isHeyGenHealthy } from '@/seed/health/heygen-health-check'
import { getCircuitState } from '@/land/fulfillment/circuit-breaker'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'

export const dynamic = 'force-dynamic'

interface CronRunRow {
  cron_name: string
  last_run_at: number
  last_status: string
  last_error: string | null
  run_count: number
}

interface QueueRow {
  status: string
  cnt: number
}

interface FailedVideoRow {
  id: string
  purchase_id: string | null
  last_error: string | null
  created_at: number
}

interface ReconcileRow {
  paid: number
  delivered: number
}

interface FailedCountRow {
  cnt: number
}

export interface OpsSnapshotResponse {
  version: {
    sha: string
    deployedAt: string
    opennextVersion: string
  }
  cronRuns: CronRunRow[]
  activeQueue: {
    queued: number
    processing: number
    total: number
  }
  failedPermanent24h: {
    count: number
    samples: FailedVideoRow[]
  }
  reconcile24h: {
    paid: number
    delivered: number
    mismatch: number
    failedPermanent: number
  }
  heygenHealth: {
    healthy: boolean
    providerStatus: string
    checkedAt: string
  }
  circuitBreaker: {
    state: string
    openedAt?: number
    recentFailures: number
    recentSuccesses: number
  }
  outageNotifications: {
    lastTriggeredAt: number | null
    customersNotified24h: number
  }
  generatedAt: string
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  const generatedAt = new Date().toISOString()
  const { sha, deployedAt } = getBuildMetadata()
  const opennextVersion = process.env.OPENNEXT_VERSION ?? 'unknown'

  let db: D1Database
  try {
    db = await getD1Raw()
  } catch (err) {
    logger.error('[OpsSnapshot] D1 unavailable', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const since24h = nowSec - 24 * 3600

  try {
    // 1. Cron runs (last 20)
    const cronResult = await db
      .prepare(
        `SELECT cron_name, last_run_at, last_status, last_error, run_count
         FROM cron_run_log
         ORDER BY last_run_at DESC
         LIMIT 20`,
      )
      .all<CronRunRow>()
    const cronRuns = cronResult.results ?? []

    // 2. Active queue counts
    const queueResult = await db
      .prepare(
        `SELECT status, COUNT(*) AS cnt
         FROM videos
         WHERE status IN ('queued', 'processing')
         GROUP BY status`,
      )
      .all<QueueRow>()
    const queueMap: Record<string, number> = {}
    for (const row of queueResult.results ?? []) {
      queueMap[row.status] = row.cnt
    }
    const activeQueue = {
      queued: queueMap['queued'] ?? 0,
      processing: queueMap['processing'] ?? 0,
      total: (queueMap['queued'] ?? 0) + (queueMap['processing'] ?? 0),
    }

    // 3. Failed permanent videos in last 24h (up to 10 samples)
    const failedResult = await db
      .prepare(
        `SELECT id, purchase_id, last_error, created_at
         FROM videos
         WHERE status = 'failed_permanent'
           AND created_at >= ?1
         ORDER BY created_at DESC
         LIMIT 10`,
      )
      .bind(since24h)
      .all<FailedVideoRow>()
    const failedSamples = failedResult.results ?? []

    const failedCountRow = await db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM videos
         WHERE status = 'failed_permanent' AND created_at >= ?1`,
      )
      .bind(since24h)
      .first<FailedCountRow>()
    const failedPermanent24h = {
      count: failedCountRow?.cnt ?? 0,
      samples: failedSamples,
    }

    // 4. Reconcile 24h — paid vs delivered (excluding synthetic)
    const reconcileResult = await db
      .prepare(
        `SELECT
           COUNT(*) AS paid,
           SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END) AS delivered
         FROM user_purchases up
         LEFT JOIN videos v ON v.purchase_id = up.id AND v.status = 'completed'
         WHERE up.kind = 'one_time'
           AND up.status = 'paid'
           AND up.paid_at >= ?1
           AND up.payment_id NOT LIKE 'SYNTHETIC_%'
           AND up.payment_id NOT LIKE 'ADMIN_SYNTHETIC_%'`,
      )
      .bind(since24h)
      .first<ReconcileRow>()

    const paid24 = reconcileResult?.paid ?? 0
    const delivered24 = reconcileResult?.delivered ?? 0
    const reconcile24h = {
      paid: paid24,
      delivered: delivered24,
      mismatch: paid24 - delivered24,
      failedPermanent: failedPermanent24h.count,
    }

    // 5. HeyGen health (non-blocking)
    let heygenHealth: OpsSnapshotResponse['heygenHealth']
    try {
      const healthy = await Promise.race<boolean>([
        isHeyGenHealthy(),
        new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ])
      heygenHealth = {
        healthy,
        providerStatus: healthy ? 'ok' : 'down',
        checkedAt: new Date().toISOString(),
      }
    } catch {
      heygenHealth = {
        healthy: false,
        providerStatus: 'unknown',
        checkedAt: new Date().toISOString(),
      }
    }

    // 6. Circuit breaker state
    const cbStatus = await getCircuitState()
    const circuitBreaker = {
      state: cbStatus.state,
      openedAt: cbStatus.openedAt,
      recentFailures: cbStatus.recentFailures,
      recentSuccesses: cbStatus.recentSuccesses,
    }

    // 7. Outage notifications — last trigger + count in last 24h
    interface OutageEventRow {
      cnt: number
      latest_at: string | null
    }
    const outageResult = await db
      .prepare(
        `SELECT COUNT(*) AS cnt,
                MAX(json_extract(event_data, '$.opened_at')) AS latest_at
         FROM billing_events
         WHERE event_type = 'outage_compensation'
           AND created_at >= ?1`,
      )
      .bind(since24h)
      .first<OutageEventRow>()

    const outageNotifications = {
      lastTriggeredAt: outageResult?.latest_at ? Number(outageResult.latest_at) : null,
      customersNotified24h: outageResult?.cnt ?? 0,
    }

    const snapshot: OpsSnapshotResponse = {
      version: { sha, deployedAt, opennextVersion },
      cronRuns,
      activeQueue,
      failedPermanent24h,
      reconcile24h,
      heygenHealth,
      circuitBreaker,
      outageNotifications,
      generatedAt,
    }

    return NextResponse.json(snapshot)
  } catch (err) {
    logger.error('[OpsSnapshot] Query failed', err instanceof Error ? err : undefined, {
      adminUserId: auth.user.id,
    })
    return NextResponse.json(
      { error: 'Snapshot query failed', details: getErrorMessage(err) },
      { status: 500 },
    )
  }
}
