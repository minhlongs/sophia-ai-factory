// @vitest-environment node
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { approveAndActivateManualPilot } from '@/land/payments/manual-pilot/manual-pilot-activation';
import { createManualPilotSettlementRow } from '@/land/payments/manual-pilot/manual-pilot-repo';
import { ingestManualPilotEvidence } from '@/land/payments/manual-pilot/manual-pilot-evidence';
import { transitionManualPilot } from '@/land/payments/manual-pilot/manual-pilot-transitions';

const handles = vi.hoisted(() => new Set<DatabaseSync>());
vi.mock('@/seed/db/node-sqlite/migrations', () => ({
  applyMigrations: (handle: DatabaseSync) => { handles.add(handle); },
}));
const dirs: string[] = [];
afterEach(() => {
  for (const handle of handles) handle.close();
  handles.clear();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function connect(path: string) {
  const db = new NodeSqliteD1Database(path);
  const handle = [...handles].at(-1)!;
  return { db, close() { handle.close(); handles.delete(handle); } };
}

const order = { orderId: 'pilot-order', orgId: 'pilot-org', userId: 'customer', transferReference: 'pilot-reference' };
const adminId = 'admin';
const amount = 1_990_000;
const activate = (db: NodeSqliteD1Database) => approveAndActivateManualPilot(db, {
  orderId: order.orderId, adminId, receivedAmountVnd: amount, bankTransactionRef: 'not-bank-proof',
});

async function approvedFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'sophia-pilot-durability-'));
  dirs.push(dir);
  const path = join(dir, 'pilot.sqlite');
  connect(path).close();
  copyFileSync(path, join(dir, 'before-schema.sqlite'));
  const connection = connect(path);
  const { db } = connection;
  for (const migration of [
    '0001-init.sql', '0004-user-profiles.sql', '0070-pending-orders.sql', '0272_user_profiles_role.sql',
    '0506_manual_pilot_settlement_ledger.sql', '0507_manual_pilot_financial_state.sql',
    '0508_manual_pilot_audit_integrity.sql', '0509_manual_pilot_credit_compensation.sql',
    '0510_manual_pilot_delivery_evidence.sql', '0511_manual_pilot_refund_intake.sql',
  ]) await db.exec(readFileSync(join('migrations', migration), 'utf8'));
  await db.exec(`INSERT INTO organizations(id,name) VALUES ('pilot-org','Pilot');
    INSERT INTO org_members(user_id,org_id) VALUES ('customer','pilot-org');
    INSERT INTO user_profiles(user_id,role) VALUES ('admin','admin');
    INSERT INTO pending_orders (order_id,user_id,tier,period,payment_method,amount_usd_cents)
      VALUES ('pilot-order','customer','BASIC','pilot_14d','manual_bank_transfer',0);`);
  expect(await createManualPilotSettlementRow(db, order)).toMatchObject({ ok: true });
  const evidence = await ingestManualPilotEvidence(db, { ...order, artifactId: 'bank-artifact',
    expectedAccountIdentity: 'platform-account' }, { verify: async () => ({
    direction: 'inbound', bankIdentity: 'fixture-bank', accountIdentity: 'platform-account',
    transactionIdentity: 'fixture-bank-transaction', amountVnd: amount, currency: 'VND',
    settledAt: '2026-01-01T00:00:00.000Z', orderReference: order.transferReference,
    artifactSha256: 'a'.repeat(64), source: 'fixture-bank-artifact', verifier: 'fixture-independent-verifier',
  }) });
  if (!evidence.ok) throw new Error(evidence.error.message);
  for (const target of ['BANK_SETTLEMENT_VERIFIED', 'RECONCILED', 'ADMIN_APPROVED'] as const) {
    expect(await transitionManualPilot(db, { ...order, adminId, target, evidenceId: evidence.value.evidenceId }))
      .toMatchObject({ ok: true });
  }
  connection.close();
  copyFileSync(path, join(dir, 'before-activation.sqlite'));
  return path;
}

