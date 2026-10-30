/**
 * Migration 0487 verification: postback receipt idempotency.
 *
 * Applies the REAL migration chain (0082 -> 0487) against a real SQLite-backed
 * fake D1 preloaded with legacy duplicate conversion rows, then proves:
 *
 *  1. Exact replays (same key, same amount) collapse to the earliest row.
 *  2. Same key with a DIFFERENT amount is kept (reconcile, not delete).
 *  3. Rows without external ids are untouched.
 *  4. The partial unique index blocks future exact replays at the DB layer.
 *
 * @module land/postback/__tests__/receipt-idempotency-migration.test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';

type FakeD1 = ReturnType<typeof createFakeD1>;

function sql(name: string): string {
  return readFileSync(resolve(process.cwd(), 'migrations', name), 'utf8');
}

async function seedConversion(
  db: FakeD1,
  opts: { id: string; network: string; extConv: string | null; amount: number | null; ts: string },
) {
  await db
    .prepare(
      `INSERT INTO tracking_conversions (id, link_id, network, external_conversion_id, amount_usd, ts)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(opts.id, 'link_1', opts.network, opts.extConv, opts.amount, opts.ts)
    .run();
}

async function countConversions(db: FakeD1): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM tracking_conversions').first<{ n: number }>();
  return row?.n ?? -1;
}

describe('migration 0487_postback_receipt_idempotency', () => {
  it('dedups exact replays, keeps amount conflicts and null-key rows', async () => {
    const db = createFakeD1([sql('0082-edge-tracking.sql')]);
    await db
      .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
      .bind('link_1', 'tenant-a', 'https://example.com/offer')
      .run();

    await seedConversion(db, { id: 'c1', network: 'tiktok_shop', extConv: 'conv-1', amount: 10, ts: '2026-01-01T00:00:00.000Z' });
    await seedConversion(db, { id: 'c2', network: 'tiktok_shop', extConv: 'conv-1', amount: 10, ts: '2026-01-01T00:01:00.000Z' });
    await seedConversion(db, { id: 'c3', network: 'tiktok_shop', extConv: 'conv-2', amount: 10, ts: '2026-01-01T00:02:00.000Z' });
    await seedConversion(db, { id: 'c4', network: 'tiktok_shop', extConv: 'conv-2', amount: 25, ts: '2026-01-01T00:03:00.000Z' });
    await seedConversion(db, { id: 'c5', network: 'tiktok_shop', extConv: null, amount: 10, ts: '2026-01-01T00:04:00.000Z' });
    expect(await countConversions(db)).toBe(5);

    db._db.exec(sql('0487_postback_receipt_idempotency.sql'));

    expect(await countConversions(db)).toBe(4);
    const kept = await db
      .prepare('SELECT id FROM tracking_conversions ORDER BY ts')
      .all<{ id: string }>();
    const ids = (kept.results ?? []).map((r) => r.id);
    // Exact replay collapsed to the earliest row (c1 kept, c2 gone).
    expect(ids).toContain('c1');
    expect(ids).not.toContain('c2');
    // Amount conflict kept both rows for reconcile.
    expect(ids).toContain('c3');
    expect(ids).toContain('c4');
    // Null-key row untouched.
    expect(ids).toContain('c5');
  });

  it('keeps same-receipt different-amount rows coexisting under the index', async () => {
    const db = createFakeD1([sql('0082-edge-tracking.sql'), sql('0487_postback_receipt_idempotency.sql')]);
    await db
      .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
      .bind('link_1', 'tenant-a', 'https://example.com/offer')
      .run();

    // A provider amount correction is a reconcile signal, not a replay.
    await seedConversion(db, {
      id: 'c11',
      network: 'awin',
      extConv: 'conv-11',
      amount: 10,
      ts: '2026-01-01T00:00:00.000Z',
    });
    await seedConversion(db, {
      id: 'c12',
      network: 'awin',
      extConv: 'conv-11',
      amount: 25,
      ts: '2026-01-01T00:01:00.000Z',
    });
    expect(await countConversions(db)).toBe(2);
  });

  it('documents the NULL-amount limitation: amount-less retries append', async () => {
    const db = createFakeD1([sql('0082-edge-tracking.sql'), sql('0487_postback_receipt_idempotency.sql')]);
    await db
      .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
      .bind('link_1', 'tenant-a', 'https://example.com/offer')
      .run();

    await seedConversion(db, {
      id: 'c13',
      network: 'awin',
      extConv: 'conv-13',
      amount: null,
      ts: '2026-01-01T00:00:00.000Z',
    });
    await seedConversion(db, {
      id: 'c14',
      network: 'awin',
      extConv: 'conv-13',
      amount: null,
      ts: '2026-01-01T00:01:00.000Z',
    });
    // Pinned behavior: SQLite NULLs never conflict, so both rows land.
    // Amount-less providers must send stable receipt ids only once.
    expect(await countConversions(db)).toBe(2);
  });

  it('blocks future exact replays at the DB layer', async () => {
    const db = createFakeD1([sql('0082-edge-tracking.sql'), sql('0487_postback_receipt_idempotency.sql')]);
    await db
      .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
      .bind('link_1', 'tenant-a', 'https://example.com/offer')
      .run();

    await seedConversion(db, {
      id: 'c9',
      network: 'awin',
      extConv: 'conv-9',
      amount: 10,
      ts: '2026-01-01T00:00:00.000Z',
    });
    await expect(
      seedConversion(db, {
        id: 'c10',
        network: 'awin',
        extConv: 'conv-9',
        amount: 10,
        ts: '2026-01-01T00:01:00.000Z',
      }),
    ).rejects.toThrow();
    expect(await countConversions(db)).toBe(1);
  });
});
