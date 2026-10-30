/**
 * Migration 0488 verification: credential network allow-list extension.
 *
 * Applies the REAL migration chain (0084 -> 0488) against a real SQLite-backed
 * fake D1, then proves:
 *
 *  1. Pre-existing credential rows survive the table rebuild verbatim.
 *  2. The six postback networks (rewardful, awin, tiktok_shop, okx, amazon,
 *     accesstrade) become storable — tenant-scoped verification depends on it.
 *  3. The (tenant_id, network) uniqueness invariant is preserved.
 *
 * NOTE: 0248 is deliberately skipped in this chain — its guard statement uses
 * `INSERT ... VALUES ... WHERE`, which is invalid SQLite (shipped that way in
 * #42; the file must not be edited retroactively). 0488 rebuilds correctly
 * from either the 0084 or the 0248 column shape (identical columns), so this
 * test covers both prod possibilities.
 *
 * @module tree/affiliates/__tests__/credential-networks-0488.test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';

type FakeD1 = ReturnType<typeof createFakeD1>;

function sql(name: string): string {
  return readFileSync(resolve(process.cwd(), 'migrations', name), 'utf8');
}

async function insertCred(db: FakeD1, tenantId: string, network: string) {
  await db
    .prepare(
      'INSERT INTO affiliate_network_credentials (id, tenant_id, network, encrypted_credentials) VALUES (?, ?, ?, ?)',
    )
    .bind(`${tenantId}:${network}`, tenantId, network, 'enc_blob')
    .run();
}

describe('migration 0488_extend_credential_networks_postback', () => {
  it('rejects postback networks before 0488 and accepts them after', async () => {
    const db = createFakeD1([
      sql('0084-affiliate-network-credentials.sql'),
    ]);

    await insertCred(db, 'tenant-a', 'clickbank');
    await expect(insertCred(db, 'tenant-a', 'rewardful')).rejects.toThrow();
    await expect(insertCred(db, 'tenant-a', 'amazon')).rejects.toThrow();

    db._db.exec(sql('0488_extend_credential_networks_postback.sql'));

    // Legacy row survived the rebuild verbatim.
    const legacy = await db
      .prepare('SELECT network, encrypted_credentials AS blob FROM affiliate_network_credentials WHERE tenant_id = ?')
      .bind('tenant-a')
      .first<{ network: string; blob: string }>();
    expect(legacy).toMatchObject({ network: 'clickbank', blob: 'enc_blob' });

    // Postback networks are now storable.
    for (const network of ['rewardful', 'awin', 'tiktok_shop', 'okx', 'amazon', 'accesstrade']) {
      await insertCred(db, 'tenant-a', network);
    }
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM affiliate_network_credentials WHERE tenant_id = ?')
      .bind('tenant-a')
      .first<{ n: number }>();
    expect(row?.n).toBe(7);

    // Uniqueness invariant preserved.
    await expect(insertCred(db, 'tenant-a', 'amazon')).rejects.toThrow();
  });
});
