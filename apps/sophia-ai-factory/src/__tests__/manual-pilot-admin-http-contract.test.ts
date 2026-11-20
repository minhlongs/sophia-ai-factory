// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/admin/billing/manual-pilot/route';
import { POST as review } from '@/app/api/admin/billing/manual-pilot/email-review/route';
import { mintAdminChallengeToken } from '@/seed/auth/admin/challenge-token';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';

const infra = vi.hoisted(() => ({
  session: vi.fn(),
  storage: vi.fn(),
  put: vi.fn<(key: string, bytes: Uint8Array, options: { customMetadata: { sha256: string } }) => Promise<void>>(),
}));
vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUserFromHeaders: infra.session }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: infra.storage }));
vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));

const base = 'https://example.invalid/api/admin/billing/manual-pilot';
const instruction = {
  orderId: 'active-order', orgId: 'org', category: 'goodwill_7d', reason: 'Please refund',
  beneficiaryBankIdentity: 'bank', beneficiaryAccountIdentity: 'account',
  untrustedSenderDateHeader: '2099-01-03',
};
const mail = 'From: customer@example.invalid\r\nReceived: untrusted fixture; 03 Jan 2099\r\n\r\nPlease refund';
let db: NodeSqliteD1Database;
let cookie: string;

beforeEach(async () => {
  const secret = randomUUID();
  vi.stubEnv('ADMIN_CHALLENGE_SECRET', secret);
  cookie = `admin_challenge_token=${await mintAdminChallengeToken('admin', secret)}`;
  infra.session.mockResolvedValue({ id: 'admin' });
  infra.put.mockResolvedValue(undefined);
  infra.storage.mockResolvedValue({ env: { PRIVATE_BANK_ARTIFACTS: { put: infra.put },
    PILOT_BANK_NAME: 'Fixture bank', PILOT_BANK_ACCOUNT_NUMBER: 'fixture-account',
    PILOT_BANK_ACCOUNT_HOLDER: 'Fixture holder', PILOT_BANK_TRANSFER_PREFIX: 'pilot-test' } });
  db = new NodeSqliteD1Database(':memory:');
  vi.stubGlobal('__env__', { DB: db });
  const migrations = readdirSync('migrations').filter((file) => /^05(0[6-9]|1[0-4])_/.test(file) || file === '0070-pending-orders.sql').sort();
  expect(migrations).toHaveLength(10);
  for (const file of migrations) await db.exec(readFileSync(`migrations/${file}`, 'utf8'));
  // Active order is pre-existing context for the review, not evidence of a bank or mailbox event.
  await db.exec(`CREATE TABLE user_profiles(user_id TEXT,role TEXT);
    INSERT INTO user_profiles VALUES('admin','admin'),('customer','user');
    INSERT INTO pending_orders(order_id,user_id,tier,amount_usd_cents,status)
      VALUES('pending-order','customer','basic',1990,'pending');
    INSERT INTO manual_pilot_settlements
      (id,order_id,user_id,org_id,expected_amount_vnd,transfer_reference,status,activated_at) VALUES
      ('p','pending-order','customer','org',1990000,'pending-ref','pending_manual_payment',NULL),
      ('a','active-order','customer','org',1990000,'active-ref','activated','2099-01-02T00:00:00Z');
    INSERT INTO manual_pilot_financial_state VALUES
      ('pending-order','org','PENDING_ORDER',NULL,NULL,'2099-01-01'),
      ('active-order','org','ACTIVE_14D',NULL,NULL,'2099-01-02');`);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function request(body: string | undefined, path = '', type = 'application/json', challenge = cookie, metadata = {}) {
  return new NextRequest(`${base}${path}`, { method: 'POST', body,
    headers: { 'content-type': type, cookie: challenge, ...metadata } });
}
const reconcile = (body: unknown) => POST(request(JSON.stringify(body)));
const reviewJson = (body: unknown) => review(request(JSON.stringify(body), '/email-review'));
const open = () => reviewJson({ action: 'open', ...instruction });
const upload = (reviewId: string, body = mail) => review(request(body, '/email-review', 'message/rfc822', cookie, {
  'x-review-id': reviewId, 'x-order-id': instruction.orderId, 'x-org-id': instruction.orgId,
  'x-artifact-filename': 'receipt.eml',
}));

async function expectNoEvidenceOrMoney() {
  for (const table of ['manual_pilot_bank_evidence', 'manual_pilot_credit_grants',
    'manual_pilot_entitlements', 'manual_pilot_refund_intakes']) {
    expect(await db.prepare(`SELECT count(*) AS n FROM ${table}`).first('n'), table).toBe(0);
  }
}

it('lists only the requested status and exposes no bank account details', async () => {
  const response = await GET(new NextRequest(`${base}?status=pending_manual_payment&limit=not-a-number`));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    settlements: [expect.objectContaining({ order_id: 'pending-order', status: 'pending_manual_payment' })],
    bankConfigStatus: { configured: true, transferPrefix: 'PILOT-TEST' },
  });
});

