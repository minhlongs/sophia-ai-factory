/**
 * schedule.ts — Inngest cron wrapper for scheduled agent tasks
 * Phase 12: OpenClaw Orchestrator primitive
 *
 * Thin wrapper around inngest.send() that:
 *  1. Sends the scheduled event to Inngest
 *  2. Writes an audit row for the schedule operation
 */

import { inngest } from '@/lib/inngest/client';
import { audit } from './audit';

export interface ScheduleOptions {
  tenantId: string;
  actor?: string;
  /** Optional: idempotency key to prevent duplicate schedules */
  idempotencyKey?: string;
}

export interface ScheduledTaskResult {
  eventId: string;
  cron: string;
  tenantId: string;
}

/**
 * Schedule an agent task to run on a cron expression.
 * Uses Inngest's scheduled functions — the cron must match a registered
 * Inngest function. This primitive sends the trigger event.
 *
 * @param eventName  Inngest event name (e.g. 'affiliate.sync.requested')
 * @param payload    Event data payload
 * @param opts       Schedule options including tenantId
 */
export async function scheduleAgent(
  eventName: string,
  payload: Record<string, unknown>,
  opts: ScheduleOptions,
): Promise<ScheduledTaskResult> {
  const { tenantId, actor = 'system', idempotencyKey } = opts;

  const sendPayload: Record<string, unknown> = {
    name: eventName,
    data: { ...payload, tenantId },
  };
  if (idempotencyKey) {
    sendPayload['id'] = idempotencyKey;
  }

  const result = await inngest.send(sendPayload as Parameters<typeof inngest.send>[0]);

  await audit({
    tenantId,
    actor,
    action: 'schedule.agent',
    resource: eventName,
    metadata: { payload, idempotencyKey },
  });

  return {
    eventId: String((result as Record<string, unknown>).id ?? eventName),
    cron: eventName,
    tenantId,
  };
}
