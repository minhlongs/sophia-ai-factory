import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve('scripts/verify-saas-payout-live.mjs');
const tempDirs: string[] = [];

function writeFetchPreload(dir: string) {
  const preloadPath = join(dir, 'mock-fetch.mjs');
  writeFileSync(preloadPath, `
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const response = (body, headers = {}) => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
  if (url.pathname === '/api/version') {
    if (new Headers(init.headers).get('authorization') !== 'Bearer full-sha-token') return new Response('{}', { status: 401 });
    return response({ commitSha: 'abcdef1234567890abcdef1234567890abcdef12', shortSha: 'abcdef12', opennextVersion: '1.19.9' });
  }
  if (url.pathname === '/api/auth/sign-in/email') return response({ success: true }, { 'set-cookie': 'auth-session=test; Path=/; HttpOnly' });
  if (url.pathname === '/api/affiliate/payouts') return response({ batches: [{
    id: 'batch-private-1',
    status: 'confirmed',
    payment_method: 'usdt_trc20',
    network: 'TRC20',
    external_payment_id: process.env.SOPHIA_PAYOUT_TEST_MOCK_ID === '1' ? 'mock_batch-private-1' : 'withdrawal-private-1',
    total_usd: 25.5,
    finalized_at: 1792000000,
  }] });
  return new Response('{"error":"not found"}', { status: 404 });
};
`);
  return preloadPath;
}

function runProof(dir: string, options: { mockId?: boolean; evidence?: boolean; baseUrl?: string } = {}) {
  const evidencePath = join(dir, 'payout.json');
  const preloadPath = writeFetchPreload(dir);
  const result = spawnSync(process.execPath, ['--import', preloadPath, scriptPath], {
    cwd: resolve('.'),
    encoding: 'utf8',
    env: {
      ...process.env,
      SOPHIA_PAYOUT_LIVE_CONFIRM: 'verify-settled-payout',
      SOPHIA_VERSION_INTROSPECT_TOKEN: 'full-sha-token',
      SOPHIA_PAYOUT_LIVE_BASE_URL: options.baseUrl ?? 'http://127.0.0.1:8787',
      SOPHIA_PAYOUT_LIVE_EMAIL: 'affiliate@example.test',
      SOPHIA_PAYOUT_LIVE_PASSWORD: 'secret-for-test',
      SOPHIA_PAYOUT_BATCH_ID: 'batch-private-1',
      SOPHIA_PAYOUT_EXPECTED_USD: '25.50',
      SOPHIA_PAYOUT_LIVE_EVIDENCE_PATH: options.evidence === false ? '' : evidencePath,
      SOPHIA_PAYOUT_TEST_MOCK_ID: options.mockId ? '1' : '',
    },
  });
  return { result, evidencePath };
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('verify-saas-payout-live', () => {
  it('proves a provider-confirmed USDT payout without exposing raw references', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sophia-payout-proof-'));
    tempDirs.push(dir);
    const { result, evidencePath } = runProof(dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('LIVE PAYOUT PROOF PASS');
    const evidence = readFileSync(evidencePath, 'utf8');
    expect(evidence).not.toContain('batch-private-1');
    expect(evidence).not.toContain('withdrawal-private-1');
    expect(evidence).not.toContain('secret-for-test');
    expect(evidence).toContain('confirmed-via-signed-ipn');
  });

  it('refuses to treat a synthetic mock withdrawal ID as a real payout', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sophia-payout-mock-'));
    tempDirs.push(dir);
    const { result } = runProof(dir, { mockId: true, evidence: false });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('no real provider withdrawal reference');
  });

  it('recognizes a trailing-dot production hostname and refuses the check without opt-in', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sophia-payout-production-guard-'));
    tempDirs.push(dir);
    const { result } = runProof(dir, { baseUrl: 'https://sophia.agencyos.network.' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('production target requires SOPHIA_PAYOUT_ALLOW_PRODUCTION=1');
  });
});
