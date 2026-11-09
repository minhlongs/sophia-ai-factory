/**
 * Unit tests for Workspace Partner Network Actions (Cloud-Gated + Tenant-Scoped)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/config/enforce-commercial-feature-server', () => ({
  enforceCommercialFeatureForUser: vi.fn(),
}));

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import {
  listWorkspacePartnersAction,
  recruitWorkspacePartnerAction,
  reviewWorkspacePartnerStatusAction,
  createWorkspaceDualRailBatchAction,
} from '../workspace-partner-network-actions';

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

const mockedGetD1 = vi.mocked(getD1);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedEnforceGate = vi.mocked(enforceCommercialFeatureForUser);

beforeEach(() => {
  vi.clearAllMocks();
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

  mockedGetD1.mockResolvedValue(d1);
  mockedGetCurrentUser.mockResolvedValue({
    id: 'ws_owner_1',
    email: 'owner1@agency.vn',
  } as Awaited<ReturnType<typeof getCurrentUser>>);
  mockedEnforceGate.mockResolvedValue({
    ok: true,
    value: {
      featureId: 'affiliate_attribution_payouts',
      reasonCode: 'MANAGED_CLOUD_ACTIVE',
    },
  });
});

afterEach(() => {
  db.close();
});

describe('workspace-partner-network-actions', () => {
  it('blocks access when commercial edition gate fails', async () => {
    mockedEnforceGate.mockResolvedValueOnce({
      ok: false,
      error: {
        featureId: 'affiliate_attribution_payouts',
        reasonCode: 'REQUIRES_CLOUD_SUBSCRIPTION',
        code: 'REQUIRES_CLOUD_SUBSCRIPTION',
        messageVi: 'Cần nâng cấp lên Sophia Cloud',
        messageEn: 'Upgrade to Sophia Cloud required',
        message: 'Upgrade to Sophia Cloud required',
        upgradeUrl: '/pricing',
      },
    });

    const res = await listWorkspacePartnersAction();
    expect(res.success).toBe(false);
    expect(res.error).toContain('Upgrade to Sophia Cloud');
  });

  it('recruits VietQR and USDT partners scoped to current workspace tenant_id', async () => {
    const vietQrRes = await recruitWorkspacePartnerAction({
      partnerCode: 'vn_agency_01',
      commissionRatePct: 25,
      payoutRail: 'VIETQR',
      bankBin: '970422',
      bankAccountNumber: '190012345678',
      bankAccountName: 'CONG TY TNHH AGENCY A',
    });
    expect(vietQrRes.success).toBe(true);

    const usdtRes = await recruitWorkspacePartnerAction({
      partnerCode: 'global_kol_02',
      commissionRatePct: 30,
      payoutRail: 'USDT',
      usdtAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    });
    expect(usdtRes.success).toBe(true);

    // Seed another workspace's partner to verify tenant isolation
    db.prepare(
      `INSERT INTO affiliate_partners (id, user_id, tenant_id, partner_code, payout_rail, status)
       VALUES ('other_p', 'u_other', 'ws_owner_2', 'OTHER_WS_CODE', 'VIETQR', 'active')`,
    ).run();

    const listRes = await listWorkspacePartnersAction();
    expect(listRes.success).toBe(true);
    expect(listRes.partners?.map((p) => p.partnerCode).sort()).toEqual([
      'GLOBAL_KOL_02',
      'VN_AGENCY_01',
    ]);

    // Rejects duplicate partner_code cleanly
    const dupRes = await recruitWorkspacePartnerAction({
      partnerCode: 'vn_agency_01',
      commissionRatePct: 20,
      payoutRail: 'VIETQR',
      bankBin: '970422',
      bankAccountNumber: '190012345678',
      bankAccountName: 'CONG TY TNHH AGENCY A',
    });
    expect(dupRes.success).toBe(false);
    expect(dupRes.error).toContain('VN_AGENCY_01 is already registered');

    // Rejects CSV formula injection in bankAccountName
    const formulaRes = await recruitWorkspacePartnerAction({
      partnerCode: 'formula_test_01',
      commissionRatePct: 20,
      payoutRail: 'VIETQR',
      bankBin: '970422',
      bankAccountNumber: '190012345678',
      bankAccountName: '=CMD|"/C calc"!A0',
    });
    expect(formulaRes.success).toBe(false);
  });

  it('approves or suspends under_review partners only within the owner workspace', async () => {
    db.prepare(
      `INSERT INTO affiliate_partners
         (id, user_id, tenant_id, partner_code, payout_rail, status, is_suspicious, pending_payout_cents,
          bank_bin, bank_account_number, bank_account_name)
       VALUES
         ('p_flagged', 'u_1', 'ws_owner_1', 'FLAGGED_VN', 'VIETQR', 'under_review', 1, 15000, '970422', '12345678', 'TRAN A'),
         ('p_foreign', 'u_2', 'ws_owner_2', 'FOREIGN_VN', 'VIETQR', 'under_review', 1, 15000, '970422', '87654321', 'LE B')`,
    ).run();

    // While under_review, batch excludes the partner
    const heldBatch = await createWorkspaceDualRailBatchAction({
      rail: 'COMBINED',
      minPayoutCents: 5000,
    });
    expect(heldBatch.success).toBe(true);
    expect(heldBatch.batch?.itemCount).toBe(0);

    // Cannot approve foreign tenant's partner
    const foreignAttempt = await reviewWorkspacePartnerStatusAction({
      partnerId: 'p_foreign',
      decision: 'approve',
    });
    expect(foreignAttempt.success).toBe(false);

    // Approve own workspace partner
    const approveRes = await reviewWorkspacePartnerStatusAction({
      partnerId: 'p_flagged',
      decision: 'approve',
    });
    expect(approveRes.success).toBe(true);
    expect(approveRes.newStatus).toBe('active');

    // Now included in Dual-Rail batch
    const unlockedBatch = await createWorkspaceDualRailBatchAction({
      rail: 'COMBINED',
      minPayoutCents: 5000,
    });
    expect(unlockedBatch.success).toBe(true);
    expect(unlockedBatch.batch?.itemCount).toBe(1);
    expect(unlockedBatch.vietQrCsv).toContain('FLAGGED_VN');
  });
});
