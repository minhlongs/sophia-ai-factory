import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { processPayoutBatch } from '../payout-batcher';

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
      status TEXT NOT NULL DEFAULT 'payable',
      hold_days INTEGER NOT NULL DEFAULT 14,
      attributed_at INTEGER NOT NULL,
      payable_at INTEGER NOT NULL,
      payout_batch_id TEXT,
      parent_id TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(network, external_conversion_id)
    );

    CREATE TABLE IF NOT EXISTS payout_batches (
      id TEXT PRIMARY KEY,
      rail TEXT NOT NULL,
      total_amount_cents INTEGER NOT NULL DEFAULT 0,
      recipient_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      tx_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      confirmed_at INTEGER
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

describe('Payout Batcher (forest/jobs/payout-batcher)', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('claims payable rows via OCC CAS and transitions them to paying', async () => {
    await db
      .prepare(
        `INSERT INTO commission_ledger (
          id, affiliate_id, network, external_conversion_id, commission_cents,
          status, hold_days, attributed_at, payable_at
        ) VALUES (?, ?, ?, ?, ?, 'payable', 14, 1000, 2000)`,
      )
      .bind('c1', 'aff_alice', 'tiktok_shop', 'conv_1', 5000)
      .run();

    await db
      .prepare(
        `INSERT INTO commission_ledger (
          id, affiliate_id, network, external_conversion_id, commission_cents,
          status, hold_days, attributed_at, payable_at
        ) VALUES (?, ?, ?, ?, ?, 'payable', 14, 1000, 2000)`,
      )
      .bind('c2', 'aff_bob', 'amazon_associates', 'conv_2', 8000)
      .run();

    const result = await processPayoutBatch(db, 'nowpayments_usdt');

    expect(result.success).toBe(true);
    expect(result.totalAmountCents).toBe(13000);
    expect(result.recipientCount).toBe(2);
    expect(result.claimedRowIds).toHaveLength(2);

    // Verify row status flipped to 'paying' and payout_batch_id is set
    const row1 = await db
      .prepare('SELECT status, payout_batch_id FROM commission_ledger WHERE id = ?')
      .bind('c1')
      .first<{ status: string; payout_batch_id: string }>();

    expect(row1?.status).toBe('paying');
    expect(row1?.payout_batch_id).toBe(result.batchId);
  });

  it('enforces minimum threshold ($1.00 = 100 cents)', async () => {
    // 50 cents row (< 100 cents)
    await db
      .prepare(
        `INSERT INTO commission_ledger (
          id, affiliate_id, network, external_conversion_id, commission_cents,
          status, hold_days, attributed_at, payable_at
        ) VALUES (?, ?, ?, ?, ?, 'payable', 14, 1000, 2000)`,
      )
      .bind('c_tiny', 'aff_tiny', 'awin', 'conv_tiny', 50)
      .run();

    const result = await processPayoutBatch(db, 'nowpayments_usdt');
    expect(result.claimedRowIds).not.toContain('c_tiny');
    expect(result.totalAmountCents).toBe(0);
  });

  it('prevents double-claiming on immediate re-run (idempotent)', async () => {
    await db
      .prepare(
        `INSERT INTO commission_ledger (
          id, affiliate_id, network, external_conversion_id, commission_cents,
          status, hold_days, attributed_at, payable_at
        ) VALUES (?, ?, ?, ?, ?, 'payable', 14, 1000, 2000)`,
      )
      .bind('c_claim', 'aff_carol', 'clickbank', 'conv_c', 6000)
      .run();

    const batch1 = await processPayoutBatch(db, 'nowpayments_usdt');
    expect(batch1.claimedRowIds).toContain('c_claim');

    const batch2 = await processPayoutBatch(db, 'nowpayments_usdt');
    expect(batch2.claimedRowIds).toHaveLength(0);
  });

  it('returns empty result safely when no payable rows exist', async () => {
    const result = await processPayoutBatch(db, 'nowpayments_usdt');
    expect(result.success).toBe(true);
    expect(result.totalAmountCents).toBe(0);
    expect(result.recipientCount).toBe(0);
    expect(result.claimedRowIds).toHaveLength(0);
  });
});