it.each([['anonymous', null, 401], ['non-admin', { id: 'customer' }, 403]] as const)(
  'rejects %s on all admin handlers', async (_name, user, status) => {
    infra.session.mockResolvedValue(user);
    const requests = [request('{}'), request('{}', '/email-review')];
    expect((await GET(new NextRequest(base))).status).toBe(status);
    expect((await POST(requests[0])).status).toBe(status);
    expect((await review(requests[1])).status).toBe(status);
    expect(requests.every((item) => !item.bodyUsed)).toBe(true);
    expect(infra.storage).not.toHaveBeenCalled();
  },
);

it.each([['missing', '', 401], ['invalid', 'admin_challenge_token=invalid', 403]] as const)(
  'requires recent admin authentication on both mutations (%s challenge)', async (_name, challenge, status) => {
    for (const [handler, path] of [[POST, ''], [review, '/email-review']] as const) {
      const input = request('{}', path, 'application/json', challenge);
      const response = await handler(input);
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ error: 'Re-authentication required' });
      expect(input.bodyUsed).toBe(false);
    }
  },
);

it('validates manual reconciliation and refuses to activate on operator input alone', async () => {
  expect((await POST(request('{'))).status).toBe(400);
  expect((await reconcile({ action: 'reject', orderId: 'x' })).status).toBe(400);
  expect((await reconcile({ action: 'verify_settlement', orderId: 'pending-order' })).status).toBe(400);
  expect((await reconcile({ action: 'verify_settlement', orderId: 'pending-order', evidenceId: 'missing' })).status).toBe(409);
  const response = await reconcile({ action: 'approve_and_activate', orderId: 'pending-order',
    receivedAmountVnd: 1990000, bankTransactionRef: 'operator-note' });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'INVALID_STATE' });
  expect(await db.prepare("SELECT state FROM manual_pilot_financial_state WHERE order_id='pending-order'").first('state')).toBe('PENDING_ORDER');
  await expectNoEvidenceOrMoney();
});

it('rejects a pending settlement and commits its order and audit projections exactly once', async () => {
  const action = { action: 'reject', orderId: 'pending-order', auditNotes: 'Transfer not established' };
  expect((await reconcile({ ...action, orderId: 'missing' })).status).toBe(404);
  const response = await reconcile(action);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'rejected', settlement: { order_id: 'pending-order' } });
  expect((await reconcile(action)).status).toBe(409);
  expect(await db.prepare('SELECT status FROM pending_orders').first('status')).toBe('failed');
  expect((await db.prepare('SELECT from_state,to_state,actor_id FROM manual_pilot_financial_events').all()).results)
    .toEqual([{ from_state: 'PENDING_ORDER', to_state: 'REJECTED', actor_id: 'admin' }]);
  expect((await db.prepare('SELECT action,actor_admin_id FROM manual_pilot_audit_log').all()).results)
    .toEqual([{ action: 'rejected', actor_admin_id: 'admin' }]);
  await expectNoEvidenceOrMoney();
});

