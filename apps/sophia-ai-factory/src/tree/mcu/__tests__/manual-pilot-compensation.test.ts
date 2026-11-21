// @vitest-environment node
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { GET } from '@/app/api/cron/mission-reaper/route';
import { D1Client } from '@/seed/db/client-rpc';
import { finalizeMissionExecution } from '@/forest/missions/dispatcher-ops/mission-state-helpers';
import { receiveManualPilotRefundIntake } from '@/land/payments/manual-pilot/manual-pilot-refund-intake';
import { ingestManualPilotEvidence } from '@/land/payments/manual-pilot/manual-pilot-evidence';
import { transitionPilotRefund } from '@/land/payments/manual-pilot/manual-pilot-refund-transitions';
import { getManualPilotCreditBalance } from '@/seed/billing/manual-pilot-credit-allocation';
import { deductCredits, deductMissionCredits } from '../credits-repo';

const context = vi.hoisted(() => ({ db: undefined as D1Database | undefined, webhook: vi.fn(), clearCheckpoint: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: () => context.db, getD1Safe: () => context.db }));
vi.mock('@/forest/webhooks/missions/fire-webhook', () => ({ fireMissionWebhook: context.webhook }));
vi.mock('@/tree/missions/checkpoint-persistence', () => ({ clearMissionCheckpoint: context.clearCheckpoint }));
vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));
vi.mock('@/seed/security/cron-auth', () => ({ verifyCronAuth: () => null }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

async function fixture(installCompensation = true) {
  const db = new NodeSqliteD1Database(':memory:');
  for (const migration of [
    '0052-missions-engine', '0053-mcu-credits', '0506_manual_pilot_settlement_ledger',
    '0507_manual_pilot_financial_state', '0510_manual_pilot_delivery_evidence', '0511_manual_pilot_refund_intake',
  ]) {
    await db.exec(readFileSync(`migrations/${migration}.sql`, 'utf8'));
  }
  await db.exec(`
    CREATE TABLE org_members (org_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (org_id, user_id));
    INSERT INTO org_members VALUES ('org-a', 'alice'), ('org-b', 'alice');
    INSERT INTO user_mcu_balance (user_id,credits_remaining,credits_total_purchased) VALUES ('alice',200,200);
    INSERT INTO engine_missions (id,user_id,command,status,credits_used,created_at)
      VALUES ('mission','alice','ai:write','running',0,1);
  `);
  await grant(db, 'pilot-a', 'org-a', 80);
  await grant(db, 'pilot-b', 'org-b', 500);
  if (installCompensation) await migrate(db);
  context.db = db;
  return db;
}

async function migrate(db: D1Database) {
  await db.exec(readFileSync('migrations/0509_manual_pilot_credit_compensation.sql', 'utf8'));
}

async function grant(db: D1Database, order: string, org: string, amount: number) {
  await db.batch([
    db.prepare(`INSERT INTO manual_pilot_settlements(id,order_id,user_id,org_id,expected_amount_vnd,
      received_amount_vnd,transfer_reference,status,activated_at)
      VALUES (?1,?1,'alice',?2,1990000,1990000,?1,'activated','2000-01-01')`).bind(order, org),
    db.prepare(`INSERT INTO manual_pilot_financial_state(order_id,org_id,state,updated_at)
      VALUES (?,?,'ACTIVE_14D','2000-01-01')`).bind(order, org),
    db.prepare(`INSERT INTO manual_pilot_credit_grants(order_id,user_id,org_id,granted,expires_at)
      VALUES (?,'alice',?,?,'2200-01-01')`).bind(order, org, amount),
    db.prepare(`INSERT INTO manual_pilot_entitlements(order_id,user_id,org_id,starts_at,ends_at)
      VALUES (?,'alice',?,'2000-01-01','2200-01-01')`).bind(order, org),
  ]);
}

async function reap() {
  return (await GET(new NextRequest('http://localhost/api/cron/mission-reaper'))).json() as Promise<{ reaped: number }>;
}

const wallet = (db: D1Database) => db.prepare(
  "SELECT credits_remaining,credits_total_purchased FROM user_mcu_balance WHERE user_id='alice'",
).first();
const debit = async (amount = 110, orgId: string | undefined = 'org-a') => {
  const result = await deductMissionCredits('alice', amount, 'mission', 'command:ai:write', orgId);
  return result.ok && result.value;
};
const count = (db: D1Database, table: 'mcu_transactions' | 'mcu_mission_debits' | 'mcu_mission_compensations' | 'manual_pilot_credit_debits') =>
  db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first('n');

async function consumed(db: D1Database, orderId: string) {
  return db.prepare('SELECT consumed FROM manual_pilot_credit_grants WHERE order_id=?').bind(orderId).first('consumed');
}

describe('mission MCU source compensation', () => {
  it('restores mixed credits to each original grant and does not record a purchase', async () => {
    const db = await fixture();
    await grant(db, 'pilot-a2', 'org-a', 10);
    expect(await debit()).toBe(true);
    expect(await consumed(db, 'pilot-a')).toBe(80);
    expect(await consumed(db, 'pilot-a2')).toBe(10);
    expect(await wallet(db)).toEqual({ credits_remaining: 180, credits_total_purchased: 200 });
    expect(await reap()).toEqual({ ok: true, reaped: 1, credits_refunded: 110 });
    expect(await wallet(db)).toEqual({ credits_remaining: 200, credits_total_purchased: 200 });
    expect(await consumed(db, 'pilot-a')).toBe(0);
    expect(await consumed(db, 'pilot-a2')).toBe(0);
    expect(await consumed(db, 'pilot-b')).toBe(0);
    expect(await db.prepare(`SELECT user_id,org_id,amount,purchased,pilot_restored,pilot_withheld
      FROM mcu_mission_compensations`).first()).toEqual({
      user_id: 'alice', org_id: 'org-a', amount: 110, purchased: 20, pilot_restored: 90, pilot_withheld: 0,
    });
  });

  it.each([
    ['expired grant', `UPDATE manual_pilot_credit_grants SET expires_at='2000-01-01' WHERE order_id='pilot-a'`],
    ['expired entitlement', `UPDATE manual_pilot_entitlements SET ends_at='2000-01-01' WHERE order_id='pilot-a'`],
    ['revoked entitlement', `UPDATE manual_pilot_entitlements SET revoked_at='2000-01-01' WHERE order_id='pilot-a'`],
  ])('does not restore a pilot allocation with %s', async (_case, mutation) => {
    const db = await fixture();
    expect(await debit()).toBe(true);
    await db.exec(mutation);
    expect(await reap()).toEqual({ ok: true, reaped: 1, credits_refunded: 30 });
    expect(await wallet(db)).toEqual({ credits_remaining: 200, credits_total_purchased: 200 });
    expect(await consumed(db, 'pilot-a')).toBe(80);
    expect(await db.prepare('SELECT pilot_withheld FROM mcu_mission_compensations').first('pilot_withheld')).toBe(80);
  });

  it.each([
    ['pilot-only without a pre-existing wallet', 80, 'org-a', 0],
    ['purchased-only without a trusted tenant', 110, null, 200],
  ] as const)('restores a %s charge without creating a purchase', async (_name, amount, org, purchased) => {
    const db = await fixture();
    if (!purchased) await db.exec("DELETE FROM user_mcu_balance WHERE user_id='alice'");
    expect(await deductMissionCredits('alice', amount, 'mission', 'command:ai:write', org ?? undefined))
      .toEqual({ ok: true, value: true });
    expect(await reap()).toEqual({ ok: true, reaped: 1, credits_refunded: amount });
    expect(await wallet(db)).toEqual({ credits_remaining: purchased, credits_total_purchased: purchased });
    expect(await consumed(db, 'pilot-a')).toBe(0);
    expect(await consumed(db, 'pilot-b')).toBe(0);
  });

  it.each(['audit', 'ledger'])('rolls back %s failure and safely retries', async (blocked) => {
    const db = await fixture();
    expect(await debit()).toBe(true);
    await db.exec(`CREATE TRIGGER injected_failure BEFORE INSERT ON
      ${blocked === 'audit' ? 'mcu_mission_compensations' : 'mcu_transactions'}
      BEGIN SELECT RAISE(ABORT,'injected failure'); END`);
    const failed = await GET(new NextRequest('http://localhost/api/cron/mission-reaper'));
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ ok: false, reaped: 0, credits_refunded: 0, failed: 1 });
    expect(await wallet(db)).toEqual({ credits_remaining: 170, credits_total_purchased: 200 });
    expect(await consumed(db, 'pilot-a')).toBe(80);
    expect(await db.prepare('SELECT status FROM engine_missions').first('status')).toBe('running');
    expect(await count(db, 'mcu_mission_compensations')).toBe(0);
    await db.exec('DROP TRIGGER injected_failure');
    expect(await reap()).toEqual({ ok: true, reaped: 1, credits_refunded: 110 });
  });

  it('serializes concurrent charge and reaper requests and never compensates a completed claim again', async () => {
    const db = await fixture();
    expect((await Promise.all([debit(), debit()])).filter(Boolean)).toHaveLength(1);
    const results = await Promise.all([reap(), reap()]);
    expect(results.reduce((sum, result) => sum + result.reaped, 0)).toBe(1);
    expect(await reap()).toEqual({ ok: true, reaped: 0 });
    expect(await debit()).toBe(false);
    expect(await count(db, 'mcu_transactions')).toBe(2);
    expect(await count(db, 'mcu_mission_compensations')).toBe(1);
    await expect(db.exec('DELETE FROM mcu_mission_compensations')).rejects.toThrow('immutable');
    await expect(db.exec('UPDATE manual_pilot_credit_allocations SET amount=1')).rejects.toThrow('immutable');
  });

  it.each([true, false])('quarantines unbound charges; debit predates migration: %s', async (legacy) => {
    const db = await fixture(!legacy);
    expect(await deductCredits('alice', 110, 'mission', 'command:ai:write', 'org-a')).toBe(true);
    if (legacy) await migrate(db);
    expect(await reap()).toEqual({ ok: true, reaped: 1, credits_refunded: 0, unreconciled: 1 });
    expect(await wallet(db)).toEqual({ credits_remaining: 170, credits_total_purchased: 200 });
    expect(await consumed(db, 'pilot-a')).toBe(80);
    expect(await db.prepare('SELECT error FROM engine_missions').first('error')).toBe('timeout_reaper_unreconciled');
    expect(await db.prepare('SELECT debit_id,outcome FROM mcu_mission_compensations').first())
      .toEqual({ debit_id: null, outcome: 'legacy_unproven' });
  });

  it('does not link a debit for a different user or admit another tenant allocation', async () => {
    const db = await fixture();
    expect(await deductMissionCredits('bob', 110, 'mission', 'command:ai:write', 'org-a'))
      .toEqual({ ok: true, value: false });
    expect(await debit(281)).toBe(false);
    expect(await count(db, 'mcu_mission_debits')).toBe(0);
    expect(await wallet(db)).toEqual({ credits_remaining: 200, credits_total_purchased: 200 });
    expect(await consumed(db, 'pilot-b')).toBe(0);
  });

  it('rolls back the original charge if its trusted link cannot be written', async () => {
    const db = await fixture();
    await db.exec(`CREATE TRIGGER injected_failure BEFORE INSERT ON mcu_mission_debits
      BEGIN SELECT RAISE(ABORT,'link failed'); END`);
    expect(await debit()).toBe(false);
    expect(await wallet(db)).toEqual({ credits_remaining: 200, credits_total_purchased: 200 });
    expect(await consumed(db, 'pilot-a')).toBe(0);
    expect(await count(db, 'manual_pilot_credit_debits')).toBe(0);
    expect(await count(db, 'mcu_transactions')).toBe(0);
  });
});

