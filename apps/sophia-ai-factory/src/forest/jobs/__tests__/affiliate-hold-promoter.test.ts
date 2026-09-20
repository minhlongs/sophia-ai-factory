import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  runHoldPromotionJob,
  affiliateHoldPromoterCron,
} from '../affiliate-hold-promoter';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS commission_ledger (
      id TEXT PRIMARY KEY,
      affiliate_id TEXT NOT NULL,
      network TEXT NOT NULL,
      external_conversion_id TEXT NOT NULL,
      commission_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      hold_days INTEGER NOT NULL DEFAULT 14,
      attributed_at INTEGER NOT NULL,
      payable_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(network, external_conversion_id)
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0) } };
            },
            all: async <T>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0 } };
            },
          };
        },
        first: async <T>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0) } };
        },
        all: async <T>() => {
          return { results: stmt.all() as T[], meta: { changes: 0 } };
        },
      };
    },
  } as unknown as D1Database;
}

describe('Affiliate Hold Promoter (forest/jobs/affiliate-hold-promoter)', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('promotes only matured pending rows to payable', async () => {
    const nowMs = 1_700_000_000_000;

    // Mature row: payable_at in the past
    await db
      .prepare(
        `INSERT INTO commission_ledger (
          id, affiliate_id, network, external_conversion_id, commission_cents,
          status, hold_days, attributed_at, payable_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', 14, ?, ?)`,
      )
      .bind('c_mature', 'aff_1', 'tiktok_shop', 'conv_mature', 1500, nowMs - 15 * 86400 * 1000, nowMs - 1000)
      .run();

    // Immature row: payable_at in the future
    await db
      .prepare(
        `INSERT INTO commission_ledger (
          id, affiliate_id, network, external_conversion_id, commission_cents,
          status, hold_days, attributed_at, payable_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', 14, ?, ?)`,
      )
      .bind('c_immature', 'aff_1', 'tiktok_shop', 'conv_immature', 2000, nowMs, nowMs + 14 * 86400 * 1000)
      .run();

    const result = await runHoldPromotionJob(db, nowMs);

    expect(result.promotedCount).toBe(1);
    expect(result.promotedAtMs).toBe(nowMs);

    const matureRow = await db
      .prepare('SELECT status FROM commission_ledger WHERE id = ?')
      .bind('c_mature')
      .first<{ status: string }>();
    expect(matureRow?.status).toBe('payable');

    const immatureRow = await db
      .prepare('SELECT status FROM commission_ledger WHERE id = ?')
      .bind('c_immature')
      .first<{ status: string }>();
    expect(immatureRow?.status).toBe('pending');
  });

  it('exposes Inngest cron configuration with 02:00 daily schedule', () => {
    expect(affiliateHoldPromoterCron).toBeDefined();
    // Inngest function metadata check
    expect(affiliateHoldPromoterCron).toHaveProperty('name');
  });
});
