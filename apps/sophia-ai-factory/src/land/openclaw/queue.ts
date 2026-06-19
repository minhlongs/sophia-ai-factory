/**
 * queue.ts — Inngest queue wrapper with audit logging
 * Phase 12: OpenClaw Orchestrator primitive
 *
 * Wraps inngest.send() with:
 *  - Priority metadata
 *  - Retry metadata
 *  - Tenant scoping
 *  - Audit log on enqueue
 */

import { inngest } from '@/tree/inngest/client';
import { audit } from '@/tree/agent-fleet/audit';

export interface EnqueueOptions {
  priority?: 'low' | 'normal' | 'high';
  retry?: number;
  tenantId: string;
  actor?: string;
  /** Optional idempotency key */
  idempotencyKey?: string;
}

export interface EnqueueResult {
  eventId: string;
  eventName: string;
  tenantId: string;
  priority: string;
}

/**
 * Enqueue an event into Inngest with audit trail.
 *
 * @param eventName  Inngest event name
 * @param payload    Event data
 * @param opts       Queue options including tenantId
 */
export async function enqueue(
  eventName: string,
  payload: Record<string, unknown>,
  opts: EnqueueOptions,
): Promise<EnqueueResult> {
  const { tenantId, actor = 'system', priority = 'normal', retry, idempotencyKey } = opts;

  const sendPayload: Record<string, unknown> = {
    name: eventName,
    data: {
      ...payload,
      tenantId,
      _priority: priority,
      _retry: retry,
    },
  };

  if (idempotencyKey) {
    sendPayload['id'] = idempotencyKey;
  }

  const result = await inngest.send(sendPayload as Parameters<typeof inngest.send>[0]);

  await audit({
    tenantId,
    actor,
    action: 'queue.enqueue',
    resource: eventName,
    metadata: { priority, retry, idempotencyKey },
  });

  return {
    eventId: String((result as Record<string, unknown>).id ?? eventName),
    eventName,
    tenantId,
    priority,
  };
}
