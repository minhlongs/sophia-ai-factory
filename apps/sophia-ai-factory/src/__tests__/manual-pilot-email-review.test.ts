// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { openEmailRefundReceiptReview, attachEmailReceiptEvidence } from '@/land/payments/manual-pilot/manual-pilot-email-review';
import { assessEmailReceiptWindow, reviewEmailReceiptAuthority } from '@/land/payments/manual-pilot/manual-pilot-email-eligibility';
import { receiveManualPilotRefundIntake } from '@/land/payments/manual-pilot/manual-pilot-refund-intake';
vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));
let db: NodeSqliteD1Database;
const instruction = { orderId: 'order', orgId: 'org', category: 'goodwill_7d' as const, reason: 'Please refund', beneficiaryBankIdentity: 'bank', beneficiaryAccountIdentity: 'account' };
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2099-02-01'));
  db = new NodeSqliteD1Database(':memory:');
  for (const file of readdirSync('migrations').filter((f) => /^05(0[6-9]|1[0-3])_/.test(f)).sort()) await db.exec(readFileSync(`migrations/${file}`, 'utf8'));
  await db.exec(`CREATE TABLE user_profiles(user_id TEXT,role TEXT); INSERT INTO user_profiles VALUES('admin','admin');
    CREATE TABLE org_members(user_id TEXT,org_id TEXT); INSERT INTO org_members VALUES('user','org');
    INSERT INTO manual_pilot_settlements(id,order_id,user_id,org_id,expected_amount_vnd,transfer_reference,status,activated_at)
    VALUES('s','order','user','org',1990000,'ref','activated','2099-01-01T17:00:00.000Z');
    INSERT INTO manual_pilot_financial_state VALUES('order','org','ACTIVE_14D',NULL,NULL,'2099-01-01');`);
});
afterEach(() => vi.useRealTimers());
it('preserves delayed email review pending despite forged Received and sender Date headers', async () => {
  const opened = await openEmailRefundReceiptReview(db, { ...instruction, untrustedSenderDateHeader: '2099-01-02' }, 'admin');
  expect(opened.ok).toBe(true); if (!opened.ok) return;
  const bytes = new TextEncoder().encode('From: customer@example.invalid\r\nReceived: forged; 02 Jan 2099\r\nDate: 02 Jan 2099\r\n\r\nRefund');
  expect((await attachEmailReceiptEvidence(db, { reviewId: opened.value.reviewId, orderId: 'order', orgId: 'org', filename: 'receipt.eml', mimeType: 'message/rfc822', bytes }, 'admin', { put: async () => {} })).ok).toBe(true);
  const result = await reviewEmailReceiptAuthority(db, { reviewId: opened.value.reviewId, orderId: 'order', orgId: 'org' }, 'admin');
  expect(result.ok && result.value.eligibilityOutcome).toBe('PENDING_MANUAL_REVIEW');
  expect(await db.prepare('SELECT provider_received_at FROM manual_pilot_email_receipt_reviews').first('provider_received_at')).toBeNull();
  expect(await db.prepare('SELECT count(*) n FROM manual_pilot_refund_intakes').first('n')).toBe(0);
});
it('rejects admin historical timestamp injection and unauthorized verification', async () => {
  const opened = await openEmailRefundReceiptReview(db, instruction, 'admin'); if (!opened.ok) throw Error('open');
  const select = { reviewId: opened.value.reviewId, orderId: 'order', orgId: 'org' };
  expect((await reviewEmailReceiptAuthority(db, { ...select, providerReceivedAt: '2099-01-02' }, 'admin')).ok).toBe(false);
  expect((await reviewEmailReceiptAuthority(db, select, 'customer')).ok).toBe(false);
});
it('identical authenticated web receipt retries preserve server time; changed beneficiary conflicts', async () => {
  const first = await receiveManualPilotRefundIntake(db, instruction, 'user'); expect(first.ok).toBe(true);
  vi.setSystemTime(new Date('2099-02-02'));
  expect(await receiveManualPilotRefundIntake(db, instruction, 'user')).toEqual(first);
  expect((await receiveManualPilotRefundIntake(db, { ...instruction, beneficiaryAccountIdentity: 'attacker' }, 'user')).ok).toBe(false);
  expect((await receiveManualPilotRefundIntake(db, { ...instruction, reason: 'changed reason' }, 'user')).ok).toBe(false);
});
it.each(['goodwill_7d', 'delivery_failure_14d'] as const)('uses inclusive UTC+7 anniversary and never denies missing authority for %s', (category) => {
  const activatedAt = '2099-01-01T17:00:00.123Z'; const days = category === 'goodwill_7d' ? 7 : 14;
  const end = Date.parse(activatedAt) + days * 86400000;
  const base = { activatedAt, category, receiverAuthoritative: true, deliveryFailureVerified: true };
  expect(assessEmailReceiptWindow({ ...base, receivedAt: new Date(end).toISOString() })).toBe('ELIGIBLE_TIMELY');
  expect(assessEmailReceiptWindow({ ...base, receivedAt: new Date(end + 1).toISOString() })).toBe('INELIGIBLE_OUTSIDE_WINDOW');
  expect(assessEmailReceiptWindow({ ...base, receivedAt: new Date(end + 1000).toISOString(), receiverAuthoritative: false })).toBe('PENDING_MANUAL_REVIEW');
  expect(assessEmailReceiptWindow({ ...base, receivedAt: null })).toBe('PENDING_MANUAL_REVIEW');
});
it('missing delivery attribution remains pending', () => {
  expect(assessEmailReceiptWindow({ activatedAt: '2099-01-01', receivedAt: '2099-01-02', category: 'delivery_failure_14d', receiverAuthoritative: true, deliveryFailureVerified: false })).toBe('PENDING_MANUAL_REVIEW');
});
it('SQLite blocks final eligibility without authoritative receiver evidence', async () => {
  await openEmailRefundReceiptReview(db, instruction, 'admin');
  await expect(db.exec("UPDATE manual_pilot_email_receipt_reviews SET state='ELIGIBILITY_ASSESSED',eligibility_outcome='INELIGIBLE_OUTSIDE_WINDOW'")).rejects.toThrow();
});
