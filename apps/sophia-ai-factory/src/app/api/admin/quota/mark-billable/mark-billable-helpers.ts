/**
 * Helpers for marking overage events as billable.
 * Layer: app/api/admin/quota/mark-billable
 * @module app/api/admin/quota/mark-billable/mark-billable-helpers
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { z } from 'zod';

const markBillableSchema = z.object({
  eventIds: z.array(z.string().uuid()),
  pricePerCredit: z.number().positive().optional(),
  reason: z.string().min(10),
});

interface OverageEventRow {
  id: string;
  exceeded_by: number;
  user_id: string;
  license_nonce: string;
}

export async function fetchOverageEvents(eventIds: string[]): Promise<OverageEventRow[]> {
  const db = createServerClient();
  const { data: rawEvents, error: fetchError } = await db
    .from('overage_events')
    .select('id, exceeded_by, user_id, license_nonce')
    .in('id', eventIds);
  const events = rawEvents as OverageEventRow[] | null;

  if (fetchError || !events || events.length === 0) {
    throw new Error('No valid events found');
  }
  return events;
}

export async function markEventsBillable(eventIds: string[]): Promise<void> {
  const db = createServerClient();
  const { error: updateError } = await (db
    .from('overage_events') as ReturnType<typeof db.from>)
    .update({
      billable: true,
      updated_at: new Date().toISOString(),
    })
    .in('id', eventIds);

  if (updateError) {
    logger.error('[Admin Quota API] Failed to mark events as billable', toError(updateError));
    throw new Error('Failed to mark events as billable');
  }
}

export async function logAuditEvent(params: {
  eventIds: string[];
  totalCredits: number;
  pricePerCredit: number | undefined;
  estimatedCost: number | null;
  reason: string;
  userId: string;
  licenseNonce: string | undefined;
  ipAddress: string | null;
}): Promise<void> {
  const db = createServerClient();
  await db
    .from('audit_logs')
    .insert({
      event_type: 'overage_marked_billable',
      user_id: params.userId,
      license_nonce: params.licenseNonce,
      metadata: {
        eventCount: params.eventIds.length,
        totalCredits: params.totalCredits,
        pricePerCredit: params.pricePerCredit,
        estimatedCost: params.estimatedCost,
        reason: params.reason,
        marked_by: 'admin-api',
      },
      ip_address: params.ipAddress,
    });
}

export { markBillableSchema };