async function finalize(db: D1Database) {
  await finalizeMissionExecution({ db: new D1Client(db), creditsUsed: 110,
    mission: { id: 'mission', user_id: 'alice', command: 'ai:write', params: null, status: 'running', webhook_url: 'https://example.invalid' },
    handlerResult: { ok: true },
  });
}

describe('reaper interacts with other terminal transitions', () => {
  it.each([true, false])('preserves the terminal race winner (reaper first: %s)', async (reaperFirst) => {
    const db = await fixture();
    vi.clearAllMocks();
    expect(await debit()).toBe(true);
    if (reaperFirst) {
      expect(await reap()).toEqual({ ok: true, reaped: 1, credits_refunded: 110 });
      await finalize(db);
      expect(await db.prepare('SELECT error FROM engine_missions').first('error')).toBe('timeout_reaper');
      expect(context.webhook).not.toHaveBeenCalled();
      expect(context.clearCheckpoint).not.toHaveBeenCalled();
    } else {
      await finalize(db);
      expect(await reap()).toEqual({ ok: true, reaped: 0 });
      expect(await db.prepare('SELECT status FROM engine_missions').first('status')).toBe('succeeded');
      expect(await wallet(db)).toEqual({ credits_remaining: 170, credits_total_purchased: 200 });
      expect(context.webhook).toHaveBeenCalledOnce();
      expect(context.clearCheckpoint).toHaveBeenCalledOnce();
    }
  });

  it.each([true, false])('preserves revoked credits when monetary refund settles first: %s', async (refundFirst) => {
    const db = await fixture();
    await db.exec(`CREATE TABLE user_profiles(user_id TEXT PRIMARY KEY, role TEXT);
      INSERT INTO user_profiles VALUES('admin','admin');`);
    const intake = await receiveManualPilotRefundIntake(db, { orderId: 'pilot-a', orgId: 'org-a',
      category: 'goodwill_7d', reason: 'Customer refund instruction', beneficiaryBankIdentity: 'customer-bank',
      beneficiaryAccountIdentity: 'customer-account' }, 'alice');
    if (!intake.ok) throw new Error(intake.error.message);
    await db.prepare(`INSERT INTO manual_pilot_refund_state
      (order_id,state,amount_vnd,category,requested_at,updated_at,intake_id)
      VALUES('pilot-a','TRANSFER_PENDING',1990000,'goodwill_7d',?,?,?)`)
      .bind(intake.value.receivedAt, intake.value.receivedAt, intake.value.intakeId).run();
    const outbound = await ingestManualPilotEvidence(db, { orderId: 'pilot-a', orgId: 'org-a',
      artifactId: 'bank-artifact', expectedAccountIdentity: 'acct' }, { verify: async () => ({
      bankIdentity: 'bank', accountIdentity: 'acct', transactionIdentity: 'tx', amountVnd: 1990000,
      currency: 'VND', direction: 'outbound', settledAt: new Date().toISOString(), orderReference: 'pilot-a',
      artifactSha256: 'a'.repeat(64), source: 'independent-statement', verifier: 'bank-verifier',
      counterpartyBankIdentity: 'customer-bank', counterpartyAccountIdentity: 'customer-account',
    }) });
    if (!outbound.ok) throw new Error(outbound.error.message);
    expect(await debit()).toBe(true);
    const settle = () => transitionPilotRefund(db, { orderId: 'pilot-a', adminId: 'admin', target: 'SETTLED', evidenceId: outbound.value.evidenceId });
    if (refundFirst) expect((await settle()).ok).toBe(true);
    expect(await reap()).toEqual({ ok: true, reaped: 1, credits_refunded: refundFirst ? 30 : 110 });
    if (!refundFirst) expect((await settle()).ok).toBe(true);
    expect(await db.prepare("SELECT consumed, revoked FROM manual_pilot_credit_grants WHERE order_id='pilot-a'").first())
      .toEqual({ consumed: refundFirst ? 80 : 0, revoked: refundFirst ? 0 : 80 });
    expect(await wallet(db)).toEqual({ credits_remaining: 200, credits_total_purchased: 200 });
  });
});

