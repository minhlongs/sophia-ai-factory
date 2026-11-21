// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { receiveManualPilotRefundIntake } from '@/land/payments/manual-pilot/manual-pilot-refund-intake';
import { requestManualPilotRefund } from '@/land/payments/manual-pilot/manual-pilot-refund';
import { verifyManualPilotDeliveryFailure } from '@/land/payments/manual-pilot/manual-pilot-delivery-evidence';
import { ingestManualPilotEvidence, type VerifiedBankArtifact } from '@/land/payments/manual-pilot/manual-pilot-evidence';
import { transitionPilotRefund } from '@/land/payments/manual-pilot/manual-pilot-refund-transitions';
import { POST } from '@/app/api/billing/manual-pilot/refund-intake/route';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1Raw } from '@/seed/db/client';
vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));
vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUserFromHeaders: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1Raw: vi.fn() }));
const paid = 1_990_000;
const activation = '2026-11-01T17:15:00.123Z';
const day7 = '2026-11-08T17:15:00.123Z';
const day14 = '2026-11-15T17:15:00.123Z';
const late = '2026-11-20T17:15:00.123Z';
const instruction = { orderId: 'order-one', orgId: 'org-one', category: 'delivery_failure_14d' as const,
  reason: 'Script delivery failed', beneficiaryBankIdentity: 'customer-bank', beneficiaryAccountIdentity: 'customer-account' };
const delivery = { action: 'verify_delivery_failure' as const, orderId: 'order-one', orgId: 'org-one',
  scope: 'option_a_script' as const, attribution: 'sophia' as const, artifactRef: 'incident:one',
  artifactSha256: 'a'.repeat(64), occurredAt: '2026-11-10T10:00:00.000Z' };
