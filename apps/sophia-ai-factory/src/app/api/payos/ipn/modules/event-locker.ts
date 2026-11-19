import type { D1Database } from '@cloudflare/workers-types';

export type LockResult =
  | { status: 'won_lock'; lockCreatedAt: string }
  | { status: 'already_processed' }
  | { status: 'already_processing' }
  | { status: 'error'; message: string; statusCode: number };

export async function acquireEventLock(
  d1: D1Database, eventId: string, orderCode: string | number,
  success: boolean, amount: number, bodyJson: unknown,
): Promise<LockResult> {
  const lockCreatedAt = `${new Date().toISOString()}#${crypto.randomUUID()}`;
  try {
    const inserted = await d1.prepare(`INSERT INTO payos_events
      (event_id, order_code, status, amount, currency, payload, processed, created_at)
      VALUES (?, ?, ?, ?, 'VND', ?, 0, ?) ON CONFLICT(event_id) DO NOTHING`)
      .bind(eventId, String(orderCode), success ? 'PAID' : 'CANCELLED', amount, JSON.stringify(bodyJson), lockCreatedAt).run();
    if (inserted.meta.changes === 1) return { status: 'won_lock', lockCreatedAt };
    const existing = await d1.prepare('SELECT processed, created_at FROM payos_events WHERE event_id=?')
      .bind(eventId).first<{ processed: number; created_at: string }>();
    if (existing?.processed === 1) return { status: 'already_processed' };
    const timestamp = Date.parse((existing?.created_at ?? '').split('#')[0]);
    if (!existing || existing.processed !== 0 || !Number.isFinite(timestamp) || Date.now() - timestamp <= 300_000) {
      return { status: 'already_processing' };
    }
    const claimed = await d1.prepare(`UPDATE payos_events SET created_at=?, payload=?, status=?, amount=?
      WHERE event_id=? AND created_at=? AND processed=0`)
      .bind(lockCreatedAt, JSON.stringify(bodyJson), success ? 'PAID' : 'CANCELLED', amount, eventId, existing.created_at).run();
    return claimed.meta.changes === 1 ? { status: 'won_lock', lockCreatedAt } : { status: 'already_processing' };
  } catch {
    return { status: 'error', message: 'Internal processing error', statusCode: 500 };
  }
}

export async function releaseEventLock(d1: D1Database, eventId: string, lockCreatedAt: string): Promise<void> {
  await d1.prepare('DELETE FROM payos_events WHERE event_id=? AND created_at=? AND processed=0')
    .bind(eventId, lockCreatedAt).run();
}

export { cancelPayOsPayment as handleFailedPayment } from '@/app/api/webhooks/payos/modules/payos-payment-identity';
