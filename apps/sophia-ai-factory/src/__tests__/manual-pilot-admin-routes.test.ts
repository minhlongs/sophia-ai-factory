// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { ingestManualPilotEvidence, type VerifiedBankArtifact } from '@/land/payments/manual-pilot/manual-pilot-evidence';
import { transitionManualPilot } from '@/land/payments/manual-pilot/manual-pilot-transitions';
import { approveAndActivateManualPilot } from '@/land/payments/manual-pilot/manual-pilot-activation';
import { getManualPilotSettlementByOrderId, listManualPilotSettlements } from '@/land/payments/manual-pilot/manual-pilot-repo';
import { getCommittedPilotReceipt } from '@/land/payments/manual-pilot/manual-pilot-receipt';
vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));

async function fixture() {
  const db = new NodeSqliteD1Database(':memory:');
  await db.exec(readFileSync(resolve('migrations/0506_manual_pilot_settlement_ledger.sql'),'utf8'));
  await db.exec(readFileSync(resolve('migrations/0507_manual_pilot_financial_state.sql'),'utf8'));
  for (const file of ['0508_manual_pilot_audit_integrity', '0509_manual_pilot_credit_compensation',
    '0510_manual_pilot_delivery_evidence', '0511_manual_pilot_refund_intake']) {
    await db.exec(readFileSync(resolve(`migrations/${file}.sql`), 'utf8'));
  }
  await db.exec(`CREATE TABLE pending_orders(order_id TEXT PRIMARY KEY,status TEXT);
    INSERT INTO pending_orders VALUES('order','pending');
    CREATE TABLE user_profiles(user_id TEXT PRIMARY KEY,role TEXT);
    INSERT INTO user_profiles VALUES('admin','admin');
    INSERT INTO manual_pilot_settlements(id,order_id,user_id,org_id,expected_amount_vnd,transfer_reference)
      VALUES('s','order','user','org',1990000,'reference');
    INSERT INTO manual_pilot_financial_state VALUES('order','org','PENDING_ORDER',NULL,NULL,'2026-01-01');`);
  const artifact: VerifiedBankArtifact = {
    bankIdentity:'test-bank',accountIdentity:'test-account',transactionIdentity:'test-transaction',
    amountVnd:1990000,currency:'VND',direction:'inbound',settledAt:'2026-01-01',
    orderReference:'reference',artifactSha256:'a'.repeat(64),source:'independent-test-bank',verifier:'bank-reader',
  };
  const input = { orderId:'order',orgId:'org',artifactId:'server-artifact',expectedAccountIdentity:'test-account' };
  return {db,artifact,input};
}

describe('manual pilot independent evidence and legal transitions', () => {
  it('fails closed without an independent verifier', async () => {
    const {db,input}=await fixture();
    expect((await ingestManualPilotEvidence(db,input)).ok).toBe(false);
  });
  it('rejects wrong tenant and wrong account evidence', async () => {
    const {db,input,artifact}=await fixture();
    expect((await ingestManualPilotEvidence(db,{...input,orgId:'other'},{verify:async()=>artifact})).ok).toBe(false);
    expect((await ingestManualPilotEvidence(db,input,{verify:async()=>({...artifact,accountIdentity:'other'})})).ok).toBe(false);
  });
  it('enforces legal order and current admin role with immutable evidence', async () => {
    const {db,input,artifact}=await fixture();
    const evidence=await ingestManualPilotEvidence(db,input,{verify:async()=>artifact});
    expect(evidence.ok).toBe(true);
    if(!evidence.ok) throw new Error('fixture evidence rejected');
    const args={orderId:'order',orgId:'org',adminId:'admin',evidenceId:evidence.value.evidenceId};
    expect((await transitionManualPilot(db,{...args,target:'ADMIN_APPROVED'})).ok).toBe(false);
    for(const target of ['BANK_SETTLEMENT_VERIFIED','RECONCILED'] as const) {
      expect((await transitionManualPilot(db,{...args,target})).ok).toBe(true);
    }
    await db.exec("UPDATE user_profiles SET role='user'");
    expect((await transitionManualPilot(db,{...args,target:'ADMIN_APPROVED'})).ok).toBe(false);
    expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_financial_events').first('n')).toBe(2);
    await expect(db.exec("UPDATE manual_pilot_bank_evidence SET amount_vnd=1")).rejects.toThrow('immutable');
    expect((await ingestManualPilotEvidence(db,input,{verify:async()=>artifact})).ok).toBe(false);
  });
});


describe('committed pilot activation and tenant boundaries', () => {
  it('activates once, preserves purchased state and exposes exact receipt amount', async () => {
    const {db,input,artifact}=await fixture();
    await db.exec("CREATE TABLE subscriptions(id TEXT,plan TEXT); INSERT INTO subscriptions VALUES('existing','premium');");
    expect(await getCommittedPilotReceipt(db,'order','user')).toBeNull();
    const evidence=await ingestManualPilotEvidence(db,input,{verify:async()=>artifact});
    if(!evidence.ok) throw new Error('fixture');
    for(const target of ['BANK_SETTLEMENT_VERIFIED','RECONCILED','ADMIN_APPROVED'] as const) {
      expect((await transitionManualPilot(db,{orderId:'order',orgId:'org',adminId:'admin',evidenceId:evidence.value.evidenceId,target})).ok).toBe(true);
    }
    const args={orderId:'order',adminId:'admin',receivedAmountVnd:1,bankTransactionRef:'untrusted'};
    expect((await approveAndActivateManualPilot(db,args)).ok).toBe(true);
    expect((await approveAndActivateManualPilot(db,args)).ok).toBe(false);
    expect(await db.prepare('SELECT plan FROM subscriptions').first('plan')).toBe('premium');
    expect(await db.prepare('SELECT granted FROM manual_pilot_credit_grants').first('granted')).toBe(500);
    expect(await getCommittedPilotReceipt(db,'order','user')).toEqual({activationStatus:'ACTIVE_14D',amountVnd:1990000});
    expect(await getCommittedPilotReceipt(db,'order','other')).toBeNull();
  });
  it('rejects cross-user, cross-org and revoked-admin lookups and lists', async () => {
    const {db}=await fixture();
    await db.exec("CREATE TABLE org_members(user_id TEXT,org_id TEXT); INSERT INTO org_members VALUES('user','org');");
    expect(await getManualPilotSettlementByOrderId(db,'order',{userId:'other',orgId:'org'})).toBeNull();
    expect(await getManualPilotSettlementByOrderId(db,'order',{userId:'user',orgId:'other'})).toBeNull();
    expect(await listManualPilotSettlements(db,{scope:{userId:'other',orgId:'org'}})).toEqual([]);
    expect(await listManualPilotSettlements(db,{scope:{adminId:'admin'}})).toHaveLength(1);
    await db.exec("UPDATE user_profiles SET role='user'");
    expect(await listManualPilotSettlements(db,{scope:{adminId:'admin'}})).toEqual([]);
  });
});
