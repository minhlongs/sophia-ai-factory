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
import { logger } from '@/lib/utils/logger-utility';
import { toError, getErrorMessage } from '@/lib/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/lib/cron/run-tracker';
import { verifyCronAuth } from '@/lib/security/cron-auth';

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

/** Validate cron request is from an authorised source. */
function isAuthorised(req: NextRequest): boolean {
  const authError = verifyCronAuth(req);
  return authError === null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getD1();

  if (db && await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  try {
    const start = Date.now();
    const res = await fetch(HEALTH_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    const latency = Date.now() - start;
    const body = await res.json().catch(() => ({})) as { status?: string };

    if (!res.ok || body.status === 'unhealthy') {
      await alertAdmin(
        `⚠️ SOPHIA DOWN\nHTTP ${res.status}\nLatency: ${latency}ms\nStatus: ${body.status ?? 'unknown'}`,
      );
      if (db) await recordCronRun(db, CRON_NAME, 'failure', `HTTP ${res.status}`);
      return NextResponse.json({ healthy: false, status: res.status, latency });
    }

    if (latency > LATENCY_WARN_MS) {
      await alertAdmin(
        `🐌 SOPHIA SLOW\nLatency: ${latency}ms (threshold: ${LATENCY_WARN_MS}ms)`,
      );
    }

    logger.info(`[uptime-check] OK — ${latency}ms`);
    if (db) await recordCronRun(db, CRON_NAME, 'success');
    return NextResponse.json({ healthy: true, status: res.status, latency });
  } catch (e) {
    const msg = getErrorMessage(e);
    await alertAdmin(`🔴 SOPHIA UNREACHABLE\nError: ${msg}`);
    logger.error('[uptime-check] Health check failed', toError(e));
    if (db) await recordCronRun(db, CRON_NAME, 'failure', msg);
    return NextResponse.json({ healthy: false, error: msg });
  }
}