it('rejects missing bodies, invalid JSON and metadata, and oversized bodies before storage', async () => {
  expect((await review(request(undefined, '/email-review'))).status).toBe(400);
  expect((await review(request('{', '/email-review'))).status).toBe(400);
  expect((await reviewJson({ action: 'verify_receipt' })).status).toBe(400);
  expect((await review(request(mail, '/email-review', 'message/rfc822'))).status).toBe(400);
  for (const response of [await review(request(' '.repeat(8193), '/email-review')),
    await upload('review-id', 'x'.repeat(5242881))]) {
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Body too large' });
  }
  expect(infra.storage).not.toHaveBeenCalled();
  expect(await db.prepare('SELECT count(*) AS n FROM manual_pilot_email_receipt_reviews').first('n')).toBe(0);
});

it('stores a private receipt but keeps both review actions pending without authoritative arrival', async () => {
  const opened = await open();
  expect(opened.status).toBe(200);
  const openedBody = await opened.json() as { reviewId: string };
  const { reviewId } = openedBody;
  infra.storage.mockResolvedValueOnce({ env: {} });
  const unavailable = await upload(reviewId);
  expect(unavailable.status).toBe(503);
  expect(await unavailable.json()).toEqual({ error: 'Private evidence storage unavailable' });
  expect(infra.put).not.toHaveBeenCalled();
  expect(await db.prepare('SELECT state FROM manual_pilot_email_receipt_reviews').first('state')).toBe('RECEIVED_UNVERIFIED');
  const attached = await upload(reviewId);
  expect(attached.status).toBe(200);
  expect(await attached.json()).toEqual({ reviewId, state: 'RECEIPT_EVIDENCE_ATTACHED' });
  const sha256 = createHash('sha256').update(mail).digest('hex');
  const key = await db.prepare('SELECT artifact_storage_key FROM manual_pilot_email_receipt_reviews').first('artifact_storage_key');
  expect(key).toMatch(/^private\/manual-pilot-email-receipts\/org\/active-order\/.+\.eml$/);
  expect(infra.put).toHaveBeenCalledExactlyOnceWith(key, new TextEncoder().encode(mail), { customMetadata: { sha256 } });
  const selection = { reviewId, orderId: instruction.orderId, orgId: instruction.orgId };
  expect((await reviewJson({ action: 'verify_receipt', ...selection, providerReceivedAt: '2099-01-03' })).status).toBe(400);
  expect((await reviewJson({ action: 'verify_receipt', ...selection, orgId: 'other' })).status).toBe(409);
  for (const action of ['verify_receipt', 'assess_eligibility']) {
    const response = await reviewJson({ action, ...selection });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reviewId, eligibilityOutcome: 'PENDING_MANUAL_REVIEW', blockedReason: 'AUTHORITATIVE_RECEIVER_UNAVAILABLE' });
  }
  expect(await db.prepare(`SELECT state,eligibility_outcome,provider_received_at,provider_mailbox_message_id,artifact_sha256
    FROM manual_pilot_email_receipt_reviews`).first()).toEqual({ state: 'RECEIPT_EVIDENCE_ATTACHED',
    eligibility_outcome: 'PENDING_MANUAL_REVIEW', provider_received_at: null, provider_mailbox_message_id: null, artifact_sha256: sha256 });
  expect((await db.prepare('SELECT to_state,actor_id FROM manual_pilot_email_review_events ORDER BY rowid').all()).results)
    .toEqual([{ to_state: 'RECEIVED_UNVERIFIED', actor_id: 'admin' }, { to_state: 'RECEIPT_EVIDENCE_ATTACHED', actor_id: 'admin' }]);
  await expectNoEvidenceOrMoney();
});
