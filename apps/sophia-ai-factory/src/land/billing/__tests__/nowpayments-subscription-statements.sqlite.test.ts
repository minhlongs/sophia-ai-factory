// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Tier } from '@/seed/types';
import type { NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers';
import { buildSubscriptionUpdateStatements } from '../nowpayments-subscription-statements';

type BoundStatement = { sql: string; values: Array<string | number | null> };

let sqlite: DatabaseSync & { close(): void };
const prepared: BoundStatement[] = [];

const d1 = {
  prepare(sql: string) {
    return {
      bind(...values: Array<string | number | null>) {
        prepared.push({ sql, values });
        return {} as D1PreparedStatement;
      },
    } as unknown as D1PreparedStatement;
  },
} as unknown as D1Database;

function buildOrderCompletion(orderId: string, paymentId: string): BoundStatement {
  prepared.length = 0;
  const payload: NowPaymentsIpnPayload = {
    payment_id: paymentId,
    payment_status: 'finished',
    price_amount: 199,
    price_currency: 'usd',
    order_id: orderId,
  };
  buildSubscriptionUpdateStatements(
    null,
    false,
    'org-1',
    'BASIC' as Tier,
    '2026-11-19T00:00:00.000Z',
    '2026-10-19T00:00:00.000Z',
    payload,
    d1,
    'monthly',
    null,
  );
  const statement = prepared.find(({ sql }) => sql.includes('UPDATE pending_orders'));
  if (!statement) throw new Error('pending order completion statement was not built');
  return statement;
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:') as DatabaseSync & { close(): void };
  sqlite.exec(`CREATE TABLE pending_orders (
    order_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    payment_id TEXT,
    completed_at TEXT
  );`);
});

afterEach(() => {
  sqlite.close();
  prepared.length = 0;
});

describe('NOWPayments subscription pending-order completion SQL', () => {
  it('records D1 time and preserves the first successful completion time on replay', () => {
    sqlite.prepare('INSERT INTO pending_orders(order_id, status) VALUES (?, ?)').run('order-1', 'pending');

    const firstStatement = buildOrderCompletion('order-1', 'payment-1');
    sqlite.prepare(firstStatement.sql).run(...firstStatement.values);
    const first = sqlite.prepare('SELECT completed_at FROM pending_orders WHERE order_id = ?').get('order-1') as { completed_at: string };

    const replayStatement = buildOrderCompletion('order-1', 'payment-1');
    sqlite.prepare(replayStatement.sql).run(...replayStatement.values);
    const replayed = sqlite.prepare('SELECT completed_at FROM pending_orders WHERE order_id = ?').get('order-1') as { completed_at: string };

    expect(first.completed_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(replayed.completed_at).toBe(first.completed_at);
  });

  it('replaces a failure timestamp with the later confirmed payment time', () => {
    sqlite.prepare('INSERT INTO pending_orders(order_id, status, completed_at) VALUES (?, ?, ?)')
      .run('order-2', 'failed', '2000-01-01T00:00:00.000Z');

    const statement = buildOrderCompletion('order-2', 'payment-2');
    sqlite.prepare(statement.sql).run(...statement.values);
    const row = sqlite.prepare('SELECT status, payment_id, completed_at FROM pending_orders WHERE order_id = ?')
      .get('order-2') as { status: string; payment_id: string; completed_at: string };

    expect(row).toMatchObject({ status: 'completed', payment_id: 'payment-2' });
    expect(row.completed_at).not.toBe('2000-01-01T00:00:00.000Z');
  });
});
