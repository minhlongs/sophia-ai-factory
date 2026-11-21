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
import { sendOpsAlert } from '@/seed/observability/ops-alert';
import { evaluateIncidentAction, type CheckStatus } from '@/land/status/incident-state-machine';

export const CRON_NAME = 'uptime-check';
/** Every 5 min — skip if ran within last 2 minutes */
export const IDEMPOTENCY_WINDOW_MS = 2 * 60 * 1000;

export const HEALTH_URL = process.env.PROD_URL
  ? `${process.env.PROD_URL}/api/health`
  : 'https://sophia.agencyos.network/api/health';

export const LATENCY_WARN_MS = 5000;

/** Only an allowlisted incident label is sent; raw health diagnostics stay in-platform. */
export async function alertAdmin(message: string) {
  return sendOpsAlert({ severity: 'high',
    eventType: message.includes('INCIDENT RESOLVED') ? 'uptime_recovered' : 'uptime_incident' });
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
