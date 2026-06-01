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
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCheck, getRecentChecks, getActiveIncident, openIncident, closeIncident } from '@/land/status/status-store';
import { evaluateIncidentAction } from '@/land/status/incident-state-machine';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'uptime-check';
/** Every 5 min — skip if ran within last 2 minutes */
const IDEMPOTENCY_WINDOW_MS = 2 * 60 * 1000;

const HEALTH_URL = process.env.PROD_URL
  ? `${process.env.PROD_URL}/api/health`
  : 'https://sophia.agencyos.network/api/health';

const ADMIN_TELEGRAM_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LATENCY_WARN_MS = 5000;

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch {
    return null;
  }
}

/** Send a Telegram message to the admin chat. Best-effort — never throws. */
async function alertAdmin(message: string): Promise<void> {
  if (!ADMIN_TELEGRAM_CHAT_ID || !TELEGRAM_BOT_TOKEN) {
    logger.warn('[uptime-check] No admin Telegram config — alert skipped');
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch {
    // best effort — never propagate alert failures
  }
}

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const db = getD1();

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
      try {
        await recordCheck(db, { ts: Math.floor(Date.now() / 1000), status: checkStatus, latencyMs: latency });
        const recentChecks = await getRecentChecks(db);
        const activeIncident = await getActiveIncident(db);
        const typedChecks = recentChecks.map(c => ({ status: c.status as import('@/land/status/incident-state-machine').CheckStatus }));
        const action = evaluateIncidentAction(typedChecks, activeIncident?.id ?? null);
        if (action === 'open') {
          await openIncident(db, 'Service disruption detected', 'minor');
          await alertAdmin(`⚠️ INCIDENT OPENED\nSophia appears to be down.\nHTTP ${res.status}`);
        } else if (action === 'close' && activeIncident) {
          await closeIncident(db, activeIncident.id);
          await alertAdmin('✅ INCIDENT RESOLVED\nSophia is back to normal.');
        }
      } catch (statusErr) {
        logger.warn('[uptime-check] Status record failed (non-fatal)', { error: getErrorMessage(statusErr) });
      }
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
      try {
        await recordCheck(db, { ts: Math.floor(Date.now() / 1000), status: 'down', latencyMs: null, error: msg });
        const recentChecks = await getRecentChecks(db);
        const activeIncident = await getActiveIncident(db);
        const typedChecks2 = recentChecks.map(c => ({ status: c.status as import('@/land/status/incident-state-machine').CheckStatus }));
        const action = evaluateIncidentAction(typedChecks2, activeIncident?.id ?? null);
        if (action === 'open') await openIncident(db, 'Service unreachable', 'major');
      } catch { /* non-fatal */ }
      await recordCronRun(db, CRON_NAME, 'failure', msg);
    }
    failCronCheckIn(cronCtx, CRON_NAME, e);
    return NextResponse.json({ healthy: false, error: msg });
  }
}
