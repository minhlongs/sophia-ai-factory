/**
 * Uptime Check Cron Endpoint
 *
 * Self-monitoring cron that pings the /api/health endpoint and alerts via
 * Telegram if the service is down or experiencing high latency.
 *
 * Schedule: Every 5 minutes (every-5-min)
 * See: wrangler.toml for cron configuration
 *
 * Features:
 * - Cron secret validation (token param or x-cron-secret header)
 * - 10s timeout on health check
 * - Telegram alert when down, unreachable, or latency > 5s
 * - Best-effort alert delivery (never throws)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { toError, getErrorMessage } from '@/seed/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { getD1 } from '@/seed/db/client';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import {
  CRON_NAME,
  IDEMPOTENCY_WINDOW_MS,
  HEALTH_URL,
  LATENCY_WARN_MS,
  alertAdmin,
  recordHealthStatusAndEvaluateIncident,
  recordUnreachableStatusAndIncident,
} from './uptime-check-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const db = await getD1();

  if (db && await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  try {
    const start = Date.now();
    const res = await fetch(HEALTH_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    const latency = Date.now() - start;
    const body = await res.json().catch(() => ({})) as { status?: string };

    const checkStatus = (!res.ok || body.status === 'unhealthy') ? 'down'
      : latency > LATENCY_WARN_MS ? 'degraded' : 'ok';

    if (db) {
      await recordHealthStatusAndEvaluateIncident(db, checkStatus, latency, res.status);
    }

    if (checkStatus === 'down') {
      await alertAdmin(
        `⚠️ SOPHIA DOWN\nHTTP ${res.status}\nLatency: ${latency}ms\nStatus: ${body.status ?? 'unknown'}`,
      );
      if (db) await recordCronRun(db, CRON_NAME, 'failure', `HTTP ${res.status}`);
      failCronCheckIn(cronCtx, CRON_NAME, new Error(`HTTP ${res.status} — service down`));
      return NextResponse.json({ healthy: false, status: res.status, latency });
    }

    if (checkStatus === 'degraded') {
      await alertAdmin(`🐌 SOPHIA SLOW\nLatency: ${latency}ms (threshold: ${LATENCY_WARN_MS}ms)`);
    }

    logger.info(`[uptime-check] OK — ${latency}ms`);
    if (db) await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ healthy: true, status: res.status, latency, checkStatus });
  } catch (e) {
    const msg = getErrorMessage(e);
    await alertAdmin(`🔴 SOPHIA UNREACHABLE\nError: ${msg}`);
    logger.error('[uptime-check] Health check failed', toError(e));
    if (db) {
      await recordUnreachableStatusAndIncident(db, msg);
      await recordCronRun(db, CRON_NAME, 'failure', msg);
    }
    failCronCheckIn(cronCtx, CRON_NAME, e);
    return NextResponse.json({ healthy: false, error: msg });
  }
}
