// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { approveAndActivateManualPilot } from '@/land/payments/manual-pilot/manual-pilot-activation';
import { ingestManualPilotEvidence } from '@/land/payments/manual-pilot/manual-pilot-evidence';
import { createManualPilotSettlementRow } from '@/land/payments/manual-pilot/manual-pilot-repo';
import { receiveManualPilotRefundIntake } from '@/land/payments/manual-pilot/manual-pilot-refund-intake';
import { requestManualPilotRefund } from '@/land/payments/manual-pilot/manual-pilot-refund';
import { transitionPilotRefund } from '@/land/payments/manual-pilot/manual-pilot-refund-transitions';
import { transitionManualPilot } from '@/land/payments/manual-pilot/manual-pilot-transitions';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import { VIDEO_TIER_CONFIG } from '@/seed/config/tiers/video-quota-tiers';
import { getUserTier } from '@/seed/db/get-user-tier';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { deductCredits, getBalance } from '@/tree/mcu/credits-repo';
import { checkVideoQuota, reserveVideoSlot } from '@/tree/quota/video-quota';

// Bind only the disposable SQLite database; use the real runtime DB clients.
vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));

const starts = new Date('2026-11-19T05:45:00.000Z');
const ends = new Date('2026-12-03T05:45:00.000Z');
const orderId = 'pilot-order';
const userId = 'customer';
const orgId = 'pilot-org';
const adminId = 'admin';
const transferReference = 'pilot-reference';
const { priceVnd } = OPTION_A_PILOT_CONTRACT;

async function fixture() {
  const db = new NodeSqliteD1Database(':memory:');
  vi.stubGlobal('__env__', { DB: db });
  for (const migration of [
    '0001-init.sql', '0004-user-profiles.sql', '0070-pending-orders.sql', '0053-mcu-credits.sql',
    '0086-subscriptions-add-user-tier.sql', '0087-subscriptions-drop-user-id-fk.sql',
    '0088-org-members-drop-user-id-fk.sql', '0272_user_profiles_role.sql',
    '0443-video-usage-monthly.sql', '0506_manual_pilot_settlement_ledger.sql',
    '0507_manual_pilot_financial_state.sql', '0508_manual_pilot_audit_integrity.sql',
    '0509_manual_pilot_credit_compensation.sql', '0510_manual_pilot_delivery_evidence.sql',
    '0511_manual_pilot_refund_intake.sql',
  ]) {
    await db.exec(readFileSync(`migrations/${migration}`, 'utf8'));
  }
  await db.exec(`
    INSERT INTO pending_orders(order_id,user_id,tier,amount_usd_cents)
      VALUES ('pilot-order','customer','BASIC',0);
    INSERT INTO organizations(id,name) VALUES ('pilot-org','Pilot'),('other-org','Other');
    INSERT INTO org_members(user_id,org_id) VALUES ('customer','pilot-org'),('coworker','pilot-org');
    INSERT INTO user_profiles(user_id,role) VALUES ('admin','admin');
    INSERT INTO user_mcu_balance(user_id,credits_remaining,credits_total_purchased)
      VALUES ('customer',900,900);
  `);
  return db;
}

async function evidence(db: NodeSqliteD1Database, direction: 'inbound' | 'outbound') {
  const result = await ingestManualPilotEvidence(db, { orderId, orgId, artifactId: direction,
    expectedAccountIdentity: 'fixture-account' }, {
    verify: async () => ({
      direction, bankIdentity: 'fixture-bank', accountIdentity: 'fixture-account',
      transactionIdentity: `fixture-${direction}`, amountVnd: priceVnd, currency: 'VND',
      settledAt: new Date().toISOString(), orderReference: transferReference,
      counterpartyBankIdentity: 'customer-bank', counterpartyAccountIdentity: 'customer-account',
      artifactSha256: 'a'.repeat(64), source: 'fixture', verifier: 'local-fixture',
    }),
  });
  if (!result.ok) throw new Error(`Could not ingest fixture evidence: ${result.error.code}`);
  return result.value.evidenceId;
}

async function activate(db: NodeSqliteD1Database) {
  expect((await createManualPilotSettlementRow(db, { orderId, userId, orgId, transferReference })).ok).toBe(true);
  const evidenceId = await evidence(db, 'inbound');
  for (const target of ['BANK_SETTLEMENT_VERIFIED', 'RECONCILED', 'ADMIN_APPROVED'] as const) {
    expect((await transitionManualPilot(db, { orderId, orgId, adminId, evidenceId, target })).ok).toBe(true);
  }
  expect((await approveAndActivateManualPilot(db, { orderId, adminId,
    receivedAmountVnd: priceVnd, bankTransactionRef: 'unused-inbound-claim' })).ok).toBe(true);
}