describe('entitlement eligibility, public no-wallet atomicity, and uncertain debit outcome', () => {
  it.each([
    ['future starts_at', `UPDATE manual_pilot_entitlements SET starts_at='2200-01-01' WHERE order_id='pilot-a'`],
    ['past ends_at', `UPDATE manual_pilot_entitlements SET ends_at='2000-01-01' WHERE order_id='pilot-a'`],
    ['entitlement user mismatch', `UPDATE manual_pilot_entitlements SET user_id='bob' WHERE order_id='pilot-a'`],
    ['entitlement org mismatch', `UPDATE manual_pilot_entitlements SET org_id='org-b' WHERE order_id='pilot-a'`],
  ])('excludes pilot grant from balance and debits when %s', async (_case, mutation) => {
    const db = await fixture();
    await db.exec(mutation);
    expect(await getManualPilotCreditBalance(db, 'alice', 'org-a')).toBe(0);
    expect(await deductCredits('alice', 201, 'pub-ref', 'api:consume', 'org-a')).toBe(false);
    expect(await consumed(db, 'pilot-a')).toBe(0);
    expect(await count(db, 'manual_pilot_credit_debits')).toBe(0);
  });

  it('creates wallet row and records credits_total_used atomically for public pilot-only debit', async () => {
    const db = await fixture();
    await db.exec("DELETE FROM user_mcu_balance WHERE user_id='alice'");
    expect(await deductCredits('alice', 80, 'pub-ref', 'api:consume', 'org-a')).toBe(true);
    expect(await db.prepare(
      "SELECT credits_remaining,credits_total_purchased,credits_total_used FROM user_mcu_balance WHERE user_id='alice'",
    ).first()).toEqual({ credits_remaining: 0, credits_total_purchased: 0, credits_total_used: 80 });
    expect(await consumed(db, 'pilot-a')).toBe(80);
    expect(await count(db, 'mcu_transactions')).toBe(1);
  });

  it('rolls back entire public debit if wallet update cannot be applied', async () => {
    const db = await fixture();
    await db.exec(`CREATE TRIGGER block_wallet_update BEFORE UPDATE ON user_mcu_balance
      BEGIN SELECT RAISE(ABORT,'wallet update blocked'); END`);
    expect(await deductCredits('alice', 80, 'pub-ref', 'api:consume', 'org-a')).toBe(false);
    expect(await consumed(db, 'pilot-a')).toBe(0);
    expect(await count(db, 'manual_pilot_credit_debits')).toBe(0);
    expect(await count(db, 'mcu_transactions')).toBe(0);
  });

  describe.each(['public', 'trusted'] as const)('%s debit required effects', (mode) => {
    it.each([
      ['ledger', 'INSERT', 'mcu_transactions', ''],
      ['allocation', 'INSERT', 'manual_pilot_credit_allocations', ''],
      ['grant consumption', 'UPDATE', 'manual_pilot_credit_grants', ''],
      ['wallet usage', 'UPDATE', 'user_mcu_balance', ''],
      ['partial allocation', 'INSERT', 'manual_pilot_credit_allocations', "WHEN NEW.order_id='pilot-a2'"],
      ['partial grant consumption', 'UPDATE', 'manual_pilot_credit_grants', "WHEN NEW.order_id='pilot-a2'"],
    ])('rolls back when %s is silently ignored', async (_effect, operation, table, condition) => {
      const db = await fixture();
      await grant(db, 'pilot-a2', 'org-a', 10);
      await db.exec(`CREATE TRIGGER ignore_required_effect BEFORE ${operation} ON ${table}
        ${condition} BEGIN SELECT RAISE(IGNORE); END`);
      if (mode === 'public') {
        expect(await deductCredits('alice', 110, 'public-reference', 'api:consume', 'org-a')).toBe(false);
      } else {
        expect(await deductMissionCredits('alice', 110, 'mission', 'command:ai:write', 'org-a'))
          .toMatchObject({ ok: false, error: { code: 'storage_uncertain' } });
      }
      expect(await wallet(db)).toEqual({ credits_remaining: 200, credits_total_purchased: 200 });
      expect(await db.prepare("SELECT credits_total_used FROM user_mcu_balance WHERE user_id='alice'")
        .first('credits_total_used')).toBe(0);
      expect(await consumed(db, 'pilot-a')).toBe(0);
      expect(await consumed(db, 'pilot-a2')).toBe(0);
      expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_credit_allocations').first('n')).toBe(0);
      for (const tableName of ['manual_pilot_credit_debits', 'mcu_transactions', 'mcu_mission_debits'] as const) {
        expect(await count(db, tableName)).toBe(0);
      }
      expect(await db.prepare('SELECT status FROM engine_missions').first('status')).toBe('running');
    });
  });

  it('rolls back when the trusted compensation link is silently ignored', async () => {
    const db = await fixture();
    await db.exec(`CREATE TRIGGER ignore_mission_link BEFORE INSERT ON mcu_mission_debits
      BEGIN SELECT RAISE(IGNORE); END`);
    expect(await deductMissionCredits('alice', 110, 'mission', 'command:ai:write', 'org-a'))
      .toMatchObject({ ok: false, error: { code: 'storage_uncertain' } });
    expect(await wallet(db)).toEqual({ credits_remaining: 200, credits_total_purchased: 200 });
    expect(await consumed(db, 'pilot-a')).toBe(0);
    for (const tableName of ['manual_pilot_credit_debits', 'mcu_transactions', 'mcu_mission_debits'] as const) {
      expect(await count(db, tableName)).toBe(0);
    }
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_credit_allocations').first('n')).toBe(0);
    expect(await db.prepare("SELECT credits_total_used FROM user_mcu_balance WHERE user_id='alice'")
      .first('credits_total_used')).toBe(0);
  });

  it('signals storage_uncertain on lost response after committed mission debit so reaper can compensate', async () => {
    const db = await fixture();
    const realBatch = db.batch.bind(db);
    vi.spyOn(db, 'batch').mockImplementationOnce(async (stmts) => {
      await realBatch(stmts);
      throw new Error('rpc response lost after commit');
    });
    const outcome = await deductMissionCredits('alice', 110, 'mission', 'command:ai:write', 'org-a');
    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'storage_uncertain' }),
    });
    expect(await consumed(db, 'pilot-a')).toBe(80);
    expect(await wallet(db)).toEqual({ credits_remaining: 170, credits_total_purchased: 200 });
    expect(await reap()).toEqual({ ok: true, reaped: 1, credits_refunded: 110 });
    expect(await consumed(db, 'pilot-a')).toBe(0);
    expect(await wallet(db)).toEqual({ credits_remaining: 200, credits_total_purchased: 200 });
  });
});