async function snapshot(db: NodeSqliteD1Database) {
  return Promise.all(['pending_orders', 'manual_pilot_settlements', 'manual_pilot_financial_state',
    'manual_pilot_bank_evidence', 'manual_pilot_credit_grants', 'manual_pilot_entitlements',
    'manual_pilot_financial_events', 'manual_pilot_audit_log'].map(async (table) =>
    (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results));
}

async function expectActivatedExactlyOnce(db: NodeSqliteD1Database) {
  expect((await db.prepare('SELECT granted,consumed,revoked FROM manual_pilot_credit_grants').all()).results)
    .toEqual([{ granted: 500, consumed: 0, revoked: 0 }]);
  expect(await db.prepare('SELECT count(*) AS n FROM manual_pilot_entitlements').first('n')).toBe(1);
  expect(await db.prepare('SELECT status FROM pending_orders').first('status')).toBe('completed');
  expect(await db.prepare('SELECT state,attempt_token FROM manual_pilot_financial_state').first())
    .toEqual({ state: 'ACTIVE_14D', attempt_token: null });
  expect(await db.prepare('SELECT status,received_amount_vnd,bank_transaction_ref FROM manual_pilot_settlements').first())
    .toEqual({ status: 'activated', received_amount_vnd: amount, bank_transaction_ref: 'fixture-bank-transaction' });
  expect((await db.prepare('SELECT to_state FROM manual_pilot_financial_events ORDER BY rowid').all()).results)
    .toEqual(['BANK_SETTLEMENT_VERIFIED', 'RECONCILED', 'ADMIN_APPROVED', 'ACTIVE_14D'].map(to_state => ({ to_state })));
  expect(await db.prepare("SELECT count(*) AS n FROM manual_pilot_audit_log WHERE action='approved_and_activated'").first('n')).toBe(1);
}

const deniedReplay = { ok: false, error: { code: 'INVALID_STATE' } };
describe('manual pilot activation on a disposable SQLite file', () => {
  it('rolls back a late write failure, retries after reopen, and preserves committed effects across another reopen', async () => {
    const path = await approvedFixture();
    const attempt = connect(path);
    const before = await snapshot(attempt.db);
    await attempt.db.exec(`CREATE TRIGGER fail_activation BEFORE INSERT ON manual_pilot_audit_log
      WHEN NEW.action='approved_and_activated' BEGIN SELECT RAISE(ABORT,'injected failure'); END;`);
    expect(await activate(attempt.db)).toMatchObject({ ok: false, error: { code: 'DB_ERROR' } });
    attempt.close();

    const retry = connect(path);
    expect(await snapshot(retry.db)).toEqual(before);
    await retry.db.exec('DROP TRIGGER fail_activation');
    expect(await activate(retry.db)).toMatchObject({ ok: true });
    await expectActivatedExactlyOnce(retry.db);
    const committed = await snapshot(retry.db);
    retry.close();

    const reopened = connect(path);
    expect(await snapshot(reopened.db)).toEqual(committed);
    expect(await activate(reopened.db)).toMatchObject(deniedReplay);
    expect(await snapshot(reopened.db)).toEqual(committed);
  });

  it('allows only one of two concurrent requests on separate SQLite connections to commit', async () => {
    const path = await approvedFixture();
    const first = connect(path);
    const second = connect(path);
    expect(await first.db.prepare('SELECT state FROM manual_pilot_financial_state').first('state')).toBe('ADMIN_APPROVED');
    expect(await second.db.prepare('SELECT state FROM manual_pilot_financial_state').first('state')).toBe('ADMIN_APPROVED');
    let resolve!: () => void;
    const promise = new Promise<void>((release) => { resolve = release; });
    let contenders = 0;
    for (const { db } of [first, second]) {
      const batch = db.batch.bind(db);
      vi.spyOn(db, 'batch').mockImplementationOnce(async (statements) => {
        if (++contenders === 2) resolve();
        await promise;
        return batch(statements);
      });
    }
    const results = await Promise.all([activate(first.db), activate(second.db)]);
    expect(contenders).toBe(2);
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect(results.find(result => !result.ok)).toMatchObject(deniedReplay);
    await expectActivatedExactlyOnce(second.db);
    const committed = await snapshot(second.db);
    for (const { db } of [first, second]) {
      expect(await activate(db)).toMatchObject(deniedReplay);
      expect(await snapshot(db)).toEqual(committed);
    }
  });
});
