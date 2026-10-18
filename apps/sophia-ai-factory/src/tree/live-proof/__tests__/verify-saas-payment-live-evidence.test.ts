import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve('scripts/verify-saas-payment-live-evidence.mjs');
const tempDirs: string[] = [];
const orderRefHash = 'a'.repeat(64);
const paymentRefHash = 'b'.repeat(64);

function makeProof(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'sophia-live-saas-payment-proof-v2',
    status: 'passed',
    context: {
      runId: 'run-payment-1',
      baseUrl: 'https://staging.example.com',
      provider: 'nowpayments',
      tier: 'BASIC',
      period: 'monthly',
      amountConfirmedUsd: 199,
      deployment: { sha: 'abcdef1234567890abcdef1234567890abcdef12', shortSha: 'abcdef12' },
      orderRefHash,
      paymentRefHash,
    },
    events: [
      ['deployment-version', { shortSha: 'abc1234' }],
      ['sign-in', { cookieCount: 2 }],
      ['checkout-created', {
        provider: 'nowpayments', tier: 'BASIC', period: 'monthly', newOrder: true,
        orderRefHash, invoiceHost: 'nowpayments.io', amountConfirmedUsd: 199,
      }],
      ['payment-completed', { status: 'completed', tier: 'BASIC', period: 'monthly', paymentRefHash }],
      ['tier-activated', { userTier: 'BASIC' }],
    ].map(([step, data]) => ({ step, status: 'passed', data })),
    ...overrides,
  };
}

function runValidator(proof: unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'sophia-payment-proof-'));
  tempDirs.push(dir);
  const path = join(dir, 'payment.json');
  writeFileSync(path, `${JSON.stringify(proof, null, 2)}\n`);
  return spawnSync(process.execPath, [scriptPath, path], { encoding: 'utf8', cwd: resolve('.') });
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('verify-saas-payment-live-evidence', () => {
  it('accepts a completed payment that activated the expected tier', () => {
    const result = runValidator(makeProof());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('LIVE PAYMENT EVIDENCE PASS');
  });

  it('rejects a payment report that does not show the purchased tier active', () => {
    const proof = makeProof();
    const events = proof.events as Array<{ step: string; data: { userTier?: string } }>;
    events.find((event) => event.step === 'tier-activated')!.data.userTier = 'PREMIUM';

    const result = runValidator(proof);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('activated tier does not match the paid tier');
  });

  it('rejects reused pending orders', () => {
    const proof = makeProof();
    const events = proof.events as Array<{ step: string; data: { newOrder?: boolean } }>;
    events.find((event) => event.step === 'checkout-created')!.data.newOrder = false;

    const result = runValidator(proof);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('reused an existing order');
  });
});
