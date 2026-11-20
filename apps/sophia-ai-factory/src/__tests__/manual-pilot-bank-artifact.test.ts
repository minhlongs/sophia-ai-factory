// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { intakePrivateBankArtifact, detectBankArtifactSignature, sha256BytesHex } from '@/land/payments/manual-pilot/manual-pilot-bank-artifact-intake';
import { verifyAndIngestOperatorBankArtifact, OperatorProtectedBankEvidenceVerifier } from '@/land/payments/manual-pilot/manual-pilot-bank-verifier';
import { transitionManualPilot } from '@/land/payments/manual-pilot/manual-pilot-transitions';
vi.mock('@/seed/db/node-sqlite/migrations', () => ({ applyMigrations: vi.fn() }));
const bytes = new TextEncoder().encode('%PDF-1.7\noriginal bank statement\n%%EOF');
let db: NodeSqliteD1Database;
const store = new Map<string, Uint8Array>();
const persistence = { put: async (key: string, value: Uint8Array) => { store.set(key, value.slice()); } };
const options = { expectedBankIdentity: 'bank', read: async (key: string) => store.get(key) ?? null };
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2099-01-02T00:00:00Z'));
  db = new NodeSqliteD1Database(':memory:'); store.clear();
  for (const file of readdirSync('migrations').filter((f) => /^05(0[6-9]|1[0-3])_/.test(f)).sort()) {
    await db.exec(readFileSync(`migrations/${file}`, 'utf8'));
  }
  await db.exec(`CREATE TABLE user_profiles(user_id TEXT,role TEXT);
    INSERT INTO user_profiles VALUES('admin','admin');
    INSERT INTO manual_pilot_settlements(id,order_id,user_id,org_id,expected_amount_vnd,transfer_reference)
    VALUES('s','order','user','org',1990000,'ref');
    INSERT INTO manual_pilot_financial_state VALUES('order','org','PENDING_ORDER',NULL,NULL,'2099-01-01');`);
});
afterEach(() => { vi.useRealTimers(); });
async function upload(overrides = {}) {
  return intakePrivateBankArtifact(db, { orderId: 'order', orgId: 'org', direction: 'inbound', filename: 'bank.pdf', mimeType: 'application/pdf', bytes, ...overrides }, 'admin', persistence);
}
function check(artifactId: string) {
  return { approved: true as const, accountIdentity: 'account', artifactId, orderId: 'order', orgId: 'org', direction: 'inbound' as const,
    inspectionSource: 'authenticated_bank_portal' as const, bankIdentity: 'bank', originalBankTxnId: 'bank-tx', amountVnd: 1990000,
    currency: 'VND' as const, orderReference: 'ref', bankRecordTimestamp: '2099-01-01T23:00:00Z' };
}
it('persists protected bytes and computed digest; real verifier advances only exact evidence', async () => {
  const artifact = await upload(); expect(artifact.ok).toBe(true); if (!artifact.ok) return;
  expect(artifact.value.artifactSha256).toBe(await sha256BytesHex(bytes));
  const result = await verifyAndIngestOperatorBankArtifact(db, check(artifact.value.artifactId), 'admin', 'account', options);
  expect(result.ok).toBe(true); if (!result.ok) return;
  expect(await db.prepare('SELECT source FROM manual_pilot_bank_evidence').first('source')).toBe('OPERATOR_VERIFIED_BANK_RECORD');
  for (const target of ['BANK_SETTLEMENT_VERIFIED', 'RECONCILED', 'ADMIN_APPROVED'] as const) {
    expect((await transitionManualPilot(db, { orderId: 'order', orgId: 'org', adminId: 'admin', evidenceId: result.value.evidenceId, target })).ok).toBe(true);
  }
  expect(await db.prepare('SELECT evidence_level FROM manual_pilot_bank_artifacts').first('evidence_level')).toBe('AUTHORIZED_RECONCILIATION');
  expect(await db.prepare('SELECT count(*) n FROM manual_pilot_credit_grants').first('n')).toBe(0);
});
it.each([{ mimeType: 'image/png' }, { bytes: new Uint8Array(15) }, { bytes: new Uint8Array(5242881) }, { expectedSha256: '0'.repeat(64) }, { orgId: 'other' }, { filename: '../bank.pdf' }])('rejects invalid intake %o', async (input) => {
  expect((await upload(input)).ok).toBe(false);
  expect(await db.prepare('SELECT count(*) n FROM manual_pilot_bank_artifacts').first('n')).toBe(0);
});
it('rejects forged file signatures', () => {
  expect(detectBankArtifactSignature(new TextEncoder().encode('<html>forged,bank\n</html>'))).toBeNull();
});
it.each([{ amountVnd: 1 }, { currency: 'USD' }, { orgId: 'other' }, { accountIdentity: 'wrong' }, { orderReference: 'forged' }, { approved: false }])('rejects operator mismatch %o', async (override) => {
  const artifact = await upload(); if (!artifact.ok) throw Error('upload');
  const result = await verifyAndIngestOperatorBankArtifact(db, { ...check(artifact.value.artifactId), ...override } as ReturnType<typeof check>, 'admin', 'account', options);
  expect(result.ok).toBe(false);
  expect(await db.prepare('SELECT count(*) n FROM manual_pilot_bank_evidence').first('n')).toBe(0);
});
it('rejects missing protected bytes and storage tampering', async () => {
  const artifact = await upload(); if (!artifact.ok) throw Error('upload'); store.clear();
  expect((await verifyAndIngestOperatorBankArtifact(db, check(artifact.value.artifactId), 'admin', 'account', options)).ok).toBe(false);
});
it('retries idempotently and rejects reused transaction with another artifact', async () => {
  const a = await upload(); if (!a.ok) throw Error('upload');
  const first = await verifyAndIngestOperatorBankArtifact(db, check(a.value.artifactId), 'admin', 'account', options); expect(first.ok).toBe(true);
  const retry = await verifyAndIngestOperatorBankArtifact(db, check(a.value.artifactId), 'admin', 'account', options); expect(retry.ok).toBe(true);
  const b = await upload(); if (!b.ok) throw Error('upload');
  expect((await verifyAndIngestOperatorBankArtifact(db, check(b.value.artifactId), 'admin', 'account', options)).ok).toBe(false);
  expect(await db.prepare('SELECT count(*) n FROM manual_pilot_bank_evidence').first('n')).toBe(1);
  vi.setSystemTime(new Date('2099-01-04'));
  expect(await new OperatorProtectedBankEvidenceVerifier(db, 'account').verify(a.value.artifactId)).toBeNull();
});
it('rolls operator check back when mandatory audit insertion fails', async () => {
  const a = await upload(); if (!a.ok) throw Error('upload');
  await db.exec("CREATE TRIGGER fail_check BEFORE INSERT ON manual_pilot_financial_events BEGIN SELECT RAISE(IGNORE); END;");
  expect((await verifyAndIngestOperatorBankArtifact(db, check(a.value.artifactId), 'admin', 'account', options)).ok).toBe(false);
  expect(await db.prepare('SELECT count(*) n FROM manual_pilot_bank_artifact_checks').first('n')).toBe(0);
});

it('concurrent retries produce one immutable evidence association', async () => {
  const a = await upload(); if (!a.ok) throw Error('upload');
  const results = await Promise.all([1,2].map(() => verifyAndIngestOperatorBankArtifact(db, check(a.value.artifactId), 'admin', 'account', options)));
  expect(results.some((r) => r.ok)).toBe(true);
  expect(await db.prepare('SELECT count(*) n FROM manual_pilot_bank_evidence').first('n')).toBe(1);
  expect((await verifyAndIngestOperatorBankArtifact(db, check(a.value.artifactId), 'admin', 'account', options)).ok).toBe(true);
});
