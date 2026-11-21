// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import {
  assertPilotDebitEffect,
  getManualPilotCreditBalance,
  pilotCreditAllocationStatements,
} from '@/seed/billing/manual-pilot-credit-allocation';

vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));

async function createPilotDb(): Promise<D1Database> {
  const db = new NodeSqliteD1Database(':memory:');
  for (const migration of [
    '0052-missions-engine',
    '0053-mcu-credits',
    '0506_manual_pilot_settlement_ledger',
    '0507_manual_pilot_financial_state',
    '0509_manual_pilot_credit_compensation',
  ]) {
    await db.exec(readFileSync(`migrations/${migration}.sql`, 'utf8'));
  }

  await db.exec(`
    CREATE TABLE org_members (
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (org_id, user_id)
    );
    INSERT INTO org_members (org_id, user_id) VALUES
      ('org-a', 'user-a'),
      ('org-b', 'user-b');
    INSERT INTO engine_missions (id, user_id, command, status, credits_used, created_at) VALUES
      ('mission-a-1', 'user-a', 'ai:write', 'running', 0, 1),
      ('mission-b-1', 'user-b', 'ai:write', 'running', 0, 1);
  `);

  return db as unknown as D1Database;
}

async function seedPilotGrant(
  db: D1Database,
  opts: {
    orderId: string;
    userId: string;
    orgId: string;
    granted: number;
    expiresAt?: string;
    revokedAt?: string | null;
    revokedAmount?: number;
  },
) {
  const expiresAt = opts.expiresAt ?? '2200-01-01T00:00:00.000Z';
  const revokedAt = opts.revokedAt ?? null;
  const revokedAmount = opts.revokedAmount ?? 0;

  await db.batch([
    db
      .prepare(
        `INSERT INTO manual_pilot_settlements
          (id, order_id, user_id, org_id, expected_amount_vnd, received_amount_vnd, transfer_reference, status, activated_at)
         VALUES (?1, ?1, ?2, ?3, 1990000, 1990000, ?1, 'activated', '2000-01-01T00:00:00.000Z')`,
      )
      .bind(opts.orderId, opts.userId, opts.orgId),
    db
      .prepare(
        `INSERT INTO manual_pilot_financial_state (order_id, org_id, state, updated_at)
         VALUES (?, ?, 'ACTIVE_14D', '2000-01-01T00:00:00.000Z')`,
      )
      .bind(opts.orderId, opts.orgId),
    db
      .prepare(
        `INSERT INTO manual_pilot_credit_grants (order_id, user_id, org_id, granted, consumed, revoked, expires_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
      )
      .bind(opts.orderId, opts.userId, opts.orgId, opts.granted, revokedAmount, expiresAt),
    db
      .prepare(
        `INSERT INTO manual_pilot_entitlements (order_id, user_id, org_id, starts_at, ends_at, revoked_at)
         VALUES (?, ?, ?, '2000-01-01T00:00:00.000Z', '2200-01-01T00:00:00.000Z', ?)`,
      )
      .bind(opts.orderId, opts.userId, opts.orgId, revokedAt),
  ]);
}

async function executeMissionDebitBatch(
  db: D1Database,
  params: { userId: string; amount: number; missionId: string; orgId: string },
): Promise<boolean> {
  const attempt = randomUUID();
  const now = new Date().toISOString();
  const claimed = 'EXISTS(SELECT 1 FROM manual_pilot_credit_debits WHERE id=?)';
  const walletShare =
    '(? - COALESCE((SELECT SUM(amount) FROM manual_pilot_credit_allocations WHERE debit_id=?),0))';

  const [claim] = await db.batch([
    ...pilotCreditAllocationStatements(
      db,
      params.userId,
      params.amount,
      attempt,
      now,
      params.orgId,
      params.missionId,
    ),
    db
      .prepare(
        `INSERT INTO user_mcu_balance(user_id) SELECT ? WHERE ${claimed}
         ON CONFLICT(user_id) DO NOTHING`,
      )
      .bind(params.userId, attempt),
    db
      .prepare(
        `UPDATE user_mcu_balance
         SET credits_remaining = credits_remaining - ${walletShare},
             credits_total_used = credits_total_used + ?,
             updated_at = strftime('%s','now')
         WHERE user_id = ? AND ${claimed} AND credits_remaining >= ${walletShare}`,
      )
      .bind(params.amount, attempt, params.amount, params.userId, attempt, params.amount, attempt),
    assertPilotDebitEffect(db, attempt, 'changes()=1'),
    db
      .prepare(
        `INSERT INTO mcu_transactions(id, user_id, delta, reason, mission_id, metadata)
         SELECT ?, ?, ?, ?, ?, ? WHERE ${claimed}`,
      )
      .bind(
        attempt,
        params.userId,
        -params.amount,
        'mission:debit',
        params.missionId,
        JSON.stringify({ pilotDebitId: attempt }),
        attempt,
      ),
    assertPilotDebitEffect(db, attempt, 'changes()=1'),
    db
      .prepare(
        `INSERT INTO mcu_mission_debits(mission_id, debit_id, org_id)
         SELECT ?, ?, ? WHERE ${claimed}`,
      )
      .bind(params.missionId, attempt, params.orgId, attempt),
    assertPilotDebitEffect(db, attempt, 'changes()=1'),
  ]);

  return claim.meta.changes === 1;
}

async function countRows(
  db: D1Database,
  table: 'manual_pilot_credit_debits' | 'mcu_mission_debits' | 'mcu_transactions',
): Promise<number> {
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<number>('n');
  return count ?? 0;
}

describe('Manual Pilot Credit Allocation - Concurrency, State Guards & Tenant Isolation', () => {
  it('enforces at most 1 debit per (missionId, userId) across concurrent retries (duplicate MCU records = 0)', async () => {
    const db = await createPilotDb();
    await seedPilotGrant(db, {
      orderId: 'order-a-1',
      userId: 'user-a',
      orgId: 'org-a',
      granted: 100,
    });

    const results = await Promise.all([
      executeMissionDebitBatch(db, { userId: 'user-a', amount: 25, missionId: 'mission-a-1', orgId: 'org-a' }),
      executeMissionDebitBatch(db, { userId: 'user-a', amount: 25, missionId: 'mission-a-1', orgId: 'org-a' }),
      executeMissionDebitBatch(db, { userId: 'user-a', amount: 25, missionId: 'mission-a-1', orgId: 'org-a' }),
      executeMissionDebitBatch(db, { userId: 'user-a', amount: 25, missionId: 'mission-a-1', orgId: 'org-a' }),
      executeMissionDebitBatch(db, { userId: 'user-a', amount: 25, missionId: 'mission-a-1', orgId: 'org-a' }),
    ]);

    const successes = results.filter(Boolean).length;
    expect(successes).toBe(1);
    expect(await countRows(db, 'manual_pilot_credit_debits')).toBe(1);
    expect(await countRows(db, 'mcu_mission_debits')).toBe(1);
    expect(await countRows(db, 'mcu_transactions')).toBe(1);
    expect(await getManualPilotCreditBalance(db, 'user-a', 'org-a')).toBe(75);
  });

  it('rejects debit atomically when pilot grant balance is insufficient', async () => {
    const db = await createPilotDb();
    await seedPilotGrant(db, {
      orderId: 'order-a-low',
      userId: 'user-a',
      orgId: 'org-a',
      granted: 20,
    });

    const debited = await executeMissionDebitBatch(db, {
      userId: 'user-a',
      amount: 50,
      missionId: 'mission-a-1',
      orgId: 'org-a',
    });

    expect(debited).toBe(false);
    expect(await countRows(db, 'manual_pilot_credit_debits')).toBe(0);
    expect(await countRows(db, 'mcu_mission_debits')).toBe(0);
    expect(await countRows(db, 'mcu_transactions')).toBe(0);
    expect(await getManualPilotCreditBalance(db, 'user-a', 'org-a')).toBe(20);
  });

  it('rejects debit atomically when pilot grant is expired', async () => {
    const db = await createPilotDb();
    await seedPilotGrant(db, {
      orderId: 'order-a-expired',
      userId: 'user-a',
      orgId: 'org-a',
      granted: 100,
      expiresAt: '2000-01-01T00:00:00.000Z',
    });

    const debited = await executeMissionDebitBatch(db, {
      userId: 'user-a',
      amount: 10,
      missionId: 'mission-a-1',
      orgId: 'org-a',
    });

    expect(debited).toBe(false);
    expect(await countRows(db, 'manual_pilot_credit_debits')).toBe(0);
    expect(await countRows(db, 'mcu_mission_debits')).toBe(0);
    expect(await countRows(db, 'mcu_transactions')).toBe(0);
    expect(await getManualPilotCreditBalance(db, 'user-a', 'org-a')).toBe(0);
  });

  it('rejects debit atomically when pilot entitlement or grant is revoked', async () => {
    const db = await createPilotDb();
    await seedPilotGrant(db, {
      orderId: 'order-a-revoked',
      userId: 'user-a',
      orgId: 'org-a',
      granted: 100,
      revokedAt: '2025-01-01T00:00:00.000Z',
    });

    const debited = await executeMissionDebitBatch(db, {
      userId: 'user-a',
      amount: 10,
      missionId: 'mission-a-1',
      orgId: 'org-a',
    });

    expect(debited).toBe(false);
    expect(await countRows(db, 'manual_pilot_credit_debits')).toBe(0);
    expect(await countRows(db, 'mcu_mission_debits')).toBe(0);
    expect(await countRows(db, 'mcu_transactions')).toBe(0);
    expect(await getManualPilotCreditBalance(db, 'user-a', 'org-a')).toBe(0);
  });

  it('prevents a wrong-owner mission from debiting another tenant pilot grant', async () => {
    const db = await createPilotDb();
    await seedPilotGrant(db, {
      orderId: 'order-a-tenant',
      userId: 'user-a',
      orgId: 'org-a',
      granted: 100,
    });

    // Attempt 1: user-b tries to charge their mission against user-a's org-a grant
    const crossOrgAttempt = await executeMissionDebitBatch(db, {
      userId: 'user-b',
      amount: 25,
      missionId: 'mission-b-1',
      orgId: 'org-a',
    });

    // Attempt 2: debiting user-b's mission while passing user-a as the payer
    const wrongMissionOwnerAttempt = await executeMissionDebitBatch(db, {
      userId: 'user-a',
      amount: 25,
      missionId: 'mission-b-1',
      orgId: 'org-a',
    });

    expect(crossOrgAttempt).toBe(false);
    expect(wrongMissionOwnerAttempt).toBe(false);
    expect(await countRows(db, 'manual_pilot_credit_debits')).toBe(0);
    expect(await countRows(db, 'mcu_mission_debits')).toBe(0);
    expect(await countRows(db, 'mcu_transactions')).toBe(0);
    expect(await getManualPilotCreditBalance(db, 'user-a', 'org-a')).toBe(100);
  });
});
