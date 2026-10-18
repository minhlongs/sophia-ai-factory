import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve('scripts/verify-saas-payment-live.mjs');
const tempDirs: string[] = [];
function writeFetchPreload(dir: string) {
  const preloadPath = join(dir, 'mock-fetch.mjs');
  writeFileSync(preloadPath, `
import { writeFileSync } from 'node:fs';
const orderId = 'sophia_test-user_1700000000000';
const paymentId = 'private-provider-payment-id';
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = String(init.method ?? 'GET').toUpperCase();
  const response = (body, headers = {}) => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
  if (url.pathname === '/api/version') {
    if (new Headers(init.headers).get('authorization') !== 'Bearer full-sha-token') return new Response('{}', { status: 401 });
    return response({ commitSha: 'abcdef1234567890abcdef1234567890abcdef12', shortSha: 'abcdef12', opennextVersion: '1.19.9' });
  }
  if (url.pathname === '/api/auth/sign-in/email') return response({ success: true }, { 'set-cookie': 'auth-session=test; Path=/; HttpOnly' });
  if (url.pathname === '/api/health') return response({ status: 'ok' }, { 'set-cookie': 'csrf-token=csrf-test; Path=/' });
  if (url.pathname === '/api/checkout' && method === 'POST') {
    if (new Headers(init.headers).get('x-csrf-token') !== 'csrf-test') return new Response('{"error":"missing csrf"}', { status: 403 });
    writeFileSync(process.env.SOPHIA_PAYMENT_TEST_CAPTURE_PATH, String(init.body ?? ''));
    return response({ url: process.env.SOPHIA_PAYMENT_TEST_INVOICE_URL ?? 'https://nowpayments.io/payment?iid=test-invoice', orderId });
  }
  if (url.pathname === '/api/checkout/status') return response({ status: 'completed', tier: 'BASIC', period: 'monthly', paymentId });
  if (url.pathname === '/api/open-core/status') return response({ userTier: 'BASIC' });
  return new Response('{"error":"not found"}', { status: 404 });
};
`);
  return preloadPath;
}

function runScript(env: NodeJS.ProcessEnv, preloadPath?: string) {
  return spawnSync(process.execPath, [...(preloadPath ? ['--import', preloadPath] : []), scriptPath], {
    cwd: resolve('.'), encoding: 'utf8', env,
  });
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('verify-saas-payment-live', () => {
  it('creates an invoice, observes completion, verifies tier activation, and redacts raw references', () => {
    const orderId = 'sophia_test-user_1700000000000';
    const paymentId = 'private-provider-payment-id';
    const dir = mkdtempSync(join(tmpdir(), 'sophia-payment-live-'));
    tempDirs.push(dir);
    const evidencePath = join(dir, 'payment-proof.json');
    const capturePath = join(dir, 'checkout-body.json');
    const preloadPath = writeFetchPreload(dir);
    const result = runScript({
      ...process.env,
      SOPHIA_PAYMENT_TEST_CAPTURE_PATH: capturePath,
      SOPHIA_PAYMENT_LIVE_CONFIRM: 'run-test-payment',
      SOPHIA_VERSION_INTROSPECT_TOKEN: 'full-sha-token',
      SOPHIA_PAYMENT_LIVE_BASE_URL: 'http://127.0.0.1:8787',
      SOPHIA_PAYMENT_LIVE_EMAIL: 'test@example.com',
      SOPHIA_PAYMENT_LIVE_PASSWORD: 'test-password-not-for-report',
      SOPHIA_PAYMENT_LIVE_TIER: 'BASIC',
      SOPHIA_PAYMENT_LIVE_PERIOD: 'monthly',
      SOPHIA_PAYMENT_LIVE_AMOUNT_CONFIRMED_USD: '199',
      SOPHIA_PAYMENT_TIMEOUT_SECONDS: '1',
      SOPHIA_PAYMENT_POLL_INTERVAL_SECONDS: '0.01',
      SOPHIA_PAYMENT_LIVE_EVIDENCE_PATH: evidencePath,
    }, preloadPath);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('LIVE PAYMENT PROOF PASS');
    const checkoutBody = JSON.parse(readFileSync(capturePath, 'utf8')) as Record<string, unknown>;
    expect(checkoutBody).toMatchObject({ tier: 'BASIC', period: 'monthly', paymentMethod: 'nowpayments' });
    const evidence = readFileSync(evidencePath, 'utf8');
    expect(evidence).toContain('orderRefHash');
    expect(evidence).not.toContain(orderId);
    expect(evidence).not.toContain(paymentId);
    expect(evidence).not.toContain('test-password-not-for-report');
  });

  it('refuses a production target without the explicit production guard', () => {
    const result = runScript({
      ...process.env,
      SOPHIA_PAYMENT_LIVE_CONFIRM: 'run-test-payment',
      SOPHIA_VERSION_INTROSPECT_TOKEN: 'full-sha-token',
      SOPHIA_PAYMENT_LIVE_BASE_URL: 'https://sophia.agencyos.network.',
      SOPHIA_PAYMENT_LIVE_EMAIL: 'test@example.com',
      SOPHIA_PAYMENT_LIVE_PASSWORD: 'test-password',
      SOPHIA_PAYMENT_LIVE_TIER: 'BASIC',
      SOPHIA_PAYMENT_LIVE_AMOUNT_CONFIRMED_USD: '199',
      SOPHIA_PAYMENT_LIVE_EVIDENCE_PATH: '',
      SOPHIA_PAYMENT_ALLOW_PRODUCTION: '',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('production target requires SOPHIA_PAYMENT_ALLOW_PRODUCTION=1');
  });

  it('refuses to print an invoice URL on an unapproved HTTPS host', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sophia-payment-live-host-'));
    tempDirs.push(dir);
    const preloadPath = writeFetchPreload(dir);
    const capturePath = join(dir, 'checkout-body.json');
    const invoiceUrl = 'https://nowpayments.io.evil.example/payment?iid=attacker';
    const result = runScript({
      ...process.env,
      SOPHIA_PAYMENT_TEST_INVOICE_URL: invoiceUrl,
      SOPHIA_PAYMENT_TEST_CAPTURE_PATH: capturePath,
      SOPHIA_PAYMENT_LIVE_CONFIRM: 'run-test-payment',
      SOPHIA_VERSION_INTROSPECT_TOKEN: 'full-sha-token',
      SOPHIA_PAYMENT_LIVE_BASE_URL: 'http://127.0.0.1:8787',
      SOPHIA_PAYMENT_LIVE_EMAIL: 'test@example.com',
      SOPHIA_PAYMENT_LIVE_PASSWORD: 'test-password',
      SOPHIA_PAYMENT_LIVE_TIER: 'BASIC',
      SOPHIA_PAYMENT_LIVE_AMOUNT_CONFIRMED_USD: '199',
      SOPHIA_PAYMENT_LIVE_EVIDENCE_PATH: '',
    }, preloadPath);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('not on an approved NOWPayments HTTPS host');
    expect(`${result.stdout}${result.stderr}`).not.toContain(invoiceUrl);
  });
});