async function expectNoCloudSlot(db: NodeSqliteD1Database) {
  const tier = await getUserTier(userId);
  expect(tier).toBe('BASIC');
  expect(await checkVideoQuota(userId, tier)).toMatchObject({ allowed: false, used: 0, limit: 0 });
  expect(await reserveVideoSlot(userId, tier)).toMatchObject({ reserved: false, used: 0, limit: 0 });
  expect(await db.prepare('SELECT count(*) AS n FROM video_usage_monthly').first('n')).toBe(0);
  expect(VIDEO_TIER_CONFIG.free.videosPerMonth).toBe(10);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(starts);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('manual pilot runtime rights against SQLite', () => {
  it('adds 500 MCU only in the active term and never adds Cloud slots or a subscription', async () => {
    const db = await fixture();
    await expectNoCloudSlot(db);
    await activate(db);
    expect(await db.prepare('SELECT starts_at,ends_at FROM manual_pilot_entitlements').first()).toEqual({
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    });
    vi.setSystemTime(starts.getTime() - 1);
    expect((await getBalance(userId, orgId)).credits_remaining).toBe(900);
    expect(await deductCredits(userId, 901, 'before-start', 'test', orgId)).toBe(false);
    vi.setSystemTime(starts);
    expect((await getBalance(userId, orgId)).credits_remaining).toBe(1400);
    await expectNoCloudSlot(db);
    expect(await db.prepare('SELECT count(*) AS n FROM subscriptions').first('n')).toBe(0);
    vi.setSystemTime(ends.getTime() - 1);
    expect((await getBalance(userId, orgId)).credits_remaining).toBe(1400);
    vi.setSystemTime(ends);
    expect((await getBalance(userId, orgId)).credits_remaining).toBe(900);
    expect(await deductCredits(userId, 901, 'at-expiry', 'test', orgId)).toBe(false);
    await expectNoCloudSlot(db);
  });

  it('keeps an independent upgrade and its Cloud usage after the pilot expires', async () => {
    const db = await fixture();
    await activate(db);
    await expectNoCloudSlot(db);
    await db.exec("INSERT INTO subscriptions(org_id,user_id,tier) VALUES ('pilot-org','customer','PREMIUM')");
    expect(await getUserTier(userId)).toBe('PREMIUM');
    vi.setSystemTime(ends.getTime() - 1);
    expect(await reserveVideoSlot(userId, 'PREMIUM')).toMatchObject({ reserved: true, used: 1, limit: 30 });
    vi.setSystemTime(ends);
    expect(await getUserTier(userId)).toBe('PREMIUM');
    expect(await checkVideoQuota(userId, 'PREMIUM')).toMatchObject({ allowed: true, used: 1, limit: 30 });
    expect(await reserveVideoSlot(userId, 'PREMIUM')).toMatchObject({ reserved: true, used: 2, limit: 30 });
    expect((await getBalance(userId, orgId)).credits_remaining).toBe(900);
  });

  it('binds the grant to the purchasing user and a current membership in the selected tenant', async () => {
    const db = await fixture();
    await activate(db);
    expect((await getBalance(userId)).credits_remaining).toBe(1400);
    expect((await getBalance('coworker', orgId)).credits_remaining).toBe(0);
    await db.exec("INSERT INTO org_members(user_id,org_id) VALUES ('customer','other-org')");
    expect((await getBalance(userId)).credits_remaining).toBe(900);
    expect((await getBalance(userId, 'other-org')).credits_remaining).toBe(900);
    expect(await deductCredits(userId, 901, 'other-tenant', 'test', 'other-org')).toBe(false);
    expect((await getBalance(userId, orgId)).credits_remaining).toBe(1400);
    await db.exec("DELETE FROM org_members WHERE user_id='customer' AND org_id='pilot-org'");
    expect((await getBalance(userId, orgId)).credits_remaining).toBe(900);
    expect(await deductCredits(userId, 901, 'removed-member', 'test', orgId)).toBe(false);
  });

  it.each([['PREMIUM', 30], ['ENTERPRISE', 200], ['MASTER', 1000]] as const)(
    'preserves an independent %s subscription, usage, and purchased MCU through pilot refund',
    async (tier, limit) => {
      const db = await fixture();
      await db.prepare("INSERT INTO subscriptions(org_id,user_id,tier) VALUES ('pilot-org',?,?)")
        .bind(userId, tier).run();
      expect(await getUserTier(userId)).toBe(tier);
      expect(await reserveVideoSlot(userId, tier)).toMatchObject({ reserved: true, used: 1, limit });
      await activate(db);
      expect(await getUserTier(userId)).toBe(tier);
      expect(await reserveVideoSlot(userId, tier)).toMatchObject({ reserved: true, used: 2, limit });
      expect(await deductCredits(userId, 100, 'pilot-mcu', 'test', orgId)).toBe(true);
      expect((await getBalance(userId, orgId)).credits_remaining).toBe(1300);
      const intake = await receiveManualPilotRefundIntake(db, { orderId, orgId, category: 'goodwill_7d',
        reason: 'goodwill', beneficiaryBankIdentity: 'customer-bank', beneficiaryAccountIdentity: 'customer-account' }, userId);
      if (!intake.ok) throw new Error(intake.error.message);
      expect((await requestManualPilotRefund(db, { orderId, adminId, reason: 'goodwill',
        category: 'goodwill_7d', refundAmountVnd: priceVnd, intakeId: intake.value.intakeId })).ok).toBe(true);
      for (const target of ['APPROVED', 'TRANSFER_PENDING'] as const) {
        expect((await transitionPilotRefund(db, { orderId, adminId, target })).ok).toBe(true);
      }
      expect((await getBalance(userId, orgId)).credits_remaining).toBe(1300);
      const evidenceId = await evidence(db, 'outbound');
      expect((await transitionPilotRefund(db, { orderId, adminId, target: 'SETTLED', evidenceId })).ok).toBe(true);
      expect((await getBalance(userId, orgId)).credits_remaining).toBe(900);
      expect(await deductCredits(userId, 901, 'after-refund', 'test', orgId)).toBe(false);
      expect(await getUserTier(userId)).toBe(tier);
      expect(await reserveVideoSlot(userId, tier)).toMatchObject({ reserved: true, used: 3, limit });
    },
  );
});
