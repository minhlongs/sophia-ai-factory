/**
 * Persistence and Inngest dispatch helpers for Growth Triad Execution Actions.
 * @module land/growth/actions/triad/triad-execution-helpers
 */

import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  AbandonedCartCallRecordSchema,
  type AbandonedCartCallRecord,
} from '@/seed/types/growth-triad-v2-types';

export { createAndDispatchParasiteArticle } from './parasite-article-dispatcher';

export async function createAndDispatchVoiceCartRecovery(
  userId: string,
  input: {
    cartSessionId: string;
    customerPhone: string;
    customerName?: string;
    cartValue: number;
    productNames: string[];
  },
): Promise<AbandonedCartCallRecord> {
  const callId = `vcall-${crypto.randomUUID().slice(0, 12)}`;
  const now = Math.floor(Date.now() / 1000);

  const record = AbandonedCartCallRecordSchema.parse({
    id: callId,
    userId,
    cartSessionId: input.cartSessionId,
    customerPhone: input.customerPhone,
    customerName: input.customerName,
    cartValue: input.cartValue,
    currency: 'VND',
    productNames: input.productNames,
    callStatus: 'IN_PROGRESS',
    callTimestamp: now,
    recordingDurationSeconds: 0,
    convertedGmv: 0,
    createdAt: now,
    updatedAt: now,
  });

  const db = createServerClient();
  await db.execute(
    `INSERT INTO abandoned_cart_voice_calls (
      id, user_id, cart_session_id, customer_phone, customer_name,
      cart_value, currency, product_names, call_status,
      recording_duration_seconds, converted_gmv, call_timestamp, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id, record.userId, record.cartSessionId, record.customerPhone,
      record.customerName ?? null, record.cartValue, record.currency,
      JSON.stringify(record.productNames), record.callStatus,
      record.recordingDurationSeconds, record.convertedGmv,
      record.callTimestamp, record.createdAt, record.updatedAt,
    ],
  );

  await inngest.send({
    name: 'voice.cart.recovery.triggered',
    data: {
      callId: record.id,
      userId,
      cartSessionId: record.cartSessionId,
      customerPhone: record.customerPhone,
      customerName: record.customerName,
      cartValue: record.cartValue,
      currency: record.currency,
      productNames: record.productNames,
    },
  });

  return record;
}
