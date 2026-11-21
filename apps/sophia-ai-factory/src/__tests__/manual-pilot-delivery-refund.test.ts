// @vitest-environment node
import type { D1Database } from '@cloudflare/workers-types';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/admin/billing/manual-pilot/refund/route';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { mintAdminChallengeToken } from '@/seed/auth/require-admin';
import { getD1Raw } from '@/seed/db/client';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { receiveManualPilotRefundIntake } from '@/land/payments/manual-pilot/manual-pilot-refund-intake';
import { requestManualPilotRefund } from '@/land/payments/manual-pilot/manual-pilot-refund';

vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1Raw: vi.fn() }));
vi.mock('@/seed/db/get-user-tier', () => ({ invalidateUserTierCache: vi.fn() }));
vi.mock('@/seed/auth/org-resolver', () => ({ invalidateOrgIdCache: vi.fn() }));
vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUserFromHeaders: vi.fn() }));
vi.mock('@/seed/auth/is-user-admin', () => ({ isUserAdmin: vi.fn() }));

const paid = 1_990_000;
// The activation's UTC date is the day before its local date.
const activated = '2026-11-19T17:15:00.123Z';
const day7 = '2026-11-27T00:15:00.123+07:00';
const day14 = '2026-12-04T00:15:00.123+07:00';
const secret = 'local-test-admin-challenge-secret';
const goodwill = { orderId: 'pilot-one', adminId: 'verifier', category: 'goodwill_7d' as const,
  reason: 'Goodwill refund', refundAmountVnd: paid, nowMs: Date.parse(day7) };
const proof = { action: 'verify_delivery_failure', orderId: 'pilot-one', orgId: 'org-one',
  scope: 'option_a_script', attribution: 'sophia', artifactRef: 'incident:local-pilot-delivery-42',
  artifactSha256: 'a'.repeat(64), occurredAt: '2026-11-30T23:58:00+07:00' };
const request = { action: 'request', orderId: 'pilot-one', category: 'delivery_failure_14d',
  reason: 'Requested a refund for missed script delivery', refundAmountVnd: paid };

async function fixture() {
  const db = new NodeSqliteD1Database(':memory:');
  for (const name of ['0506_manual_pilot_settlement_ledger', '0507_manual_pilot_financial_state',
    '0508_manual_pilot_audit_integrity', '0510_manual_pilot_delivery_evidence',
    '0511_manual_pilot_refund_intake']) {
    await db.exec(readFileSync(`migrations/${name}.sql`, 'utf8'));
  }
  await db.exec(`CREATE TABLE user_profiles(user_id TEXT PRIMARY KEY, role TEXT);
    CREATE TABLE org_members(user_id TEXT,org_id TEXT);
    INSERT INTO org_members VALUES('user','org-one');
    INSERT INTO user_profiles VALUES('verifier','admin');
    INSERT INTO manual_pilot_settlements
      (id,order_id,user_id,org_id,expected_amount_vnd,received_amount_vnd,transfer_reference,status,activated_at)
    VALUES('settlement-one','pilot-one','user','org-one',${paid},${paid},'ref-one','activated','${activated}'),
      ('settlement-two','pilot-two','user','org-one',${paid},${paid},'ref-two','activated','${activated}');
    INSERT INTO manual_pilot_financial_state
    VALUES('pilot-one','org-one','ACTIVE_14D','in-one',NULL,'${activated}'),
      ('pilot-two','org-one','ACTIVE_14D','in-two',NULL,'${activated}');
    INSERT INTO manual_pilot_bank_evidence
    VALUES('in-one','pilot-one','org-one','inbound','bank','account','tx-one',${paid},'VND',
        '${activated}','ref-one',printf('%064d',0),'fixture','fixture','${activated}'),
      ('in-two','pilot-two','org-one','inbound','bank','account','tx-two',${paid},'VND',
        '${activated}','ref-two',printf('%064d',0),'fixture','fixture','${activated}');`);
  return db;
}

async function customerIntake(db: D1Database, category: 'goodwill_7d' | 'delivery_failure_14d') {
  const result = await receiveManualPilotRefundIntake(db, { orderId: 'pilot-one', orgId: 'org-one',
    category, reason: 'Customer refund instruction', beneficiaryBankIdentity: 'customer-bank',
    beneficiaryAccountIdentity: 'customer-account' }, 'user');
  if (!result.ok) throw new Error(result.error.message);
  return result.value.intakeId;
}

