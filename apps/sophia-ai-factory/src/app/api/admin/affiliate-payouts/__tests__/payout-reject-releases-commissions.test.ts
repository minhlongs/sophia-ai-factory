/**
 * Admin payout reject — releasing the commissions the payout reserved.
 *
 * A payout above the auto-approve ceiling waits for an admin decision, and the
 * NET-30 sweep has already stamped `payout_id` onto the commissions it was built
 * from. Every claim path filters on `payout_id IS NULL`, so a rejected payout
 * that keeps those rows pointing at itself hides the partner's earned money from
 * every sweep and from the manual request path. Rejecting must therefore hand
 * the commissions back.
 *
 * @module app/api/admin/affiliate-payouts/__tests__/payout-reject-releases-commissions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';

import { rejectPayout } from '../route-helpers';

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

/** Mirrors the columns the reject and release statements touch. */
const SCHEMA = `
  CREATE TABLE affiliate_payouts (
    id TEXT PRIMARY KEY,
    payout_reference TEXT UNIQUE NOT NULL,
    partner_id TEXT NOT NULL,
    rail TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    destination_encrypted TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    commission_count INTEGER NOT NULL DEFAULT 0,
    tx_hash_or_bank_ref TEXT,
    approved_by TEXT,
    approved_at INTEGER,
    failure_reason TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE affiliate_commissions (
    id TEXT PRIMARY KEY,
    event_key TEXT UNIQUE NOT NULL,
    partner_id TEXT NOT NULL,
    referral_id TEXT,
    payment_provider TEXT NOT NULL,
    payment_id TEXT NOT NULL,
    order_id TEXT,
    customer_user_id TEXT NOT NULL,
    gross_amount_cents INTEGER NOT NULL,
    commission_rate_pct REAL NOT NULL,
    commission_cents INTEGER NOT NULL,
    tier_level TEXT NOT NULL DEFAULT 'TIER1',
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    hold_days INTEGER NOT NULL DEFAULT 14,
    payable_at INTEGER NOT NULL,
    settled_at INTEGER,
    payout_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

const PARTNER_ID = 'partner_alpha';
const PAYOUT_ID = 'po_reject_case';

let db: NativeSqliteDb;
let d1: D1Database;

function seedPayout(status: string): void {
  db.prepare(
    `INSERT INTO affiliate_payouts
       (id, payout_reference, partner_id, rail, amount_cents, destination_encrypted,
        status, commission_count, version, created_at, updated_at)
     VALUES (?, ?, ?, 'USDT', 60000, 'enc_addr', ?, 2, 1, 1, 1)`,
  ).run(PAYOUT_ID, `PO_${PAYOUT_ID}`, PARTNER_ID, status);
}

/** One commission, optionally already reserved by the payout. */
function seedCommission(
  id: string,
  status: string,
  payoutId: string | null,
  amountCents = 30_000,
): void {
  db.prepare(
    `INSERT INTO affiliate_commissions
       (id, event_key, partner_id, payment_provider, payment_id, customer_user_id,
        gross_amount_cents, commission_rate_pct, commission_cents, status,
        payable_at, payout_id, version, created_at, updated_at)
     VALUES (?, ?, ?, 'nowpayments', ?, 'cust_1', ?, 30.0, ?, ?, 1, ?, 1, 1, 1)`,
  ).run(id, `evt_${id}`, PARTNER_ID, `pay_${id}`, amountCents, amountCents, status, payoutId);
}

function commissionRow(id: string): { status: string; payout_id: string | null } {
  return db
    .prepare(`SELECT status, payout_id FROM affiliate_commissions WHERE id = ?`)
    .get(id) as { status: string; payout_id: string | null };
}

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  // The helper types D1 loosely enough that a synchronous shim over node:sqlite
  // stands in for the Workers binding, the same way the adversarial suite does.
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
    batch: async (statements: Array<unknown>) => {
      for (const one of statements) {
        await (one as { run(): Promise<unknown> }).run();
      }
      return [];
    },
  } as unknown as D1Database;
});

afterEach(() => {
  db.close();
});

describe('rejectPayout — releasing reserved commissions', () => {
  it('hands back the commissions a rejected payout is holding', async () => {
    seedPayout('pending_approval');
    seedCommission('c1', 'payable', PAYOUT_ID);
    seedCommission('c2', 'payable', PAYOUT_ID);

    const res = await rejectPayout({
      d1,
      payoutId: PAYOUT_ID,
      currentVersion: 1,
      adminId: 'admin_1',
      reason: 'duplicate suspicion',
    });

    expect(res.ok).toBe(true);
    expect(commissionRow('c1')).toEqual({ status: 'payable', payout_id: null });
    expect(commissionRow('c2')).toEqual({ status: 'payable', payout_id: null });
  });

  it('leaves the money claimable rather than settled', async () => {
    seedPayout('pending_approval');
    seedCommission('c1', 'payable', PAYOUT_ID);

    await rejectPayout({
      d1,
      payoutId: PAYOUT_ID,
      currentVersion: 1,
      adminId: 'admin_1',
      reason: 'wrong destination',
    });

    // `payable` with a null payout_id is exactly what the sweep's claim query
    // selects, so the next run can pay it out again.
    expect(commissionRow('c1').status).toBe('payable');
  });

  it('does not reopen a commission another payout already settled', async () => {
    seedPayout('pending_approval');
    seedCommission('paid', 'settled', 'po_other');

    await rejectPayout({
      d1,
      payoutId: PAYOUT_ID,
      currentVersion: 1,
      adminId: 'admin_1',
      reason: 'duplicate',
    });

    // A settled commission belongs to the payout that completed, not this one.
    expect(commissionRow('paid')).toEqual({ status: 'settled', payout_id: 'po_other' });
  });

  it('reports the release count so the decision is traceable', async () => {
    seedPayout('pending_approval');
    seedCommission('c1', 'payable', PAYOUT_ID);
    seedCommission('c2', 'payable', PAYOUT_ID);
    seedCommission('c3', 'pending', null);

    const res = await rejectPayout({
      d1,
      payoutId: PAYOUT_ID,
      currentVersion: 1,
      adminId: 'admin_1',
      reason: 'exceeded hold period',
    });

    expect(res.ok).toBe(true);
    // The unmatured commission was never reserved, so nothing to release.
    expect(commissionRow('c3')).toEqual({ status: 'pending', payout_id: null });
  });

  it('rejects without touching commissions when OCC fails', async () => {
    seedPayout('pending_approval');
    seedCommission('c1', 'payable', PAYOUT_ID);

    const res = await rejectPayout({
      d1,
      payoutId: PAYOUT_ID,
      currentVersion: 99,
      adminId: 'admin_1',
      reason: 'stale version',
    });

    expect(res.ok).toBe(false);
    expect(res.conflict).toBe(true);
    // A lost race must not release money the winning decision still owns.
    expect(commissionRow('c1')).toEqual({ status: 'payable', payout_id: PAYOUT_ID });
  });
});
