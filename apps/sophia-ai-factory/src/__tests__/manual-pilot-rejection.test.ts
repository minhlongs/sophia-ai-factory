// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { D1PreparedStatement } from '@cloudflare/workers-types';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { approveAndActivateManualPilot, rejectManualPilotSettlement } from '@/land/payments/manual-pilot/manual-pilot-activation';
import { transitionManualPilot } from '@/land/payments/manual-pilot/manual-pilot-transitions';
vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));
const rejection = { orderId: 'order', adminId: 'admin', auditNotes: 'Bank review declined' };
const activation = { ...rejection, receivedAmountVnd: 1990000, bankTransactionRef: 'ignored' };
const transition = { ...rejection, orgId: 'org', evidenceId: 'evidence' };
const priorStates = ['PENDING_ORDER', 'BANK_SETTLEMENT_VERIFIED', 'RECONCILED', 'ADMIN_APPROVED', 'LEGACY_REVIEW'];
const legalTargets = ['BANK_SETTLEMENT_VERIFIED', 'RECONCILED', 'ADMIN_APPROVED'] as const;
async function fixture(state = 'ADMIN_APPROVED', status = 'pending_manual_payment', auditMigration = true) {
  const db = new NodeSqliteD1Database(':memory:');
  for (const file of ['0506_manual_pilot_settlement_ledger.sql', '0507_manual_pilot_financial_state.sql',
    ...(auditMigration ? ['0508_manual_pilot_audit_integrity.sql'] : []),
    '0509_manual_pilot_credit_compensation.sql', '0510_manual_pilot_delivery_evidence.sql',
    '0511_manual_pilot_refund_intake.sql']) {
    await db.exec(readFileSync(resolve('migrations', file), 'utf8'));
  }
  await db.exec(`CREATE TABLE user_profiles(user_id TEXT PRIMARY KEY,role TEXT);
    CREATE TABLE pending_orders(order_id TEXT PRIMARY KEY,status TEXT);
    INSERT INTO user_profiles VALUES('admin','admin');
    INSERT INTO pending_orders VALUES('order','pending');
    INSERT INTO manual_pilot_settlements(id,order_id,user_id,org_id,expected_amount_vnd,transfer_reference)
      VALUES('settlement','order','user','org',1990000,'reference');
    INSERT INTO manual_pilot_bank_evidence VALUES('evidence','order','org','inbound','bank','account',
      'bank-transaction',1990000,'VND','2026-11-19','reference','${'a'.repeat(64)}','fixture','verifier','2026-11-19');`);
  await db.prepare('INSERT INTO manual_pilot_financial_state VALUES(?,?,?,?,NULL,?)')
    .bind('order', 'org', state, state === 'PENDING_ORDER' ? null : 'evidence', '2026-11-19').run();
  await db.prepare('UPDATE manual_pilot_settlements SET status=?').bind(status).run();
  return db;
}
async function snapshot(db: NodeSqliteD1Database) {
  const tables = ['manual_pilot_settlements', 'manual_pilot_financial_state', 'pending_orders',
    'manual_pilot_financial_events', 'manual_pilot_audit_log', 'manual_pilot_credit_grants', 'manual_pilot_entitlements'];
  return Promise.all(tables.map(async (table) => (await db.prepare(`SELECT * FROM ${table}`).all()).results));
}
describe('terminal manual pilot rejection', () => {
  for (const state of priorStates) {
    it.each(['pending_manual_payment', 'under_review'])('rejects ' + state + ' from %s permanently', async (status) => {
      const db = await fixture(state, status);
      expect((await rejectManualPilotSettlement(db, rejection)).ok).toBe(true);
      expect(await db.prepare('SELECT state,attempt_token FROM manual_pilot_financial_state').first())
        .toEqual({ state: 'REJECTED', attempt_token: null });
      expect(await db.prepare('SELECT status FROM pending_orders').first('status')).toBe('failed');
      expect(await db.prepare('SELECT status FROM manual_pilot_settlements').first('status')).toBe('rejected');
      expect(await db.prepare('SELECT from_state,to_state,actor_id FROM manual_pilot_financial_events').first())
        .toEqual({ from_state: state, to_state: 'REJECTED', actor_id: 'admin' });
      expect(await db.prepare('SELECT action,actor_admin_id,actor_role FROM manual_pilot_audit_log').first())
        .toEqual({ action: 'rejected', actor_admin_id: 'admin', actor_role: 'admin' });
      const rejected = await snapshot(db);
      for (const target of legalTargets) expect((await transitionManualPilot(db, { ...transition, target })).ok).toBe(false);
      expect((await approveAndActivateManualPilot(db, activation)).ok).toBe(false);
      expect((await rejectManualPilotSettlement(db, rejection)).ok).toBe(false);
      expect(await snapshot(db)).toEqual(rejected);
      expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_credit_grants').first('n')).toBe(0);
      expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_entitlements').first('n')).toBe(0);
    });
  }
  it.each(['activated', 'rejected', 'refund_pending', 'refunded'])('preserves incompatible settlement %s', async (status) => {
    const db = await fixture('ADMIN_APPROVED', status);
    const before = await snapshot(db);
    expect((await rejectManualPilotSettlement(db, rejection)).ok).toBe(false);
    expect((await approveAndActivateManualPilot(db, activation)).ok).toBe(false);
    expect(await snapshot(db)).toEqual(before);
  });
  it.each(legalTargets)('blocks %s on a rejected compatibility record with stale financial state', async (target) => {
    const state = { BANK_SETTLEMENT_VERIFIED: 'PENDING_ORDER', RECONCILED: 'BANK_SETTLEMENT_VERIFIED', ADMIN_APPROVED: 'RECONCILED' }[target];
    const db = await fixture(state, 'rejected');
    const before = await snapshot(db);
    expect((await transitionManualPilot(db, { ...transition, target })).ok).toBe(false);
    expect(await snapshot(db)).toEqual(before);
  });
  it.each(['ACTIVE_14D', 'REJECTED'])('cannot reject financial state %s through a stale pending record', async (state) => {
    const db = await fixture(state);
    const before = await snapshot(db);
    expect((await rejectManualPilotSettlement(db, rejection)).ok).toBe(false);
    expect(await snapshot(db)).toEqual(before);
  });
  it.each(['admin', 'missing', ''])('rejects missing or revoked current admin %s without any mutation', async (adminId) => {
    const db = await fixture();
    await db.exec("UPDATE user_profiles SET role='user'");
    const before = await snapshot(db);
    expect((await rejectManualPilotSettlement(db, { ...rejection, adminId })).ok).toBe(false);
    expect(await snapshot(db)).toEqual(before);
  });
  it.each(['mismatched tenant', 'missing financial state', 'claimed attempt'])('fails closed for %s', async (condition) => {
    const db = await fixture();
    await db.exec(condition === 'mismatched tenant' ? "UPDATE manual_pilot_settlements SET org_id='other'"
      : condition === 'missing financial state' ? 'DELETE FROM manual_pilot_financial_state'
        : "UPDATE manual_pilot_financial_state SET attempt_token='owned-by-other'");
    const before = await snapshot(db);
    expect((await rejectManualPilotSettlement(db, rejection)).ok).toBe(false);
    expect((await approveAndActivateManualPilot(db, activation)).ok).toBe(false);
    expect(await snapshot(db)).toEqual(before);
  });
  it('revalidates admin at the claim after an authorized lookup', async () => {
    const db = await fixture();
    const before = await snapshot(db);
    const batch = db.batch.bind(db);
    vi.spyOn(db, 'batch').mockImplementationOnce(async (statements) => {
      await db.exec("UPDATE user_profiles SET role='user'");
      return batch(statements);
    });
    expect((await rejectManualPilotSettlement(db, rejection)).ok).toBe(false);
    expect(await snapshot(db)).toEqual(before);
  });
  it('does not claim after activation wins between rejection lookup and batch', async () => {
    const db = await fixture();
    const batch = db.batch.bind(db);
    let afterActivation: Awaited<ReturnType<typeof snapshot>> = [];
    vi.spyOn(db, 'batch').mockImplementationOnce(async (statements) => {
      expect((await approveAndActivateManualPilot(db, activation)).ok).toBe(true);
      afterActivation = await snapshot(db);
      return batch(statements);
    });
    expect((await rejectManualPilotSettlement(db, rejection)).ok).toBe(false);
    expect(await snapshot(db)).toEqual(afterActivation);
  });
  it('blocks a stale activation batch after rejection wins', async () => {
    const db = await fixture();
    const batch = db.batch.bind(db);
    let afterRejection: Awaited<ReturnType<typeof snapshot>> = [];
    vi.spyOn(db, 'batch').mockImplementationOnce(async (statements) => {
      expect((await rejectManualPilotSettlement(db, rejection)).ok).toBe(true);
      afterRejection = await snapshot(db);
      return batch(statements);
    });
    expect((await approveAndActivateManualPilot(db, activation)).ok).toBe(false);
    expect(await snapshot(db)).toEqual(afterRejection);
  });
  it('makes an identical successful batch replay inert', async () => {
    const db = await fixture();
    const batch = db.batch.bind(db);
    let replay: D1PreparedStatement[] = [];
    vi.spyOn(db, 'batch').mockImplementationOnce(async (statements) => {
      replay = statements;
      return batch(statements);
    });
    expect((await rejectManualPilotSettlement(db, rejection)).ok).toBe(true);
    const before = await snapshot(db);
    expect((await batch(replay)).every((result) => result.meta.changes === 0)).toBe(true);
    expect(await snapshot(db)).toEqual(before);
  });
  it.each(['rejection', 'activation'])('allows exactly one winner when %s races first', async (first) => {
    const db = await fixture();
    const reject = () => rejectManualPilotSettlement(db, rejection);
    const activate = () => approveAndActivateManualPilot(db, activation);
    const results = await Promise.all(first === 'rejection' ? [reject(), activate()] : [activate(), reject()]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const state = await db.prepare('SELECT state FROM manual_pilot_financial_state').first('state');
    const rejected = state === 'REJECTED';
    expect(['REJECTED', 'ACTIVE_14D']).toContain(state);
    expect(await db.prepare('SELECT status FROM manual_pilot_settlements').first('status')).toBe(rejected ? 'rejected' : 'activated');
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_credit_grants').first('n')).toBe(rejected ? 0 : 1);
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_entitlements').first('n')).toBe(rejected ? 0 : 1);
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_financial_events').first('n')).toBe(1);
  });
  it.each(['manual_pilot_settlements', 'pending_orders', 'manual_pilot_financial_events'])(
    'rolls back rejection when a mandatory write to %s is silently ignored', async (table) => {
      const db = await fixture();
      await db.exec(`CREATE TRIGGER ignore_effect BEFORE ${table === 'manual_pilot_financial_events' ? 'INSERT' : 'UPDATE'} ON ${table}
        BEGIN SELECT RAISE(IGNORE); END;`);
      const before = await snapshot(db);
      const result = await rejectManualPilotSettlement(db, rejection);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('DB_ERROR');
      expect(await snapshot(db)).toEqual(before);
    });
  it.each(['ABORT', 'IGNORE'])('rolls back every rejection effect if audit insertion raises %s', async (mode) => {
    const db = await fixture();
    await db.exec(`CREATE TRIGGER fail_audit BEFORE INSERT ON manual_pilot_audit_log
      BEGIN SELECT RAISE(${mode}${mode === 'ABORT' ? ", 'injected audit failure'" : ''}); END;`);
    const before = await snapshot(db);
    const result = await rejectManualPilotSettlement(db, rejection);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR');
    expect(await snapshot(db)).toEqual(before);
  });
  it('preserves existing audit rows on migration replay and prevents update/delete', async () => {
    const db = await fixture('PENDING_ORDER', 'pending_manual_payment', false);
    await db.exec(`INSERT INTO manual_pilot_audit_log(id,settlement_id,order_id,action,actor_role)
      VALUES('historical','settlement','order','created','system')`);
    const before = await snapshot(db);
    const migration = readFileSync(resolve('migrations/0508_manual_pilot_audit_integrity.sql'), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    expect(await snapshot(db)).toEqual(before);
    await expect(db.exec("UPDATE manual_pilot_audit_log SET metadata_json='changed'")).rejects.toThrow('immutable');
    await expect(db.exec('DELETE FROM manual_pilot_audit_log')).rejects.toThrow('immutable');
    await expect(db.exec(`INSERT OR REPLACE INTO manual_pilot_audit_log(id,settlement_id,order_id,action,actor_role)
      VALUES('historical','settlement','order','rejected','admin')`)).rejects.toThrow('immutable');
    await expect(db.exec(`INSERT OR REPLACE INTO manual_pilot_audit_log(rowid,id,settlement_id,order_id,action,actor_role)
      SELECT rowid,'replacement','settlement','order','rejected','admin' FROM manual_pilot_audit_log`)).rejects.toThrow('immutable');
    expect(await snapshot(db)).toEqual(before);
    expect((await rejectManualPilotSettlement(db, rejection)).ok).toBe(true);
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_audit_log').first('n')).toBe(2);
  });
});