async function post(db: D1Database, body: object, authenticated = true) {
  if ('action' in body && body.action === 'request' && !('intakeId' in body)) {
    body = { ...body, intakeId: await customerIntake(db, 'delivery_failure_14d') };
  }
  vi.stubEnv('ADMIN_CHALLENGE_SECRET', secret);
  vi.mocked(getCurrentUserFromHeaders).mockResolvedValue(authenticated
    ? { id: 'verifier', email: 'admin@test.invalid', role: 'admin' } : null);
  vi.mocked(isUserAdmin).mockResolvedValue(true);
  vi.mocked(getD1Raw).mockResolvedValue(db);
  const challenge = await mintAdminChallengeToken('verifier', secret);
  return POST(new NextRequest('http://localhost/api/admin/billing/manual-pilot/refund', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie: `admin_challenge_token=${challenge}` },
  }));
}

async function verify(db: D1Database, fields = {}) {
  const response = await post(db, { ...proof, ...fields });
  expect(response.status).toBe(200);
  return (await response.json() as { evidenceId: string }).evidenceId;
}

async function expectNoRefund(db: D1Database) {
  expect(await db.prepare("SELECT status FROM manual_pilot_settlements WHERE order_id='pilot-one'").first('status')).toBe('activated');
  expect(await db.prepare('SELECT COUNT(*) AS n FROM manual_pilot_refund_state').first('n')).toBe(0);
  expect(await db.prepare("SELECT COUNT(*) AS n FROM manual_pilot_audit_log WHERE action='refund_requested'").first('n')).toBe(0);
}