async function fixture() {
  const db = new NodeSqliteD1Database(':memory:');
  for (const name of ['0506_manual_pilot_settlement_ledger', '0507_manual_pilot_financial_state',
    '0508_manual_pilot_audit_integrity', '0510_manual_pilot_delivery_evidence', '0511_manual_pilot_refund_intake']) {
    await db.exec(readFileSync(`migrations/${name}.sql`, 'utf8'));
  }
  await db.exec(`CREATE TABLE user_profiles(user_id TEXT PRIMARY KEY,role TEXT);
    CREATE TABLE org_members(user_id TEXT,org_id TEXT);
    INSERT INTO user_profiles VALUES('admin','admin');
    INSERT INTO org_members VALUES('customer','org-one');
    INSERT INTO manual_pilot_settlements
      (id,order_id,user_id,org_id,expected_amount_vnd,received_amount_vnd,transfer_reference,status,activated_at)
      VALUES('settlement','order-one','customer','org-one',${paid},${paid},'ref-one','activated','${activation}');
    INSERT INTO manual_pilot_financial_state VALUES('order-one','org-one','ACTIVE_14D','inbound',NULL,'${activation}');
    INSERT INTO manual_pilot_bank_evidence VALUES('inbound','order-one','org-one','inbound','bank','platform','tx-in',
      ${paid},'VND','${activation}','ref-one',printf('%064d',0),'fixture','independent','${activation}');
    INSERT INTO manual_pilot_credit_grants VALUES('order-one','customer','org-one',500,100,0,'2026-12-01');
    INSERT INTO manual_pilot_entitlements VALUES('order-one','customer','org-one','${activation}','2026-12-01',NULL);`);
  return db;
}
function clock(iso: string) { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); }
async function intake(db: NodeSqliteD1Database, category = instruction.category) {
  const result = await receiveManualPilotRefundIntake(db, { ...instruction, category }, 'customer');
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value.intakeId;
}
async function refund(db: NodeSqliteD1Database, intakeId?: string, deliveryEvidenceId?: string) {
  return requestManualPilotRefund(db, { orderId: instruction.orderId, adminId: 'admin',
    reason: instruction.reason, category: instruction.category, refundAmountVnd: paid, intakeId, deliveryEvidenceId });
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('immutable customer refund intake', () => {
  it('rejects missing intake before irreversible refund mutation and leaves customer intake available', async () => {
    const db = await fixture(); clock(day7);
    const result = await requestManualPilotRefund(db, { orderId: instruction.orderId, adminId: 'admin',
      reason: instruction.reason, category: 'goodwill_7d', refundAmountVnd: paid });
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(await db.prepare('SELECT status FROM manual_pilot_settlements').first('status')).toBe('activated');
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_refund_state').first('n')).toBe(0);
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_audit_log').first('n')).toBe(0);
    expect((await receiveManualPilotRefundIntake(db, { ...instruction, category: 'goodwill_7d' }, 'customer')).ok).toBe(true);
  });

  it('uses authenticated ownership, server time and original retry receipt', async () => {
    const db = await fixture(); clock(day14);
    expect((await receiveManualPilotRefundIntake(db, instruction, 'stranger')).ok).toBe(false);
    expect((await receiveManualPilotRefundIntake(db, { ...instruction, receivedAt: activation }, 'customer')).ok).toBe(false);
    expect((await receiveManualPilotRefundIntake(db, { ...instruction, orgId: 'other' }, 'customer')).ok).toBe(false);
    const id = await intake(db);
    clock(late);
    expect(await intake(db)).toBe(id);
    expect(await db.prepare('SELECT received_at FROM manual_pilot_refund_intakes').first('received_at')).toBe(day14);
    for (const sql of ["UPDATE manual_pilot_refund_intakes SET received_at='2000'", 'DELETE FROM manual_pilot_refund_intakes',
      'INSERT OR REPLACE INTO manual_pilot_refund_intakes SELECT * FROM manual_pilot_refund_intakes',
      "INSERT OR REPLACE INTO manual_pilot_refund_intakes SELECT 'other',order_id,org_id,user_id,category,reason,beneficiary_bank_identity,beneficiary_account_identity,received_at FROM manual_pilot_refund_intakes"]) {
      await expect(db.exec(sql)).rejects.toThrow('immutable');
    }
  });

  it('preserves timely day-14 intake through late verification and records actual admin audit time', async () => {
    const db = await fixture(); clock(day14); const intakeId = await intake(db); clock(late);
    const verified = await verifyManualPilotDeliveryFailure(db, { ...delivery, intakeId }, 'admin');
    expect(verified.ok).toBe(true); if (!verified.ok) throw new Error(verified.error.message);
    expect((await refund(db, intakeId, verified.value.evidenceId)).ok).toBe(true);
    expect(await db.prepare('SELECT requested_at,intake_id FROM manual_pilot_refund_state').first())
      .toEqual({ requested_at: late, intake_id: intakeId });
    expect(await db.prepare('SELECT verified_at FROM manual_pilot_delivery_evidence').first('verified_at')).toBe(late);
    expect(await db.prepare("SELECT created_at FROM manual_pilot_audit_log WHERE action='refund_requested'").first('created_at')).toBe(late);
  });

  it('allows timely day-7 goodwill intake and rejects late or mismatched original intake', async () => {
    const db = await fixture(); clock(day7);
    const result = await receiveManualPilotRefundIntake(db, { ...instruction, category: 'goodwill_7d' }, 'customer');
    if (!result.ok) throw new Error(result.error.message);
    clock(late);
    expect((await requestManualPilotRefund(db, { orderId: instruction.orderId, adminId: 'admin', reason: instruction.reason,
      category: 'goodwill_7d', refundAmountVnd: paid, intakeId: result.value.intakeId })).ok).toBe(true);
    const other = await fixture(); clock(new Date(Date.parse(day14) + 1).toISOString()); const id = await intake(other); clock(late);
    expect((await verifyManualPilotDeliveryFailure(other, { ...delivery, intakeId: id }, 'admin')).ok).toBe(false);
    expect((await refund(other, 'wrong-id', 'wrong-evidence')).ok).toBe(false);
  });

  it('rejects post-intake occurrence and rolls back missing intake writes', async () => {
    const db = await fixture(); clock('2026-11-05T00:00:00.000Z'); const intakeId = await intake(db); clock(late);
    expect((await verifyManualPilotDeliveryFailure(db, { ...delivery, intakeId }, 'admin')).ok).toBe(false);
    const empty = await fixture();
    await empty.exec("CREATE TRIGGER ignore_intake BEFORE INSERT ON manual_pilot_refund_intakes BEGIN SELECT RAISE(IGNORE); END");
    expect((await receiveManualPilotRefundIntake(empty, instruction, 'customer')).ok).toBe(false);
  });

  it('requires HTTP authentication and rejects caller timestamps', async () => {
    const db = await fixture(); clock(day14); vi.mocked(getD1Raw).mockResolvedValue(db);
    const post = (body: object) => POST(new NextRequest('http://localhost/api/billing/manual-pilot/refund-intake',
      { method: 'POST', body: JSON.stringify(body) }));
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue(null);
    expect((await post(instruction)).status).toBe(401);
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'customer', email: 'test@example.invalid' });
    expect((await post({ ...instruction, receivedAt: activation })).status).toBe(400);
    expect((await post(instruction)).status).toBe(200);
  });
});

