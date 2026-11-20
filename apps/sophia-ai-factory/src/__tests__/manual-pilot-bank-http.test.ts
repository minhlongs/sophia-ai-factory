// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { OperatorProtectedBankEvidenceVerifier } from '@/land/payments/manual-pilot/manual-pilot-protected-bank-verifier';
import { POST } from '@/app/api/admin/billing/manual-pilot/bank-evidence/route';
const state = vi.hoisted(() => ({ db: null as unknown, authorized: true, objects: new Map<string, Uint8Array>(), reads: 0 }));
vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1Raw: async () => state.db }));
vi.mock('@/seed/auth/require-admin', () => ({ requireAdminWithRecentAuth: async () => state.authorized ? { user: { id: 'admin' } } : new Response(null, { status: 403 }) }));
vi.mock('@/seed/config/pilot-bank-config', () => ({ resolvePilotBankConfig: async () => ({ configured: true, bankName: 'bank', accountNumber: 'account' }) }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { PRIVATE_BANK_ARTIFACTS: {
  put: async (key: string, bytes: Uint8Array) => { state.objects.set(key, bytes.slice()); },
  get: async (key: string) => { state.reads++; const bytes = state.objects.get(key); return bytes ? { size: bytes.length, arrayBuffer: async () => bytes.slice().buffer } : null; },
} } }) }));
let db: NodeSqliteD1Database;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2099-01-02'));
  state.authorized = true; state.objects.clear(); state.reads = 0;
  db = new NodeSqliteD1Database(':memory:'); state.db = db;
  for (const file of readdirSync('migrations').filter((f) => /^05(0[6-9]|1[0-3])_/.test(f)).sort()) await db.exec(readFileSync(`migrations/${file}`, 'utf8'));
  await db.exec(`CREATE TABLE user_profiles(user_id TEXT,role TEXT); INSERT INTO user_profiles VALUES('admin','admin');
    INSERT INTO manual_pilot_settlements(id,order_id,user_id,org_id,expected_amount_vnd,transfer_reference) VALUES('s','order','user','org',1990000,'ref');
    INSERT INTO manual_pilot_financial_state VALUES('order','org','PENDING_ORDER',NULL,NULL,'2099-01-01');`);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function upload(body = '%PDF-1.7\nOriginal statement\n%%EOF') {
  return POST(new NextRequest('https://example.invalid/api/admin/billing/manual-pilot/bank-evidence', { method: 'POST',
    headers: { 'content-type': 'application/pdf', 'x-order-id': 'order', 'x-org-id': 'org', 'x-bank-direction': 'inbound', 'x-artifact-filename': 'bank.pdf' }, body }));
}
function verify(artifactId: string) {
  return POST(new NextRequest('https://example.invalid/api/admin/billing/manual-pilot/bank-evidence', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ approved: true, accountIdentity: 'account', artifactId, orderId: 'order', orgId: 'org', direction: 'inbound', inspectionSource: 'official_bank_statement', bankIdentity: 'bank', originalBankTxnId: 'bank-tx', amountVnd: 1990000, currency: 'VND', orderReference: 'ref', bankRecordTimestamp: '2099-01-01T23:00:00Z' }) }));
}
it('production HTTP calls through real verifier and reads protected bytes before storing evidence', async () => {
  const spy = vi.spyOn(OperatorProtectedBankEvidenceVerifier.prototype, 'verify');
  const receipt = await upload(); expect(receipt.status).toBe(201);
  const body = await receipt.json() as { artifactId: string };
  const result = await verify(body.artifactId); expect(result.status).toBe(200);
  expect(spy).toHaveBeenCalledExactlyOnceWith(body.artifactId); expect(state.reads).toBe(1);
  expect(await db.prepare('SELECT source FROM manual_pilot_bank_evidence').first('source')).toBe('OPERATOR_VERIFIED_BANK_RECORD');
  expect(await db.prepare('SELECT count(*) n FROM manual_pilot_credit_grants').first('n')).toBe(0);
});
it('rejects unauthorized intake before reading or storing protected evidence', async () => {
  state.authorized = false; expect((await upload()).status).toBe(403);
  expect(state.objects.size).toBe(0); expect(state.reads).toBe(0);
});
it('rejects forged MIME content without financial evidence', async () => {
  expect((await upload('<html>forged bank statement</html>')).status).toBe(409);
  expect(await db.prepare('SELECT count(*) n FROM manual_pilot_bank_evidence').first('n')).toBe(0);
});
it('fails verification when protected object disappears', async () => {
  const receipt = await upload(); const body = await receipt.json() as { artifactId: string }; state.objects.clear();
  expect((await verify(body.artifactId)).status).toBe(409);
  expect(await db.prepare('SELECT count(*) n FROM manual_pilot_bank_evidence').first('n')).toBe(0);
});
