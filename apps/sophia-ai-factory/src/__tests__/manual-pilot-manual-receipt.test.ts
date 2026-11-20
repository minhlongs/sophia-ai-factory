// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { sendCommittedManualPilotReceipt } from '@/land/payments/manual-pilot/manual-pilot-receipt';
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@/land/billing/email/receipt-email-sender', () => ({ sendReceiptEmail: mocks.send }));
vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));
async function fixture() {
  mocks.send.mockReset();
  const db = new NodeSqliteD1Database(':memory:');
  for (const file of ['0506_manual_pilot_settlement_ledger.sql','0507_manual_pilot_financial_state.sql','0002-payment-events.sql']) {
    await db.exec(readFileSync(resolve('migrations',file),'utf8'));
  }
  await db.exec(`CREATE TABLE "user"(id TEXT,email TEXT,name TEXT);
    INSERT INTO "user" VALUES('user','customer@example.com','Customer');
    INSERT INTO manual_pilot_settlements(id,order_id,user_id,org_id,expected_amount_vnd,transfer_reference,status)
      VALUES('s','order','user','org',1990000,'reference','activated');
    INSERT INTO manual_pilot_bank_evidence VALUES('e','order','org','inbound','bank','account','tx',1990000,'VND','2026-11-19','reference','${'a'.repeat(64)}','source','verifier','2026-11-19');
    INSERT INTO manual_pilot_financial_state VALUES('order','org','ACTIVE_14D','e',NULL,'2026-11-19');
    INSERT INTO manual_pilot_entitlements VALUES('order','user','org','2026-11-19','2099-01-01',NULL);`);
  return db;
}
describe('manual activation committed receipt delivery', () => {
  it('uses the customer email, committed amount and stable payment identity', async () => {
    const db=await fixture();
    await sendCommittedManualPilotReceipt(db,'order','user');
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({email:'customer@example.com',paymentId:'order',
      paymentMethod:'manual_bank',amountVnd:1990000,activationStatus:'ACTIVE_14D',period:'pilot_14d'}));
    await sendCommittedManualPilotReceipt(db,'order','user');
    expect(await db.prepare('SELECT COUNT(*) n FROM payment_events').first('n')).toBe(1);
    expect(await db.prepare('SELECT event_id FROM payment_events').first('event_id')).toBe('manual_bank_order');
  });
  it('does not send without committed activation or for the wrong customer', async () => {
    const db=await fixture();
    await sendCommittedManualPilotReceipt(db,'order','other');
    await db.exec("UPDATE manual_pilot_financial_state SET state='ADMIN_APPROVED'");
    await sendCommittedManualPilotReceipt(db,'order','user');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('leaves activation committed when delivery fails', async () => {
    const db=await fixture(); mocks.send.mockRejectedValue(new Error('offline'));
    await expect(sendCommittedManualPilotReceipt(db,'order','user')).resolves.toBeUndefined();
    expect(await db.prepare('SELECT state FROM manual_pilot_financial_state').first('state')).toBe('ACTIVE_14D');
    expect(await db.prepare('SELECT COUNT(*) n FROM payment_events').first('n')).toBe(1);
  });
  it('skips invalid customer email', async () => {
    const db=await fixture(); await db.exec("UPDATE user SET email='invalid'");
    await sendCommittedManualPilotReceipt(db,'order','user');
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
