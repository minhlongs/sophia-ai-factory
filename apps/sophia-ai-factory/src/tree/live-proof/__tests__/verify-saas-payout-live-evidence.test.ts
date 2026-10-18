import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve('scripts/verify-saas-payout-live-evidence.mjs');
const tempDirs: string[] = [];

function runEvidence(overrides: Record<string, unknown> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sophia-payout-evidence-'));
  tempDirs.push(dir);
  const evidencePath = join(dir, 'payout.json');
  const evidence = {
    schema: 'sophia-live-saas-payout-proof-v2',
    status: 'passed',
    context: {
      runId: 'run-1',
      baseUrl: 'https://staging.example.com',
      provider: 'nowpayments',
      currency: 'USDT',
      network: 'TRC20',
      expectedUsd: 25.5,
      finalizedAt: '2026-10-15T12:26:40.000Z',
      deployment: { sha: 'abcdef1234567890abcdef1234567890abcdef12', shortSha: 'abcdef12' },
      batchRefHash: 'a'.repeat(64),
      payoutRefHash: 'b'.repeat(64),
    },
    events: [
      { step: 'deployment-version', status: 'passed', data: {} },
      { step: 'sign-in', status: 'passed', data: {} },
      { step: 'payout-confirmed', status: 'passed', data: {
        status: 'confirmed',
        providerStatus: 'confirmed-via-signed-ipn',
        paymentMethod: 'usdt_trc20',
        network: 'TRC20',
        amountUsd: 25.5,
        batchRefHash: 'a'.repeat(64),
        payoutRefHash: 'b'.repeat(64),
        chainTransactionHashAvailable: false,
        finalizedAt: '2026-10-15T12:26:40.000Z',
      } },
    ],
    ...overrides,
  };
  writeFileSync(evidencePath, JSON.stringify(evidence));
  return spawnSync(process.execPath, [scriptPath, evidencePath], { encoding: 'utf8', cwd: resolve('.') });
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('verify-saas-payout-live-evidence', () => {
  it('accepts a completed USDT TRC20 payout proof', () => {
    const result = runEvidence();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('LIVE PAYOUT EVIDENCE PASS');
  });

  it('rejects evidence that claims an on-chain hash is present when the verifier did not read one', () => {
    const result = runEvidence({
      events: [
        { step: 'deployment-version', status: 'passed', data: {} },
        { step: 'sign-in', status: 'passed', data: {} },
        { step: 'payout-confirmed', status: 'passed', data: {
          status: 'confirmed', providerStatus: 'confirmed-via-signed-ipn', paymentMethod: 'usdt_trc20', network: 'TRC20',
          amountUsd: 25.5, batchRefHash: 'a'.repeat(64), payoutRefHash: 'b'.repeat(64),
          chainTransactionHashAvailable: true, finalizedAt: '2026-10-15T12:26:40.000Z',
        } },
      ],
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('chain transaction hash availability must be reported explicitly');
  });
});
