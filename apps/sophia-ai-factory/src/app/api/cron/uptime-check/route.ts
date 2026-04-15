/**
 * Uptime Check Cron Endpoint
 *
 * Self-monitoring cron that pings the /api/health endpoint and alerts via
 * Telegram if the service is down or experiencing high latency.
 *
 * Schedule: Every 5 minutes (cron: star-slash-5 * * * *)
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

export const dynamic = 'force-dynamic';

const HEALTH_URL = process.env.PROD_URL
  ? `${process.env.PROD_URL}/api/health`
  : 'https://sophia.agencyos.network/api/health';

const ADMIN_TELEGRAM_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LATENCY_WARN_MS = 5000;

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
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured → open (CF-internal only)

  const token = req.nextUrl.searchParams.get('token');
  const cronHeader =
    req.headers.get('x-cron-secret') || req.headers.get('x-cf-cron');

  return token === secret || cronHeader === secret || cronHeader === 'true';
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ healthy: false, status: res.status, latency });
    }

    if (latency > LATENCY_WARN_MS) {
      await alertAdmin(
        `🐌 SOPHIA SLOW\nLatency: ${latency}ms (threshold: ${LATENCY_WARN_MS}ms)`,
      );
    }

    logger.info(`[uptime-check] OK — ${latency}ms`);
    return NextResponse.json({ healthy: true, status: res.status, latency });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await alertAdmin(`🔴 SOPHIA UNREACHABLE\nError: ${msg}`);
    logger.error('[uptime-check] Health check failed', e as Error);
    return NextResponse.json({ healthy: false, error: msg });
  }
}