async function pendingRefund(db: NodeSqliteD1Database) {
  clock(day14); const intakeId = await intake(db); clock(late);
  const verified = await verifyManualPilotDeliveryFailure(db, { ...delivery, intakeId }, 'admin');
  if (!verified.ok) throw new Error(verified.error.message);
  expect((await refund(db, intakeId, verified.value.evidenceId)).ok).toBe(true);
  for (const target of ['APPROVED', 'TRANSFER_PENDING'] as const) {
    expect((await transitionPilotRefund(db, { orderId: instruction.orderId, adminId: 'admin', target })).ok).toBe(true);
  }
}
const artifact: VerifiedBankArtifact = { bankIdentity: 'bank', accountIdentity: 'platform', transactionIdentity: 'tx-out',
  amountVnd: paid, currency: 'VND', direction: 'outbound', settledAt: late, orderReference: 'ref-one',
  artifactSha256: 'b'.repeat(64), source: 'bank-statement', verifier: 'independent',
  counterpartyBankIdentity: 'customer-bank', counterpartyAccountIdentity: 'customer-account' };

describe('independently evidenced refund destination', () => {
  it.each(['customer-account', 'attacker-account', undefined])('settles only matching counterparty %s', async (account) => {
    const db = await fixture(); await pendingRefund(db);
    const evidence = await ingestManualPilotEvidence(db, { orderId: instruction.orderId, orgId: instruction.orgId,
      artifactId: 'independent-artifact', expectedAccountIdentity: 'platform' },
    { verify: async () => ({ ...artifact, counterpartyAccountIdentity: account }) });
    if (!account) { expect(evidence.ok).toBe(false); return; }
    expect(evidence.ok).toBe(true); if (!evidence.ok) throw new Error(evidence.error.message);
    const result = await transitionPilotRefund(db, { orderId: instruction.orderId, adminId: 'admin', target: 'SETTLED', evidenceId: evidence.value.evidenceId });
    expect(result.ok).toBe(account === 'customer-account');
    expect(await db.prepare('SELECT revoked FROM manual_pilot_credit_grants').first('revoked')).toBe(result.ok ? 400 : 0);
    for (const sql of ['UPDATE manual_pilot_bank_counterparties SET account_identity=\'forged\'',
      'DELETE FROM manual_pilot_bank_counterparties', 'INSERT OR REPLACE INTO manual_pilot_bank_counterparties SELECT * FROM manual_pilot_bank_counterparties',
      'INSERT OR REPLACE INTO manual_pilot_bank_evidence SELECT * FROM manual_pilot_bank_evidence',
      'INSERT OR REPLACE INTO manual_pilot_refund_state SELECT * FROM manual_pilot_refund_state',
      'DELETE FROM manual_pilot_refund_state',
      "UPDATE manual_pilot_refund_state SET intake_id=NULL"]) {
      await expect(db.exec(sql)).rejects.toThrow('immutable');
    }
  });

  it('rolls back bank evidence when mandatory counterparty persistence is ignored', async () => {
    const db = await fixture(); await pendingRefund(db);
    await db.exec("CREATE TRIGGER ignore_counterparty BEFORE INSERT ON manual_pilot_bank_counterparties BEGIN SELECT RAISE(IGNORE); END");
    const result = await ingestManualPilotEvidence(db, { orderId: instruction.orderId, orgId: instruction.orgId,
      artifactId: 'independent-artifact', expectedAccountIdentity: 'platform' }, { verify: async () => artifact });
    expect(result.ok).toBe(false);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM manual_pilot_bank_evidence WHERE direction='outbound'").first('n')).toBe(0);
  });

  it('fails closed for historical outbound evidence without a counterparty', async () => {
    const db = await fixture(); await pendingRefund(db);
    await db.exec(`INSERT INTO manual_pilot_bank_evidence VALUES('legacy-out','order-one','org-one','outbound','bank','platform','legacy-tx',
      ${paid},'VND','${late}','ref-one',printf('%064d',0),'legacy','legacy','${late}')`);
    expect((await transitionPilotRefund(db, { orderId: instruction.orderId, adminId: 'admin', target: 'SETTLED', evidenceId: 'legacy-out' })).ok).toBe(false);
    expect(await db.prepare('SELECT state FROM manual_pilot_refund_state').first('state')).toBe('TRANSFER_PENDING');
  });
});
