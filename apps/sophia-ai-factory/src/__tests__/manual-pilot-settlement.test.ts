// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { getManualPilotCreditBalance } from '@/seed/billing/manual-pilot-credit-allocation';
import { transitionPilotRefund } from '@/land/payments/manual-pilot/manual-pilot-refund-transitions';
import { receiveManualPilotRefundIntake } from '@/land/payments/manual-pilot/manual-pilot-refund-intake';
import { requestManualPilotRefund } from '@/land/payments/manual-pilot/manual-pilot-refund';
const current=vi.hoisted(()=>({db:null as unknown}));
vi.mock('@/seed/db/client',()=>({getD1:()=>current.db}));
vi.mock('@/seed/utils/logger-utility',()=>({logger:{debug:vi.fn(),error:vi.fn()}}));
vi.mock('@/seed/db/node-sqlite/migrations',()=>({applyMigrations:vi.fn()}));
beforeEach(()=>{
 vi.useFakeTimers({toFake:['Date']});
 vi.setSystemTime(new Date('2099-01-02T00:00:00.000Z'));
});
afterEach(()=>vi.useRealTimers());
async function fixture() {
 const db=new NodeSqliteD1Database(':memory:'); current.db=db;
 await db.exec(readFileSync(resolve('migrations/0506_manual_pilot_settlement_ledger.sql'),'utf8'));
 await db.exec(readFileSync(resolve('migrations/0507_manual_pilot_financial_state.sql'),'utf8'));
 for (const migration of ['0508_manual_pilot_audit_integrity', '0509_manual_pilot_credit_compensation',
  '0510_manual_pilot_delivery_evidence', '0511_manual_pilot_refund_intake']) {
  await db.exec(readFileSync(resolve(`migrations/${migration}.sql`), 'utf8'));
 }
 await db.exec(`CREATE TABLE user_profiles(user_id TEXT,role TEXT);
 CREATE TABLE org_members(user_id TEXT,org_id TEXT);
 CREATE TABLE user_mcu_balance(user_id TEXT PRIMARY KEY,credits_remaining REAL,credits_total_used REAL DEFAULT 0,updated_at TEXT);
 CREATE TABLE mcu_transactions(user_id TEXT,delta REAL,reason TEXT,mission_id TEXT,metadata TEXT);
 INSERT INTO user_profiles VALUES('admin','admin');
 INSERT INTO org_members VALUES('user','org');
 INSERT INTO user_mcu_balance(user_id,credits_remaining) VALUES('user',1000);
 INSERT INTO manual_pilot_settlements(id,order_id,user_id,org_id,expected_amount_vnd,received_amount_vnd,transfer_reference,status,activated_at)
 VALUES('s','order','user','org',1990000,1990000,'ref','activated','2099-01-01');
 INSERT INTO manual_pilot_financial_state VALUES('order','org','ACTIVE_14D','in',NULL,'2099-01-01');
 INSERT INTO manual_pilot_bank_evidence VALUES('in','order','org','inbound','bank','account','in-tx',1990000,'VND','2099-01-01','ref',printf('%064d',0),'fixture','fixture','2099-01-01');
 INSERT INTO manual_pilot_credit_grants VALUES('order','user','org',500,0,0,'2099-01-15');
 INSERT INTO manual_pilot_entitlements VALUES('order','user','org','2099-01-01','2099-01-15',NULL);`);
 return db;
}
const request={orderId:'order',adminId:'admin',reason:'goodwill',category:'goodwill_7d' as const,refundAmountVnd:1990000,nowMs:Date.parse('2099-01-02')};
describe('pilot source provenance and refund safety',()=>{
 it('spends pilot first, then purchased credits, with one ledger',async()=>{
  const db=await fixture(); expect(await deductCredits('user',700,'mission','test')).toBe(true);
  expect(await db.prepare('SELECT consumed FROM manual_pilot_credit_grants').first('consumed')).toBe(500);
  expect(await db.prepare('SELECT credits_remaining FROM user_mcu_balance').first('credits_remaining')).toBe(800);
  expect(await db.prepare('SELECT COUNT(*) n FROM mcu_transactions').first('n')).toBe(1);
 });
 it('rolls allocation and purchased debit back if ledger fails',async()=>{
  const db=await fixture(); await db.exec("CREATE TRIGGER fail BEFORE INSERT ON mcu_transactions BEGIN SELECT RAISE(ABORT,'injected'); END;");
  expect(await deductCredits('user',700,'mission','test')).toBe(false);
  expect(await getManualPilotCreditBalance(db,'user')).toBe(500);
  expect(await db.prepare('SELECT credits_remaining FROM user_mcu_balance').first('credits_remaining')).toBe(1000);
 });
 it('excludes expired and ambiguous-tenant grants consistently',async()=>{
  const db=await fixture(); await db.exec("INSERT INTO org_members VALUES('user','other')");
  expect(await getManualPilotCreditBalance(db,'user')).toBe(0);
  expect(await deductCredits('user',1100,'mission','test')).toBe(false);
  await db.exec("DELETE FROM org_members WHERE org_id='other'; UPDATE manual_pilot_credit_grants SET expires_at='2000-01-01'");
  expect(await getManualPilotCreditBalance(db,'user')).toBe(0);
  expect(await deductCredits('user',1100,'mission','test')).toBe(false);
 });
 it('allows full monetary goodwill refund after consumption without touching purchased balance',async()=>{
  const db=await fixture(); expect(await deductCredits('user',300,'mission','test')).toBe(true);
  const intake = await receiveManualPilotRefundIntake(db, { orderId: request.orderId, category: request.category, reason: request.reason, orgId: 'org',
   beneficiaryBankIdentity: 'customer-bank', beneficiaryAccountIdentity: 'customer-account' }, 'user');
  if (!intake.ok) throw new Error(intake.error.message);
  expect((await requestManualPilotRefund(db,{ ...request, intakeId: intake.value.intakeId })).ok).toBe(true);
  for(const target of ['APPROVED','TRANSFER_PENDING'] as const) expect((await transitionPilotRefund(db,{orderId:'order',adminId:'admin',target})).ok).toBe(true);
  expect((await transitionPilotRefund(db,{orderId:'order',adminId:'admin',target:'SETTLED',evidenceId:'missing'})).ok).toBe(false);
  await db.prepare(`INSERT INTO manual_pilot_bank_evidence VALUES('out','order','org','outbound','bank','account','tx',1990000,'VND','2099-01-02T00:00:00.000Z','ref',?,'fixture','fixture','2099-01-02T00:00:00.000Z')`).bind('a'.repeat(64)).run();
  await db.exec("INSERT INTO manual_pilot_bank_counterparties VALUES('out','customer-bank','customer-account')");
  expect((await transitionPilotRefund(db,{orderId:'order',adminId:'admin',target:'SETTLED',evidenceId:'out'})).ok).toBe(true);
  expect(await getManualPilotCreditBalance(db,'user')).toBe(0);
  expect(await db.prepare('SELECT revoked FROM manual_pilot_credit_grants').first('revoked')).toBe(200);
  expect(await db.prepare('SELECT credits_remaining FROM user_mcu_balance').first('credits_remaining')).toBe(1000);
  expect((await transitionPilotRefund(db,{orderId:'order',adminId:'admin',target:'SETTLED',evidenceId:'out'})).ok).toBe(false);
 });
 it('does not accept an admin-selected delivery failure category as proof',async()=>{
  const db=await fixture();
  const result=await requestManualPilotRefund(db,{
   ...request,category:'delivery_failure_14d',nowMs:Date.parse('2099-01-10'),
  });
  expect(result).toMatchObject({ok:false,error:{code:'INVALID_STATE'}});
  expect(await db.prepare('SELECT status FROM manual_pilot_settlements').first('status')).toBe('activated');
  expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_refund_state').first('n')).toBe(0);
  expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_audit_log').first('n')).toBe(0);
 });
 it('rejects refund intake without independently verified collection',async()=>{
  const db=await fixture();
  const intake = await receiveManualPilotRefundIntake(db, { orderId: request.orderId, category: request.category,
   reason: request.reason, orgId: 'org', beneficiaryBankIdentity: 'customer-bank',
   beneficiaryAccountIdentity: 'customer-account' }, 'user');
  if (!intake.ok) throw new Error(intake.error.message);
  await db.exec("UPDATE manual_pilot_financial_state SET evidence_id=NULL");
  expect(await requestManualPilotRefund(db,{ ...request, intakeId: intake.value.intakeId })).toMatchObject({ok:false,error:{code:'INVALID_STATE'}});
  expect(await db.prepare('SELECT status FROM manual_pilot_settlements').first('status')).toBe('activated');
  expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_refund_state').first('n')).toBe(0);
 });
 it('rejects revoked or missing admin without refund mutation or audit',async()=>{
  const db=await fixture(); await db.exec("UPDATE user_profiles SET role='user'");
  for(const adminId of ['admin','missing']) expect((await requestManualPilotRefund(db,{...request,adminId})).ok).toBe(false);
  expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_audit_log').first('n')).toBe(0);
  expect(await db.prepare('SELECT COUNT(*) n FROM manual_pilot_refund_state').first('n')).toBe(0);
 });
});

it('explicit tenant selector enables only membership-bound grant for multi-org users',async()=>{
 const db=await fixture(); await db.exec("INSERT INTO org_members VALUES('user','other')");
 expect(await getManualPilotCreditBalance(db,'user','org')).toBe(500);
 expect(await getManualPilotCreditBalance(db,'user','other')).toBe(0);
 expect(await getManualPilotCreditBalance(db,'user','not-member')).toBe(0);
 expect(await deductCredits('user',1100,'mission','test','other')).toBe(false);
 expect(await deductCredits('user',1100,'mission','test','org')).toBe(true);
 expect(await db.prepare('SELECT credits_remaining FROM user_mcu_balance').first('credits_remaining')).toBe(400);
});