function setClock(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
  return { mockReturnValue: (ms: number) => vi.setSystemTime(new Date(ms)) };
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('manual pilot refund intake with real SQLite and HTTP guard', () => {
  it('verifies separate evidence and requests a full refund at the exact fourteenth local anniversary', async () => {
    const db = await fixture();
    const now = setClock(day14);
    const evidenceId = await verify(db, { adminId: 'body-is-not-the-actor' });
    expect(await db.prepare('SELECT verified_by_admin_id FROM manual_pilot_delivery_evidence WHERE id=?')
      .bind(evidenceId).first('verified_by_admin_id')).toBe('verifier');
    expect((await post(db, { ...request, deliveryEvidenceId: evidenceId })).status).toBe(200);
    const requestedAt = new Date(Date.parse(day14)).toISOString();
    expect(await db.prepare('SELECT amount_vnd,requested_at,evidence_id FROM manual_pilot_refund_state').first())
      .toEqual({ amount_vnd: paid, requested_at: requestedAt, evidence_id: null });
    const metadata = await db.prepare("SELECT metadata_json FROM manual_pilot_audit_log WHERE action='refund_requested'")
      .first<string>('metadata_json');
    expect(JSON.parse(metadata ?? '{}')).toMatchObject({ deliveryEvidenceId: evidenceId, category: 'delivery_failure_14d' });
    now.mockReturnValue(Date.parse(day14) + 86_400_000);
    expect((await post(db, { action: 'approve', orderId: request.orderId })).status).toBe(200);
    expect(await db.prepare('SELECT state,requested_at FROM manual_pilot_refund_state').first())
      .toEqual({ state: 'APPROVED', requested_at: requestedAt });
  });

  it.each([1, 86_400_000])('rejects a delivery refund %i ms after the exact anniversary', async (elapsed) => {
    const db = await fixture();
    const now = setClock(day14);
    const deliveryEvidenceId = await verify(db);
    now.mockReturnValue(Date.parse(day14) + elapsed);
    const response = await post(db, { ...request, deliveryEvidenceId });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'REFUND_WINDOW_EXCEEDED' });
    await expectNoRefund(db);
  });

  it('does not let an evidence ID, category or free text alone establish coverage', async () => {
    const db = await fixture();
    setClock(day14);
    expect((await post(db, { ...request, ...proof, action: 'request' })).status).toBe(409);
    expect((await post(db, { ...request, deliveryEvidenceId: 'unknown' })).status).toBe(409);
    await expectNoRefund(db);
  });

  it.each([{ scope: 'option_b_video' }, { attribution: 'byok' }, { artifactSha256: 'unverified' },
    { orgId: 'org-other' }, { occurredAt: '2026-11-19T17:15:00.122Z' },
    { occurredAt: '2026-12-03T17:15:00.124Z' }])('rejects ineligible verification: %o', async (fields) => {
    const db = await fixture();
    setClock(day14);
    expect((await post(db, { ...proof, ...fields })).ok).toBe(false);
    await expectNoRefund(db);
  });

  it('rejects anonymous or revoked verification and rejects evidence borrowed from another order or tenant', async () => {
    const db = await fixture();
    setClock(day14);
    expect((await post(db, proof, false)).status).toBe(401);
    await db.exec("UPDATE user_profiles SET role='user'");
    expect((await post(db, proof)).ok).toBe(false);
    await db.exec("UPDATE user_profiles SET role='admin'");
    const deliveryEvidenceId = await verify(db, { orderId: 'pilot-two' });
    expect((await post(db, { ...request, deliveryEvidenceId })).status).toBe(409);
    const ownEvidence = await verify(db, { artifactRef: 'incident:second-record' });
    const intakeId = await customerIntake(db, 'delivery_failure_14d');
    await db.exec("UPDATE manual_pilot_settlements SET org_id='org-other' WHERE order_id='pilot-one'");
    expect((await post(db, { ...request, intakeId, deliveryEvidenceId: ownEvidence })).status).toBe(409);
    await expectNoRefund(db);
  });

  it('keeps verified evidence immutable and requires independently verified collection and the exact total', async () => {
    const db = await fixture();
    setClock(day14);
    const deliveryEvidenceId = await verify(db);
    for (const sql of ["UPDATE manual_pilot_delivery_evidence SET artifact_ref='forged'",
      'DELETE FROM manual_pilot_delivery_evidence',
      'INSERT OR REPLACE INTO manual_pilot_delivery_evidence SELECT * FROM manual_pilot_delivery_evidence',
      "INSERT OR REPLACE INTO manual_pilot_delivery_evidence SELECT 'replacement',order_id,org_id,scope,attribution,artifact_ref,artifact_sha256,occurred_at,verified_by_admin_id,verified_at,'other-event',policy_timezone,policy_window_days,policy_version FROM manual_pilot_delivery_evidence",
      'UPDATE manual_pilot_financial_events SET actor_id=\'forged\'', 'DELETE FROM manual_pilot_financial_events',
      'INSERT OR REPLACE INTO manual_pilot_financial_events SELECT * FROM manual_pilot_financial_events']) {
      await expect(db.exec(sql)).rejects.toThrow('immutable');
    }
    expect((await post(db, { ...request, deliveryEvidenceId, refundAmountVnd: paid - 1 })).status).toBe(400);
    expect((await post(db, { ...request, deliveryEvidenceId, refundAmountVnd: paid + 1 })).status).toBe(400);
    await db.exec("UPDATE manual_pilot_financial_state SET evidence_id=NULL WHERE order_id='pilot-one'");
    expect((await post(db, { ...request, deliveryEvidenceId })).status).toBe(409);
    await expectNoRefund(db);
  });

  it('includes the seventh local anniversary for goodwill but rejects the next millisecond', async () => {
    const db = await fixture();
    setClock(new Date(goodwill.nowMs + 1).toISOString());
    const lateIntake = await customerIntake(db, 'goodwill_7d');
    expect(await requestManualPilotRefund(db, { ...goodwill, intakeId: lateIntake, nowMs: goodwill.nowMs + 1 }))
      .toMatchObject({ ok: false, error: { code: 'REFUND_WINDOW_EXCEEDED' } });
    const timelyDb = await fixture(); setClock(day7);
    const intakeId = await customerIntake(timelyDb, 'goodwill_7d');
    expect((await requestManualPilotRefund(timelyDb, { ...goodwill, intakeId })).ok).toBe(true);
  });

  it('enforces validation and server time even when the caller supplies an earlier request time', async () => {
    const db = await fixture();
    const now = setClock(day14);
    expect((await post(db, { ...proof, occurredAt: 'invalid' })).status).toBe(400);
    const deliveryEvidenceId = await verify(db);
    now.mockReturnValue(Date.parse(day14) + 1);
    expect((await post(db, { ...request, deliveryEvidenceId, nowMs: Date.parse(day14), requestedAt: day14 })).status).toBe(400);
    await expectNoRefund(db);
  });

  it.each(['manual_pilot_delivery_evidence', 'manual_pilot_financial_events'])('never returns verified when %s ignores insertion', async (table) => {
    const db = await fixture();
    setClock(day14);
    await db.exec(`CREATE TRIGGER skip_verification BEFORE INSERT ON ${table} BEGIN SELECT RAISE(IGNORE); END`);
    expect((await post(db, proof)).ok).toBe(false);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM manual_pilot_delivery_evidence').first('n')).toBe(0);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM manual_pilot_financial_events').first('n')).toBe(0);
  });

  it.each(['manual_pilot_audit_log', 'manual_pilot_refund_state'])('rolls back when %s silently skips insertion', async (table) => {
    const db = await fixture();
    await db.exec(`CREATE TRIGGER ignore_insert BEFORE INSERT ON ${table} BEGIN SELECT RAISE(IGNORE); END`);
    setClock(day7);
    const intakeId = await customerIntake(db, 'goodwill_7d');
    expect(await requestManualPilotRefund(db, { ...goodwill, intakeId })).toMatchObject({ ok: false, error: { code: 'DB_ERROR' } });
    await expectNoRefund(db);
  });
});
