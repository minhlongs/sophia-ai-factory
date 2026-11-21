// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { D1PreparedStatement } from '@cloudflare/workers-types';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { approveAndActivateManualPilot, rejectManualPilotSettlement } from '@/land/payments/manual-pilot/manual-pilot-activation';
import { transitionManualPilot } from '@/land/payments/manual-pilot/manual-pilot-transitions';
import { receiveManualPilotRefundIntake } from '@/land/payments/manual-pilot/manual-pilot-refund-intake';
import { transitionPilotRefund } from '@/land/payments/manual-pilot/manual-pilot-refund-transitions';

vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));
afterEach(() => vi.useRealTimers());
const transitions = ['BANK_SETTLEMENT_VERIFIED', 'RECONCILED', 'ADMIN_APPROVED'] as const;
const refunds = ['APPROVED', 'TRANSFER_PENDING', 'SETTLED'] as const;
type Stage = 'activate' | 'reject' | typeof transitions[number] | typeof refunds[number];
const stages: Stage[] = ['activate', 'reject', ...transitions, ...refunds];
const now = '2026-11-19T10:00:00.000Z';
const initial: Record<Stage, string> = { activate: 'ADMIN_APPROVED', reject: 'ADMIN_APPROVED',
  BANK_SETTLEMENT_VERIFIED: 'PENDING_ORDER', RECONCILED: 'BANK_SETTLEMENT_VERIFIED',
  ADMIN_APPROVED: 'RECONCILED', APPROVED: 'ACTIVE_14D', TRANSFER_PENDING: 'ACTIVE_14D', SETTLED: 'ACTIVE_14D' };
