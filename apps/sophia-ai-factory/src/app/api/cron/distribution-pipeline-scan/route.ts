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

export const dynamic = 'force-dynamic';

const CRON_NAME = 'distribution-pipeline-scan';
const IDEMPOTENCY_WINDOW_MS = 14 * 60 * 1000; // 14m (cron runs every 15m)
const ALERT_THROTTLE_TTL = 6 * 60 * 60; // 6 hours in KV seconds
const FAILURE_RATE_THRESHOLD = 0.15; // 15%
const LATENCY_MULTIPLIER = 2; // 2x baseline p95
const ZERO_POST_RATIO = 0.2; // 20% of baseline
const MIN_BASELINE_HOURLY = 5; // minimum baseline posts/hour for zero-post check

interface DistPostRow {
  workspace_id: string;
  platform: string;
  status: string;
  error: string | null;
  created_at: number;
  scheduled_at: number | null;
  posted_at: number | null;
}

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

    // Query last 7 days of distribution_posts joined with distribution_plans for workspace_id
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

    // Group by workspace+platform
    const byWorkspacePlatform = new Map<string, DistPostRow[]>();
    for (const row of rows) {
      const key = `${row.workspace_id}:${row.platform}`;
      if (!byWorkspacePlatform.has(key)) {
        byWorkspacePlatform.set(key, []);
      }
      byWorkspacePlatform.get(key)!.push(row);
    }

    scanned = byWorkspacePlatform.size;

    for (const [key, platformRows] of byWorkspacePlatform) {
      const [workspaceId, platform] = key.split(':');

      // Current hour (last 60 min)
      const currentHourRows = platformRows.filter(r => r.created_at >= hourAgo);
      const totalCount = currentHourRows.length;
      const failedCount = currentHourRows.filter(r => r.status === 'failed').length;

      // 7-day hourly baseline (exclude current hour)
      const baselineRows = platformRows.filter(r => r.created_at >= sevenDaysAgo && r.created_at < hourAgo);
      const baselineHours = 7 * 24 - 1; // 167 hours
      const baselineFailedHourly = baselineRows.filter(r => r.status === 'failed').length / baselineHours;
      const baselineTotalHourly = baselineRows.length / baselineHours;

      // Failure rate check
      const failureRate = totalCount > 0 ? failedCount / totalCount : 0;
      const baselineFailureRate = baselineTotalHourly > 0 ? baselineFailedHourly / baselineTotalHourly : 0;

      // Latency p95 check (only for published posts with both timestamps)
      const publishedCurrent = currentHourRows.filter(r => r.status === 'published' && r.posted_at && r.scheduled_at);
      const latencies = publishedCurrent.map(r => r.posted_at! - r.scheduled_at!).sort((a, b) => a - b);
      const p95LatencyMs = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;

      const publishedBaseline = baselineRows.filter(r => r.status === 'published' && r.posted_at && r.scheduled_at);
      const baselineLatencies = publishedBaseline.map(r => r.posted_at! - r.scheduled_at!).sort((a, b) => a - b);
      const baselineP95LatencyMs = baselineLatencies.length > 0 ? baselineLatencies[Math.floor(baselineLatencies.length * 0.95)] : 0;

      // Failure taxonomy
      const failureTaxonomy: Record<string, number> = {};
      for (const row of currentHourRows.filter(r => r.status === 'failed' && r.error)) {
        failureTaxonomy[row.error!] = (failureTaxonomy[row.error!] || 0) + 1;
      }

      // Zero-post stall check
      const zeroPostStall = totalCount < baselineTotalHourly * ZERO_POST_RATIO && baselineTotalHourly > MIN_BASELINE_HOURLY;

      // Check thresholds
      const shouldAlert =
        (totalCount > 0 && failureRate > FAILURE_RATE_THRESHOLD && failureRate > baselineFailureRate * 2) ||
        (p95LatencyMs > 0 && baselineP95LatencyMs > 0 && p95LatencyMs > baselineP95LatencyMs * LATENCY_MULTIPLIER) ||
        zeroPostStall;

      if (!shouldAlert) continue;

      const throttleKey = `dist_pipeline_alert:${workspaceId}:${platform}`;
      if (await isAlertThrottled(throttleKey)) {
        throttled += 1;
        continue;
      }

      const alertId = await triggerDistributionPipelineAlert({
        workspaceId,
        platform,
        failedCount,
        totalCount,
        failureRate,
        baselineFailureRate,
        p95LatencyMs,
        baselineP95LatencyMs,
        failureTaxonomy,
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