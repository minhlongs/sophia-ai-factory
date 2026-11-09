/**
 * Dual-Rail Tenant-Scoped Payout Batch Builder Tests
 *
 * Verifies:
 * 1. Tenant isolation (`tenant_id = ?`) so workspace owners only batch their own partners.
 * 2. Risk holdback (`status = 'active'` filter) so `under_review` and `suspended` partners
 *    are excluded from payout batches until explicitly approved.
 * 3. VietQR + USDT item mapping and RFC 4180 CSV generation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import { createDualRailPayoutBatch } from '../dual-rail-payout-engine';
import { generateVietQrCsv } from '../fiat-csv-formatter';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
    close(): void;
  };
};

type NativeSqliteDb = InstanceType<typeof DatabaseSync>;

const SCHEMA = `
  CREATE TABLE affiliate_partners (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    partner_code TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'STANDARD',
    commission_rate_pct REAL NOT NULL DEFAULT 20.0,
    tier2_rate_pct REAL NOT NULL DEFAULT 5.0,
    payout_rail TEXT DEFAULT 'USDT',
    usdt_trc20_address_encrypted TEXT,
    bank_bin TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    risk_score REAL NOT NULL DEFAULT 0,
    is_suspicious INTEGER NOT NULL DEFAULT 0,
    total_earnings_cents INTEGER NOT NULL DEFAULT 0,
    pending_payout_cents INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT 1
  );
`;

let db: NativeSqliteDb;
let d1: D1Database;

function seedPartner(row: {
  id: string;
  tenantId: string;
  partnerCode: string;
  rail: 'VIETQR' | 'USDT';
  status: 'active' | 'under_review' | 'suspended';
  pendingCents: number;
  bankBin?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  usdtAddr?: string;
}): void {
  db.prepare(
    `INSERT INTO affiliate_partners
       (id, user_id, tenant_id, partner_code, payout_rail, status, pending_payout_cents,
        bank_bin, bank_account_number, bank_account_name, usdt_trc20_address_encrypted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    `user_${row.id}`,
    row.tenantId,
    row.partnerCode,
    row.rail,
    row.status,
    row.pendingCents,
    row.bankBin ?? null,
    row.bankAccountNumber ?? null,
    row.bankAccountName ?? null,
    row.usdtAddr ?? null,
  );
}

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  d1 = {
    prepare: (sql: string) => {
      const stmt = db.prepare(sql);
      return {
        bind: (...args: unknown[]) => ({
          run: async () => ({ success: true, meta: { changes: stmt.run(...args).changes } }),
          first: async () => stmt.get(...args),
          all: async () => ({ results: stmt.all(...args) }),
        }),
      };
    },
  } as unknown as D1Database;
});

afterEach(() => {
  db.close();
});

describe('createDualRailPayoutBatch — tenant isolation and under_review holdback', () => {
  it('includes only active partners belonging to the specified tenantId', async () => {
    seedPartner({
      id: 'p_vn_active',
      tenantId: 'tenant_alpha',
      partnerCode: 'ALPHA_VN1',
      rail: 'VIETQR',
      status: 'active',
      pendingCents: 12000,
      bankBin: '970422',
      bankAccountNumber: '0987654321',
      bankAccountName: 'NGUYEN VAN A',
    });
    seedPartner({
      id: 'p_usdt_active',
      tenantId: 'tenant_alpha',
      partnerCode: 'ALPHA_USDT1',
      rail: 'USDT',
      status: 'active',
      pendingCents: 8000,
      usdtAddr: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    });
    seedPartner({
      id: 'p_under_review',
      tenantId: 'tenant_alpha',
      partnerCode: 'ALPHA_FLAGGED',
      rail: 'VIETQR',
      status: 'under_review',
      pendingCents: 25000,
      bankBin: '970436',
      bankAccountNumber: '0123456789',
      bankAccountName: 'TRAN VAN B',
    });
    seedPartner({
      id: 'p_other_tenant',
      tenantId: 'tenant_beta',
      partnerCode: 'BETA_VN1',
      rail: 'VIETQR',
      status: 'active',
      pendingCents: 50000,
      bankBin: '970415',
      bankAccountNumber: '111222333',
      bankAccountName: 'LE THI C',
    });

    const batch = await createDualRailPayoutBatch(d1, {
      tenantId: 'tenant_alpha',
      minPayoutCents: 5000,
      rail: 'COMBINED',
    });

    expect(batch.itemCount).toBe(2);
    expect(batch.items.map((i) => i.partnerCode)).toEqual(['ALPHA_VN1', 'ALPHA_USDT1']);
    expect(batch.totalUsdtAmount).toBe(80);
    expect(batch.totalVndAmount).toBeGreaterThan(0);

    const csv = generateVietQrCsv(batch.items, { batchId: batch.batchId });
    expect(csv).toContain('ALPHA_VN1');
    expect(csv).toContain('970422');
    expect(csv).not.toContain('ALPHA_FLAGGED');
    expect(csv).not.toContain('BETA_VN1');
  });

  it('unlocks a previously under_review partner once status becomes active', async () => {
    seedPartner({
      id: 'p_review_1',
      tenantId: 'tenant_alpha',
      partnerCode: 'ALPHA_REVIEW1',
      rail: 'VIETQR',
      status: 'under_review',
      pendingCents: 10000,
      bankBin: '970422',
      bankAccountNumber: '88889999',
      bankAccountName: 'PHAM D',
    });

    const beforeApproval = await createDualRailPayoutBatch(d1, {
      tenantId: 'tenant_alpha',
      minPayoutCents: 5000,
    });
    expect(beforeApproval.itemCount).toBe(0);

    db.prepare(`UPDATE affiliate_partners SET status = 'active' WHERE id = ?`).run('p_review_1');

    const afterApproval = await createDualRailPayoutBatch(d1, {
      tenantId: 'tenant_alpha',
      minPayoutCents: 5000,
    });
    expect(afterApproval.itemCount).toBe(1);
    expect(afterApproval.items[0]?.partnerCode).toBe('ALPHA_REVIEW1');
  });
});
