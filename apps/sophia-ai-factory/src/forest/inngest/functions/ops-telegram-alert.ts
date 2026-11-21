/**
 * Telegram Ops Alert Handler — Inngest Function.
 *
 * Consumes agent.mission.failed events and system alerts,
 * formatting and dispatching bilingual operations alerts to the operator via Telegram.
 *
 * Layer: forest (reusable infrastructure orchestrator).
 *
 * @module forest/inngest/functions/ops-telegram-alert
 */

import { inngest } from '@/seed/inngest/client';
import { sendOpsAlert, type OpsAlertResult } from '@/seed/observability/ops-alert';
import type { SystemAlertPayload } from '@/seed/types/events';
import { extractActionableAlertPayload } from './ops-telegram-alert-formatter';

export type { OpsAlertResult } from '@/seed/observability/ops-alert';

/** Optional dispatch is isolated from mission delivery/accounting; no event destination overrides. */
export async function processOpsAlert(payload: SystemAlertPayload): Promise<OpsAlertResult> {
  return sendOpsAlert({
    severity: 'high',
    eventType: payload.failureKind === 'RATE_LIMIT' ? 'mission_rate_limit'
      : payload.failureKind === 'AUTH_FAILURE' ? 'mission_auth_failure' : 'mission_failed',
    incidentId: payload.missionId,
  });
}

export const opsTelegramAlert = inngest.createFunction(
  {
    id: 'ops-telegram-alert',
    retries: 0,
  },
  { event: 'agent.mission.failed' },
  async ({ event }) => {
    const raw = event.data as unknown as Record<string, unknown>;
    const payload = extractActionableAlertPayload(raw);
    if (!payload) {
      return { sent: false, reason: 'skipped_not_actionable' };
    }
    return processOpsAlert(payload);
  }
);