async function fixture(stage: Stage) {
  const db = new NodeSqliteD1Database(':memory:');
  for (const file of ['0506_manual_pilot_settlement_ledger.sql', '0507_manual_pilot_financial_state.sql',
    '0508_manual_pilot_audit_integrity.sql', '0509_manual_pilot_credit_compensation.sql',
    '0510_manual_pilot_delivery_evidence.sql', '0511_manual_pilot_refund_intake.sql']) {
    await db.exec(readFileSync(resolve('migrations', file), 'utf8'));
  }
  await db.exec(`CREATE TABLE user_profiles(user_id TEXT PRIMARY KEY,role TEXT);
    CREATE TABLE org_members(user_id TEXT,org_id TEXT);
    INSERT INTO org_members VALUES('user','org');
    CREATE TABLE pending_orders(order_id TEXT PRIMARY KEY,status TEXT);
    CREATE TABLE user_mcu_balance(user_id TEXT PRIMARY KEY,credits_remaining REAL,credits_total_used REAL,updated_at TEXT);
    CREATE TABLE mcu_transactions(user_id TEXT,delta REAL,reason TEXT,mission_id TEXT,metadata TEXT);
    INSERT INTO user_profiles VALUES('admin','admin');
    INSERT INTO pending_orders VALUES('order','pending');
    INSERT INTO user_mcu_balance VALUES('user',1000,175.25,'${now}'),('other-user',250,0,'${now}');
    INSERT INTO manual_pilot_settlements(id,order_id,user_id,org_id,expected_amount_vnd,transfer_reference)
      VALUES('settlement','order','user','org',1990000,'reference'),
        ('other-settlement','other-order','other-user','other-org',1990000,'other-reference');
    INSERT INTO manual_pilot_financial_state VALUES('other-order','other-org','ACTIVE_14D',NULL,NULL,'${now}');
    INSERT INTO manual_pilot_credit_grants VALUES('other-order','other-user','other-org',500,20,0,'2099-01-01');
    INSERT INTO manual_pilot_entitlements VALUES('other-order','other-user','other-org','${now}','2099-01-01',NULL);
    INSERT INTO manual_pilot_financial_events VALUES('historical-event','other-order','ADMIN_APPROVED','ACTIVE_14D','admin',NULL,'${now}');
    INSERT INTO manual_pilot_audit_log(id,settlement_id,order_id,action,actor_role)
      VALUES('historical-audit','other-settlement','other-order','created','system');`);
  await db.prepare('INSERT INTO manual_pilot_financial_state VALUES(?,?,?,?,NULL,?)')
    .bind('order', 'org', initial[stage], stage === 'BANK_SETTLEMENT_VERIFIED' ? null : 'in', now).run();
  for (const direction of ['inbound', 'outbound']) {
    await db.prepare('INSERT INTO manual_pilot_bank_evidence VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(direction === 'inbound' ? 'in' : 'out', 'order', 'org', direction, 'bank', 'account',
        direction, 1990000, 'VND', now, 'reference', 'a'.repeat(64), 'fixture', 'verifier', now).run();
  }
  if (initial[stage] === 'ACTIVE_14D') {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(now));
    const prior = { APPROVED: 'REQUESTED', TRANSFER_PENDING: 'APPROVED', SETTLED: 'TRANSFER_PENDING' };
    await db.exec(`UPDATE manual_pilot_settlements SET status='activated',received_amount_vnd=1990000,
      activated_at='${now}',entitlement_period_end='2099-01-01',granted_mcu=500 WHERE order_id='order';
      INSERT INTO manual_pilot_credit_grants VALUES('order','user','org',500,175.25,0,'2099-01-01');
      INSERT INTO manual_pilot_entitlements VALUES('order','user','org','${now}','2099-01-01',NULL);`);
    const intake = await receiveManualPilotRefundIntake(db, { orderId: 'order', orgId: 'org',
      category: 'goodwill_7d', reason: 'goodwill', beneficiaryBankIdentity: 'customer-bank',
      beneficiaryAccountIdentity: 'customer-account' }, 'user');
    if (!intake.ok) throw new Error(intake.error.message);
    await db.exec(`UPDATE manual_pilot_settlements SET status='refund_pending' WHERE order_id='order';
      INSERT INTO manual_pilot_bank_counterparties VALUES('out','customer-bank','customer-account')`);
    await db.prepare(`INSERT INTO manual_pilot_refund_state
      (order_id,state,amount_vnd,category,evidence_id,requested_at,updated_at,intake_id)
      VALUES(?,?,1990000,'goodwill_7d',NULL,?,?,?)`)
      .bind('order', prior[stage as keyof typeof prior], now, now, intake.value.intakeId).run();
  }
  return db;
}
async function snapshot(db: NodeSqliteD1Database) {
  return Promise.all(['manual_pilot_financial_state', 'manual_pilot_settlements', 'manual_pilot_bank_evidence',
    'manual_pilot_credit_grants', 'manual_pilot_entitlements', 'manual_pilot_refund_state',
    'manual_pilot_financial_events', 'manual_pilot_audit_log', 'pending_orders', 'user_mcu_balance', 'mcu_transactions']
    .map(async (table) => (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results));
}
function run(db: NodeSqliteD1Database, stage: Stage, adminId = 'admin') {
  const input = { orderId: 'order', adminId, nowMs: Date.parse(now) };
  if (stage === 'activate') return approveAndActivateManualPilot(db, {
    ...input, receivedAmountVnd: 1990000, bankTransactionRef: 'not-proof',
  });
  if (stage === 'reject') return rejectManualPilotSettlement(db, input);
  if (stage === 'APPROVED' || stage === 'TRANSFER_PENDING' || stage === 'SETTLED') {
    return transitionPilotRefund(db, { ...input, target: stage, evidenceId: stage === 'SETTLED' ? 'out' : undefined });
  }
  return transitionManualPilot(db, { ...input, orgId: 'org', evidenceId: 'in', target: stage });
}
const ignored: [Stage, 'INSERT' | 'UPDATE', string, string][] = [];
for (const table of ['manual_pilot_credit_grants', 'manual_pilot_entitlements', 'manual_pilot_financial_events', 'manual_pilot_audit_log']) {
  ignored.push(['activate', 'INSERT', table, '']);
}
ignored.push(['activate', 'UPDATE', 'manual_pilot_settlements', '']);
ignored.push(['activate', 'UPDATE', 'pending_orders', '']);
for (const stage of stages) {
  ignored.push([stage, 'UPDATE', 'manual_pilot_financial_state', 'WHEN OLD.attempt_token IS NOT NULL AND NEW.attempt_token IS NULL']);
}
for (const stage of [...transitions, ...refunds]) ignored.push([stage, 'INSERT', 'manual_pilot_financial_events', '']);
for (const stage of refunds) ignored.push([stage, 'UPDATE', 'manual_pilot_refund_state', '']);
for (const table of ['manual_pilot_credit_grants', 'manual_pilot_entitlements', 'manual_pilot_settlements']) {
  ignored.push(['SETTLED', 'UPDATE', table, '']);
}
ignored.push(['SETTLED', 'INSERT', 'manual_pilot_audit_log', '']);

describe('mandatory pilot effects fail before batch commit', () => {
  it.each(ignored)('%s rolls back ignored %s on %s %s', async (stage, operation, table, condition) => {
    const db = await fixture(stage);
    await db.exec(`CREATE TRIGGER ignore_required BEFORE ${operation} ON ${table} ${condition}
      BEGIN SELECT RAISE(IGNORE); END;`);
    const before = await snapshot(db);
    expect(await run(db, stage)).toMatchObject({ ok: false, error: { code: 'DB_ERROR' } });
    expect(await snapshot(db)).toEqual(before);
  });
  it.each(stages)('%s commits once and makes identical batch and API replays inert', async (stage) => {
    const db = await fixture(stage);
    const batch = db.batch.bind(db);
    let replay: D1PreparedStatement[] = [];
    vi.spyOn(db, 'batch').mockImplementationOnce(async (statements) => { replay = statements; return batch(statements); });
    expect((await run(db, stage)).ok).toBe(true);
    expect(await db.prepare('SELECT attempt_token FROM manual_pilot_financial_state WHERE order_id=\'order\'').first('attempt_token')).toBeNull();
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_financial_events WHERE order_id=\'order\'').first('n')).toBe(1);
    if (stage === 'activate') expect(await db.prepare("SELECT status FROM pending_orders WHERE order_id='order'").first('status')).toBe('completed');
    const committed = await snapshot(db);
    await batch(replay);
    expect((await run(db, stage)).ok).toBe(false);
    expect(await snapshot(db)).toEqual(committed);
  });
  it.each(stages)('%s preserves all rows when current admin is revoked', async (stage) => {
    const db = await fixture(stage);
    await db.exec("UPDATE user_profiles SET role='user'");
    const before = await snapshot(db);
    expect((await run(db, stage)).ok).toBe(false);
    expect(await snapshot(db)).toEqual(before);
  });
  it.each(stages)('%s revalidates admin demotion immediately before claiming', async (stage) => {
    const db = await fixture(stage);
    const before = await snapshot(db);
    const batch = db.batch.bind(db);
    vi.spyOn(db, 'batch').mockImplementationOnce(async (statements) => {
      await db.exec("UPDATE user_profiles SET role='user'");
      return batch(statements);
    });
    expect((await run(db, stage)).ok).toBe(false);
    expect(await snapshot(db)).toEqual(before);
  });
  it.each(['activate', 'BANK_SETTLEMENT_VERIFIED', 'SETTLED'] as const)('%s permits one concurrent claim only', async (stage) => {
    const db = await fixture(stage);
    expect((await Promise.all([run(db, stage), run(db, stage)])).filter((result) => result.ok)).toHaveLength(1);
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_financial_events WHERE order_id=\'order\'').first('n')).toBe(1);
  });
  it.each(['manual_pilot_credit_grants', 'manual_pilot_entitlements'])('does not refund a mismatched tenant in %s', async (table) => {
    const db = await fixture('SETTLED');
    await db.exec(`UPDATE ${table} SET org_id='other-org' WHERE order_id='order'`);
    const before = await snapshot(db);
    expect(await run(db, 'SETTLED')).toMatchObject({ ok: false, error: { code: 'DB_ERROR' } });
    expect(await snapshot(db)).toEqual(before);
  });
  it('revokes only the unconsumed pilot remainder, preserving purchased and other-tenant balances', async () => {
    const db = await fixture('SETTLED');
    expect((await run(db, 'SETTLED')).ok).toBe(true);
    expect(await db.prepare('SELECT consumed,revoked FROM manual_pilot_credit_grants WHERE order_id=\'order\'').first())
      .toEqual({ consumed: 175.25, revoked: 324.75 });
    expect(await db.prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id=\'user\'').first('credits_remaining')).toBe(1000);
    expect(await db.prepare('SELECT consumed,revoked FROM manual_pilot_credit_grants WHERE order_id=\'other-order\'').first())
      .toEqual({ consumed: 20, revoked: 0 });
    expect(await db.prepare('SELECT revoked_at FROM manual_pilot_entitlements WHERE order_id=\'other-order\'').first('revoked_at')).toBeNull();
  });
  it('settles a fully consumed grant with a zero remaining revocation and an audit event', async () => {
    const db = await fixture('SETTLED');
    await db.exec("UPDATE manual_pilot_credit_grants SET consumed=500 WHERE order_id='order'");
    expect((await run(db, 'SETTLED')).ok).toBe(true);
    expect(await db.prepare('SELECT consumed,revoked FROM manual_pilot_credit_grants WHERE order_id=\'order\'').first())
      .toEqual({ consumed: 500, revoked: 0 });
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_audit_log WHERE order_id=\'order\'').first('n')).toBe(1);
  });
  it.each(['manual_pilot_credit_grants', 'manual_pilot_entitlements'])('preserves existing %s when activation would conflict', async (table) => {
    const db = await fixture('activate');
    await db.exec(table === 'manual_pilot_credit_grants'
      ? "INSERT INTO manual_pilot_credit_grants VALUES('order','user','org',500,120,0,'2099-01-01')"
      : `INSERT INTO manual_pilot_entitlements VALUES('order','user','org','${now}','2099-01-01',NULL)`);
    const before = await snapshot(db);
    expect(await run(db, 'activate')).toMatchObject({ ok: false, error: { code: 'DB_ERROR' } });
    expect(await snapshot(db)).toEqual(before);
  });
  it('records immutable activation and settled-refund audit entries', async () => {
    for (const stage of ['activate', 'SETTLED'] as const) {
      const db = await fixture(stage);
      expect((await run(db, stage)).ok).toBe(true);
      expect(await db.prepare('SELECT action FROM manual_pilot_audit_log WHERE order_id=\'order\'').first('action'))
        .toBe(stage === 'activate' ? 'approved_and_activated' : 'refund_confirmed');
      await expect(db.exec("DELETE FROM manual_pilot_audit_log WHERE order_id='order'")).rejects.toThrow('immutable');
      await expect(db.exec("UPDATE manual_pilot_financial_events SET actor_id='changed' WHERE order_id='order'"))
        .rejects.toThrow('immutable');
    }
  });
});
