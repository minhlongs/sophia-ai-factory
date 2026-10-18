/**
 * Uptime Check Cron Helpers
 *
 * Telegram admin alerting (protected by circuit breaker) and incident state
 * evaluation for the /api/cron/uptime-check route.
 *
 * @module app/api/cron/uptime-check/uptime-check-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  recordCheck,
  getRecentChecks,
  getActiveIncident,
  openIncident,
  closeIncident,
} from '@/land/status/status-store';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import { evaluateIncidentAction, type CheckStatus } from '@/land/status/incident-state-machine';

export const CRON_NAME = 'uptime-check';
/** Every 5 min — skip if ran within last 2 minutes */
export const IDEMPOTENCY_WINDOW_MS = 2 * 60 * 1000;

export const HEALTH_URL = process.env.PROD_URL
  ? `${process.env.PROD_URL}/api/health`
  : 'https://sophia.agencyos.network/api/health';

const ADMIN_TELEGRAM_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const LATENCY_WARN_MS = 5000;
const SERVICE_NAME = 'telegram-uptime-alert';

/** Send a Telegram message to the admin chat. Best-effort — never throws unless circuit is open. */
export async function alertAdmin(message: string): Promise<void> {
  if (!ADMIN_TELEGRAM_CHAT_ID || !TELEGRAM_BOT_TOKEN) {
    logger.warn('[uptime-check] No admin Telegram config — alert skipped');
    return;
  }
  try {
    if (!shouldAllowRequest(SERVICE_NAME)) {
      throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
    }
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    if (res.ok) {
      recordSuccess(SERVICE_NAME);
    } else {
      const kind = classifyHttpStatus(res.status);
      recordFailure(SERVICE_NAME, kind);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('[circuit-breaker]')) throw err;
    const kind = classifyError(err);
    recordFailure(SERVICE_NAME, kind);
  }
}

export async function recordHealthStatusAndEvaluateIncident(
  db: D1Database,
  checkStatus: CheckStatus,
  latency: number,
  httpStatus: number,
): Promise<void> {
  try {
    await recordCheck(db, { ts: Math.floor(Date.now() / 1000), status: checkStatus, latencyMs: latency });
    const recentChecks = await getRecentChecks(db);
    const activeIncident = await getActiveIncident(db);
    const typedChecks = recentChecks.map((c) => ({ status: c.status as CheckStatus }));
    const action = evaluateIncidentAction(typedChecks, activeIncident?.id ?? null);
    if (action === 'open') {
      await openIncident(db, 'Service disruption detected', 'minor');
      await alertAdmin(`⚠️ INCIDENT OPENED\nSophia appears to be down.\nHTTP ${httpStatus}`);
    } else if (action === 'close' && activeIncident) {
      await closeIncident(db, activeIncident.id);
      await alertAdmin('✅ INCIDENT RESOLVED\nSophia is back to normal.');
    }
  } catch (statusErr) {
    logger.warn('[uptime-check] Status record failed (non-fatal)', { error: getErrorMessage(statusErr) });
  }
}

export async function recordUnreachableStatusAndIncident(
  db: D1Database,
  errorMessage: string,
): Promise<void> {
  try {
    await recordCheck(db, {
      ts: Math.floor(Date.now() / 1000),
      status: 'down',
      latencyMs: null,
      error: errorMessage,
    });
    const recentChecks = await getRecentChecks(db);
    const activeIncident = await getActiveIncident(db);
    const typedChecks = recentChecks.map((c) => ({ status: c.status as CheckStatus }));
    const action = evaluateIncidentAction(typedChecks, activeIncident?.id ?? null);
    if (action === 'open') await openIncident(db, 'Service unreachable', 'major');
  } catch {
    /* non-fatal */
  }
}
