// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ createServerClient: () => ({ execute: mocks.execute }) }));

import { markOrderCompleted } from '../pending-order-repo';

type SqliteDb = DatabaseSync & { close(): void };
let sqlite: SqliteDb;

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:') as SqliteDb;
  sqlite.exec(`CREATE TABLE pending_orders (
    order_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    payment_id TEXT,
    completed_at TEXT
  );`);
  mocks.execute.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const statement = sqlite.prepare(sql);
    return statement.run(...params as Array<string | number | null>);
  });
});

afterEach(() => {
  sqlite.close();
  vi.clearAllMocks();
});

describe('pending order D1 completion timestamp', () => {
  it('writes a SQLite timestamp and preserves it when a success event is replayed', async () => {
    sqlite.prepare('INSERT INTO pending_orders(order_id, status) VALUES (?, ?)').run('order-1', 'pending');

    await markOrderCompleted('order-1', 'payment-1');
    const first = sqlite.prepare('SELECT * FROM pending_orders WHERE order_id = ?').get('order-1') as Record<string, unknown>;
    await markOrderCompleted('order-1', 'payment-1');
    const replayed = sqlite.prepare('SELECT * FROM pending_orders WHERE order_id = ?').get('order-1') as Record<string, unknown>;

    expect(first).toMatchObject({ status: 'completed', payment_id: 'payment-1' });
    expect(first.completed_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(replayed.completed_at).toBe(first.completed_at);
  });

  it('records success time rather than preserving an earlier failure time', async () => {
    sqlite.prepare('INSERT INTO pending_orders(order_id, status, completed_at) VALUES (?, ?, ?)')
      .run('order-2', 'failed', '2000-01-01T00:00:00.000Z');

    await markOrderCompleted('order-2', 'late-payment-2');
    const row = sqlite.prepare('SELECT * FROM pending_orders WHERE order_id = ?').get('order-2') as Record<string, unknown>;

    expect(row).toMatchObject({ status: 'completed', payment_id: 'late-payment-2' });
    expect(row.completed_at).not.toBe('2000-01-01T00:00:00.000Z');
  });
});
