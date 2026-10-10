import { NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import type { createServerClient } from '@/seed/db/client';

export type DbClient = ReturnType<typeof createServerClient>;

export async function checkAndRecordPaymentIdempotency(params: {
  db: DbClient;
  paymentLinkId: number | string;
  sanitizedBody: string;
}): Promise<{ shouldProcess: boolean; response?: NextResponse }> {
  const { db, paymentLinkId, sanitizedBody } = params;

  try {
    await db.from('payment_events').insert({
      event_id: `payos_${paymentLinkId}`,
      event_type: 'payos.payment_success',
      payload: sanitizedBody,
      processed: 0,
      created_at: new Date().toISOString(),
    });
    return { shouldProcess: true };
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
    const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as { message?: string }).message) : '';

    if (code === '23505' || msg.includes('UNIQUE constraint')) {
      const { data: existing } = await db
        .from('payment_events')
        .select('processed')
        .eq('event_id', `payos_${paymentLinkId}`)
        .single();

      if (existing?.processed) {
        logger.info('[PayOS Webhook] Already processed (race recovered)', { paymentLinkId });
        return {
          shouldProcess: false,
          response: NextResponse.json({ received: true, duplicate: true }),
        };
      }
      return { shouldProcess: true };
    }

    logger.warn('[PayOS Webhook] Failed to record event', { error: msg });
    return {
      shouldProcess: false,
      response: NextResponse.json({ error: 'Cannot record payment event' }, { status: 422 }),
    };
  }
}
