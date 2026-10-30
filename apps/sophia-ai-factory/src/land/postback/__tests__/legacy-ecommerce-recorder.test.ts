/**
 * Legacy ecommerce recorder tests.
 *
 * Proves tenant-scoped, idempotent conversion recording against a real
 * SQLite-backed fake D1 seeded from the REAL 0035 affiliate-engine migration:
 *
 *  1. First write persists the tenant-owned row with a network-namespaced id.
 *  2. Replays of the same network transaction are deduplicated (no second row).
 *  3. Identical raw transaction ids from DIFFERENT networks do not collide.
 *
 * @module land/postback/__tests__/legacy-ecommerce-recorder.test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import {
  recordLegacyEcommerceConversion,
  namespacedTxnId,
  type LegacyEcommerceReceipt,
} from '../legacy-ecommerce-recorder';

type FakeD1 = ReturnType<typeof createFakeD1>;

function createEngineD1(): FakeD1 {
  const engine = readFileSync(resolve(process.cwd(), 'migrations/0035-affiliate-engine.sql'), 'utf8');
  return createFakeD1([engine]);
}

async function countRows(db: FakeD1): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM conversion_events').first<{ n: number }>();
  return row?.n ?? -1;
}

function receipt(overrides: Partial<LegacyEcommerceReceipt> = {}): LegacyEcommerceReceipt {
  return {
    tenantId: 'tenant-a',
    linkId: 'link_A1',
    clickId: null,
    network: 'tiktok_shop',
    providerTxnId: 'conv-1',
    grossAmountUsd: 25.5,
    commissionUsd: 2.55,
    status: 'pending',
    attributedAtSec: 1_700_000_000,
    ...overrides,
  };
}

describe('recordLegacyEcommerceConversion', () => {
  it('persists a tenant-owned row with a network-namespaced transaction id', async () => {
    const db = createEngineD1();

    const res = await recordLegacyEcommerceConversion(db as unknown as D1Database, receipt());

    expect(res.duplicate).toBe(false);
    const stored = await db
      .prepare('SELECT tenant_id, link_id, network_transaction_id, status FROM conversion_events')
      .first<{ tenant_id: string; link_id: string; network_transaction_id: string; status: string }>();
    expect(stored?.tenant_id).toBe('tenant-a');
    expect(stored?.link_id).toBe('link_A1');
    expect(stored?.network_transaction_id).toBe('tiktok_shop:conv-1');
    expect(stored?.status).toBe('pending');
  });

  it('deduplicates replays of the same network transaction', async () => {
    const db = createEngineD1();

    const first = await recordLegacyEcommerceConversion(
      db as unknown as D1Database,
      receipt({ network: 'amazon', providerTxnId: 'D-111-222', status: 'approved' }),
    );
    const replay = await recordLegacyEcommerceConversion(
      db as unknown as D1Database,
      receipt({ network: 'amazon', providerTxnId: 'D-111-222', status: 'approved' }),
    );

    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(await countRows(db)).toBe(1);
  });

  it('does not collide identical raw transaction ids across networks', async () => {
    const db = createEngineD1();

    const first = await recordLegacyEcommerceConversion(
      db as unknown as D1Database,
      receipt({ network: 'accesstrade', providerTxnId: 'SAME-RAW-ID' }),
    );
    const second = await recordLegacyEcommerceConversion(
      db as unknown as D1Database,
      receipt({ network: 'awin', providerTxnId: 'SAME-RAW-ID' }),
    );

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(false);
    expect(await countRows(db)).toBe(2);
  });

  it('namespaces receipts as {network}:{provider_txn_id}', () => {
    expect(namespacedTxnId('awin', '42')).toBe('awin:42');
  });
});
