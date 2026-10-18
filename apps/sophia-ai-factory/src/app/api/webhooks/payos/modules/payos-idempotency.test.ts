import { describe, expect, it } from 'vitest';
import type { DbClient } from './payos-idempotency';

import { checkAndRecordPaymentIdempotency } from './payos-idempotency';

type StoredEvent = {
  event_id: string;
  event_type: string;
  payload: string;
  processed: number;
  created_at: string;
};

type MockStatement = {
  bind(...values: unknown[]): MockStatement;
  run<T>(): Promise<{ meta?: T }>;
  first<T>(): Promise<T | null>;
};

function makeDb(initial: StoredEvent[] = []) {
  const events = new Map(initial.map((event) => [event.event_id, event]));
  const db = {
    prepare(sql: string): MockStatement {
      let values: unknown[] = [];
      const statement: MockStatement = {
        bind(...args) {
          values = args;
          return statement;
        },
        async run<T>() {
          const eventId = String(values[0]);
          if (sql.includes('INSERT INTO payment_events')) {
            if (events.has(eventId)) return { meta: { changes: 0 } as T };
            events.set(eventId, {
              event_id: eventId,
              event_type: String(values[1]),
              payload: String(values[2]),
              processed: 0,
              created_at: String(values[3]),
            });
            return { meta: { changes: 1 } as T };
          }
          if (sql.startsWith('DELETE FROM payment_events')) {
            const existing = events.get(eventId);
            const matchesLock = existing?.processed === 0 && existing.created_at === values[1];
            if (matchesLock) events.delete(eventId);
            return { meta: { changes: matchesLock ? 1 : 0 } as T };
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
        async first<T>() {
          const event = events.get(String(values[0]));
          if (!event) return null;
          return { processed: event.processed, created_at: event.created_at } as T;
        },
      };
      return statement;
    },
  };
  return { db: db as unknown as DbClient, events };
}

describe('checkAndRecordPaymentIdempotency', () => {
  it('acquires a new event once and rejects concurrent duplicates while it is processing', async () => {
    const { db, events } = makeDb();

    const results = await Promise.all([
      checkAndRecordPaymentIdempotency({ db, paymentLinkId: 'link-1', sanitizedBody: '{}' }),
      checkAndRecordPaymentIdempotency({ db, paymentLinkId: 'link-1', sanitizedBody: '{}' }),
    ]);

    expect(results.filter((result) => result.shouldProcess)).toHaveLength(1);
    expect(results.find((result) => result.shouldProcess)).toMatchObject({ lockCreatedAt: expect.any(String) });
    const duplicate = results.find((result) => !result.shouldProcess);
    expect(duplicate?.response?.status).toBe(409);
    expect(events.size).toBe(1);
  });

  it('acknowledges a completed replay without processing it again', async () => {
    const { db } = makeDb([{
      event_id: 'payos_link-1',
      event_type: 'payos.payment_success',
      payload: '{}',
      processed: 1,
      created_at: new Date().toISOString(),
    }]);

    const result = await checkAndRecordPaymentIdempotency({ db, paymentLinkId: 'link-1', sanitizedBody: '{}' });

    expect(result.shouldProcess).toBe(false);
    if (result.shouldProcess) throw new Error('Completed replay should not be processed');
    expect(result.response?.status).toBe(200);
    await expect(result.response?.json()).resolves.toMatchObject({ duplicate: true });
  });

  it('reclaims an abandoned processing lock older than the stale threshold', async () => {
    const staleTime = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const { db, events } = makeDb([{
      event_id: 'payos_link-1',
      event_type: 'payos.payment_success',
      payload: 'old',
      processed: 0,
      created_at: staleTime,
    }]);

    const result = await checkAndRecordPaymentIdempotency({ db, paymentLinkId: 'link-1', sanitizedBody: 'retry' });

    expect(result.shouldProcess).toBe(true);
    expect(events.get('payos_link-1')?.payload).toBe('retry');
  });
});
