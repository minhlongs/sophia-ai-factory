import { NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import type { D1Client } from '@/seed/db/client';
import { DEFAULT_STALE_THRESHOLD_MS } from '@/seed/utils/stale-lock-recovery';

export type DbClient = D1Client;

type PayOsEventRow = { processed: number | boolean; created_at: string };

const IN_PROGRESS_RESPONSE = () =>
  NextResponse.json({ received: true, status: 'processing' }, { status: 409 });

async function insertProcessingEvent(
  db: DbClient,
  eventId: string,
  payload: string,
  createdAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
       VALUES (?1, ?2, ?3, 0, ?4)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, 'payos.payment_success', payload, createdAt)
    .run<{ changes: number }>();
  return result.meta?.changes === 1;
}

async function readEvent(db: DbClient, eventId: string): Promise<PayOsEventRow | null> {
  return db
    .prepare('SELECT processed, created_at FROM payment_events WHERE event_id = ?1')
    .bind(eventId)
    .first<PayOsEventRow>();
}

export async function checkAndRecordPaymentIdempotency(params: {
  db: DbClient;
  paymentLinkId: number | string;
  sanitizedBody: string;
}): Promise<{ shouldProcess: true; lockCreatedAt: string } | { shouldProcess: false; response?: NextResponse }> {
  const { db, paymentLinkId, sanitizedBody } = params;
  const eventId = `payos_${paymentLinkId}`;

  try {
    const lockCreatedAt = new Date().toISOString();
    if (await insertProcessingEvent(db, eventId, sanitizedBody, lockCreatedAt)) {
      return { shouldProcess: true, lockCreatedAt };
    }

    const existing = await readEvent(db, eventId);
    if (!existing) {
      logger.warn('[PayOS Webhook] Payment event disappeared during idempotency check', { paymentLinkId });
      return {
        shouldProcess: false,
        response: NextResponse.json({ error: 'Cannot read payment event' }, { status: 422 }),
      };
    }

    if (existing.processed === 1 || existing.processed === true) {
      logger.info('[PayOS Webhook] Already processed', { paymentLinkId });
      return {
        shouldProcess: false,
        response: NextResponse.json({ received: true, duplicate: true }),
      };
    }

    const createdAtMs = new Date(existing.created_at).getTime();
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs <= DEFAULT_STALE_THRESHOLD_MS) {
      return { shouldProcess: false, response: IN_PROGRESS_RESPONSE() };
    }

    // Reclaim a crashed handler only if the same stale lock is still present.
    const deleted = await db
      .prepare('DELETE FROM payment_events WHERE event_id = ?1 AND processed = 0 AND created_at = ?2')
      .bind(eventId, existing.created_at)
      .run<{ changes: number }>();

    const replacementLockCreatedAt = new Date().toISOString();
    if (
      deleted.meta?.changes !== 1 ||
      !(await insertProcessingEvent(db, eventId, sanitizedBody, replacementLockCreatedAt))
    ) {
      const latest = await readEvent(db, eventId);
      if (latest?.processed === 1 || latest?.processed === true) {
        return {
          shouldProcess: false,
          response: NextResponse.json({ received: true, duplicate: true }),
        };
      }
      return { shouldProcess: false, response: IN_PROGRESS_RESPONSE() };
    }

    logger.warn('[PayOS Webhook] Reclaimed stale payment event lock', { paymentLinkId });
    return { shouldProcess: true, lockCreatedAt: replacementLockCreatedAt };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[PayOS Webhook] Failed to record payment event', { error: message });
    return {
      shouldProcess: false,
      response: NextResponse.json({ error: 'Cannot record payment event' }, { status: 422 }),
    };
  }
}
