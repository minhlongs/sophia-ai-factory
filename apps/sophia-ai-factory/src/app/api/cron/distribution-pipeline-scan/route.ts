/**
 * Distribution Pipeline Scan Cron — /api/cron/distribution-pipeline-scan
 *
 * P3.C.8: Scans distribution_posts for pipeline health (failure rate, latency,
 * zero-post stall) per workspace+platform. Fires platform alerts (throttled via KV).
 *
 * Alert recipient = synthetic-monitor user (platform-level).
 * Throttle: 1 alert per workspace+platform per 6h (KV key: dist_pipeline_alert:<workspaceId>:<platform>).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Schedule: every 15 minutes (wrangler cron: slash-15 minutes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Safe } from '@/seed/db/client';
import { isAlertThrottled, markAlertThrottled } from '@/forest/alerts/alert-throttle';
import { triggerDistributionPipelineAlert } from '@/forest/alerts/distribution-pipeline-alert';
import {
  ALERT_THROTTLE_TTL,
  type DistPostRow,
  evaluateWorkspacePlatformMetrics,
  groupRowsByWorkspacePlatform,
} from './scan-metrics-helper';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'distribution-pipeline-scan';
const IDEMPOTENCY_WINDOW_MS = 14 * 60 * 1000; // 14m (cron runs every 15m)

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const checkInCtx = startCronCheckIn(CRON_NAME);
  const db = await getD1Safe();
  if (!db) {
    logger.error(`[cron/${CRON_NAME}] D1 binding unavailable`);
    failCronCheckIn(checkInCtx, CRON_NAME, new Error('D1 unavailable'));
    return NextResponse.json({ error: 'D1 binding unavailable' }, { status: 503 });
  }

  const skip = await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS);
  if (skip) {
    finishCronCheckIn(checkInCtx, CRON_NAME);
    return NextResponse.json({ status: 'skipped', reason: 'already-ran' });
  }

  let scanned = 0;
  let alerted = 0;
  let throttled = 0;
  try {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const stmt = db.prepare(
      `SELECT
         dp.workspace_id,
         dpost.platform,
         dpost.status,
         dpost.error,
         dpost.created_at,
         dpost.scheduled_at,
         dpost.posted_at
       FROM distribution_posts dpost
       JOIN distribution_plans dp ON dp.id = dpost.plan_id
       WHERE dpost.created_at >= ?`
    );
    const { results } = await stmt.bind(sevenDaysAgo).all<DistPostRow>();
    const rows = (results ?? []) as DistPostRow[];

    const byWorkspacePlatform = groupRowsByWorkspacePlatform(rows);
    scanned = byWorkspacePlatform.size;

    for (const [key, platformRows] of byWorkspacePlatform) {
      const [workspaceId, platform] = key.split(':');
      const metrics = evaluateWorkspacePlatformMetrics(platformRows, hourAgo, sevenDaysAgo);

      if (!metrics.shouldAlert) continue;

      const throttleKey = `dist_pipeline_alert:${workspaceId}:${platform}`;
      if (await isAlertThrottled(throttleKey)) {
        throttled += 1;
        continue;
      }

      const alertId = await triggerDistributionPipelineAlert({
        workspaceId,
        platform,
        failedCount: metrics.failedCount,
        totalCount: metrics.totalCount,
        failureRate: metrics.failureRate,
        baselineFailureRate: metrics.baselineFailureRate,
        p95LatencyMs: metrics.p95LatencyMs,
        baselineP95LatencyMs: metrics.baselineP95LatencyMs,
        failureTaxonomy: metrics.failureTaxonomy,
      });

      if (alertId) {
        await markAlertThrottled(throttleKey, alertId, ALERT_THROTTLE_TTL);
        alerted += 1;
      }
    }

    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(checkInCtx, CRON_NAME);
    return NextResponse.json({ status: 'ok', scanned, alerted, throttled });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`[cron/${CRON_NAME}] scan failed`, { error: error.message });
    await recordCronRun(db, CRON_NAME, 'failure', error.message);
    failCronCheckIn(checkInCtx, CRON_NAME, error);
    return NextResponse.json({ error: 'scan failed', scanned, alerted, throttled }, { status: 500 });
  }
}
