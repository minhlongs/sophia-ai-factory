import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve('scripts/verify-sophia-business-flow-evidence.mjs');
const tempDirs: string[] = [];
const deploymentSha = 'abcdef1234567890abcdef1234567890abcdef12';
const shortSha = deploymentSha.slice(0, 8);
const windowStart = '2026-09-01T00:00:00.000Z';
const windowEnd = '2026-09-29T00:00:00.000Z';
const payoutFinalizedAt = '2026-09-15T10:00:00.000Z';

function makeVideoProof() {
  const channels = ['telegram', 'youtube'];
  const events: Array<{ step: string; status: string; data: Record<string, unknown> }> = [
    'deployment-version', 'sign-in', 'save-llm-byok', 'save-heygen-credential',
    'channel-preflight', 'auto-video', 'heygen-completion', 'video-row',
    'distribution-scheduled',
  ].map((step) => ({ step, status: 'passed', data: {} }));
  events.push(
    { step: 'video-full-decode', status: 'passed', data: {
      status: 200,
      fullDecode: true,
      totalBytes: 1024,
      sha256: 'c'.repeat(64),
      formatName: 'mp4',
      durationSec: 12,
      videoStreams: [{ codec: 'h264', width: 720, height: 1280 }],
      audioStreams: [{ codec: 'aac' }],
    } },
    { step: 'publish-jobs-live', status: 'passed', data: { jobs: [
      { id: 'provider-job-1', provider: 'telegram', status: 'live' },
      { id: 'provider-job-2', provider: 'youtube', status: 'published' },
    ] } },
  );
  return {
    schema: 'sophia-live-user-video-flow-proof-v4',
    status: 'passed',
    context: {
      runId: 'run-video-1',
      baseUrl: 'https://staging.example.com',
      deployment: { sha: deploymentSha, shortSha },
      channelProviders: channels,
      missionId: 'mission-raw-id',
      videoId: 'video-raw-id',
    },
    events: [
      { step: 'start', status: 'running', at: '2026-09-15T10:00:00.000Z', data: {} },
      ...events,
    ],
  };
}

function makePaymentProof(overrides: Record<string, unknown> = {}) {
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
      deployment: { sha: deploymentSha, shortSha },
      orderRefHash: 'a'.repeat(64),
      paymentRefHash: 'b'.repeat(64),
    },
    events: [
      ['deployment-version', {}], ['sign-in', {}], ['payment-completed', {}],
      ['tier-activated', { userTier: 'BASIC' }],
      ['checkout-created', { provider: 'nowpayments', tier: 'BASIC', period: 'monthly', newOrder: true }],
    ].map(([step, data]) => ({ step, status: 'passed', data })),
    ...overrides,
  };
}

function makePayoutProof(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'sophia-live-saas-payout-proof-v2',
    status: 'passed',
    context: {
      runId: 'run-payout-1',
      baseUrl: 'https://staging.example.com',
      provider: 'nowpayments',
      currency: 'USDT',
      network: 'TRC20',
      expectedUsd: 25.5,
      finalizedAt: payoutFinalizedAt,
      deployment: { sha: deploymentSha, shortSha },
      batchRefHash: 'e'.repeat(64),
      payoutRefHash: 'f'.repeat(64),
    },
    events: [
      { step: 'deployment-version', status: 'passed', data: {} },
      { step: 'sign-in', status: 'passed', data: {} },
      { step: 'payout-confirmed', status: 'passed', data: {
        status: 'confirmed', paymentMethod: 'usdt_trc20', network: 'TRC20', amountUsd: 25.5,
        providerStatus: 'confirmed-via-signed-ipn', batchRefHash: 'e'.repeat(64), payoutRefHash: 'f'.repeat(64),
        chainTransactionHashAvailable: false, finalizedAt: payoutFinalizedAt,
      } },
    ],
    ...overrides,
  };
}

function makeEconomics(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'sophia-production-economics-evidence-v1',
    dataMode: 'observed',
    revenueScope: 'sophia-saas',
    sourceName: 'sanitized-production-ledger-export',
    windowStart,
    windowEnd,
    paidTransactions: 4,
    completedVideoJobs: 12,
    grossCollectedUsd: 2000,
    refundsUsd: 50,
    paymentFeesUsd: 40,
    aiProviderCostUsd: 250,
    renderProviderCostUsd: 600,
    storageDeliveryCostUsd: 80,
    cryptoAffiliatePayoutsUsd: 25.5,
    otherVariableCostUsd: 100,
    ...overrides,
  };
}

function makeSlo(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'sophia-production-slo-evidence-v1',
    dataMode: 'observed',
    sourceName: 'cloudflare-worker-logs',
    windowStart,
    windowEnd,
    unresolvedP0: 0,
    unresolvedP1: 0,
    metrics: {
      apiAvailabilityPercent: 99.95,
      apiP95Ms: 420,
      api5xxPercent: 0.05,
      videoCompletionPercent: 98,
      videoP95Seconds: 600,
      eligibleVideoJobs: 100,
    },
    targets: { videoCompletionPercent: 95, videoP95Seconds: 900 },
    ...overrides,
  };
}

function runAggregator(inputs: { video?: unknown; payment?: unknown; payout?: unknown; economics?: unknown; slo?: unknown; expectedSha?: string }) {
  const dir = mkdtempSync(join(tmpdir(), 'sophia-business-proof-'));
  tempDirs.push(dir);
  const economicsSourcePath = join(dir, 'ledger-export.csv');
  const sloSourcePath = join(dir, 'cloudflare-export.json');
  const economicsSource = 'sanitized observed ledger export fixture\n';
  const sloSource = '{"source":"sanitized cloudflare export fixture"}\n';
  writeFileSync(economicsSourcePath, economicsSource);
  writeFileSync(sloSourcePath, sloSource);
  const economicsOverrides = (inputs.economics ?? {}) as Record<string, unknown>;
  const sloOverrides = (inputs.slo ?? {}) as Record<string, unknown>;
  const economics = {
    ...makeEconomics(),
    ...economicsOverrides,
    sourcePath: economicsOverrides.sourcePath ?? economicsSourcePath,
    sourceSha256: economicsOverrides.sourceSha256 ?? createHash('sha256').update(economicsSource).digest('hex'),
  };
  const slo = {
    ...makeSlo(),
    ...sloOverrides,
    sourcePath: sloOverrides.sourcePath ?? sloSourcePath,
    sourceSha256: sloOverrides.sourceSha256 ?? createHash('sha256').update(sloSource).digest('hex'),
  };
  const files = Object.fromEntries(Object.entries({
    video: inputs.video ?? makeVideoProof(),
    payment: inputs.payment ?? makePaymentProof(),
    payout: inputs.payout ?? makePayoutProof(),
    economics,
    slo,
  }).map(([key, value]) => {
    const path = join(dir, `${key}.json`);
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
    return [key, path];
  })) as Record<'video' | 'payment' | 'payout' | 'economics' | 'slo', string>;
  const reportPath = join(dir, 'report.json');
  const result = spawnSync(process.execPath, [
    scriptPath,
    '--video', files.video,
    '--payment', files.payment,
    '--payout', files.payout,
    '--expected-sha', inputs.expectedSha ?? deploymentSha,
    '--economics', files.economics,
    '--slo', files.slo,
    '--out', reportPath,
  ], { encoding: 'utf8', cwd: resolve('.') });
  return { result, reportPath };
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('verify-sophia-business-flow-evidence', () => {
  it('creates a redacted report only when live, SLO, and positive-margin evidence agree', () => {
    const { result, reportPath } = runAggregator({});

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('BUSINESS FLOW EVIDENCE PASS');
    const report = readFileSync(reportPath, 'utf8');
    expect(report).toContain('positive-contribution-margin-before-fixed-opex');
    expect(report).toContain('contributionMarginUsd');
    expect(report).not.toContain('video-raw-id');
    expect(report).not.toContain('mission-raw-id');
  });

  it('rejects video and payment proofs from different deployed SHAs', () => {
    const payment = makePaymentProof();
    (payment.context as { deployment: { sha: string; shortSha: string } }).deployment = {
      sha: '7654321098765432109876543210987654321098',
      shortSha: '76543210',
    };
    const { result } = runAggregator({ payment });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('different deployed SHAs');
  });

  it('requires the operator-supplied release SHA to match every live proof', () => {
    const { result } = runAggregator({ expectedSha: '1234567890abcdef1234567890abcdef12345678' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('live deployment SHA does not match --expected-sha');
  });

  it('accepts equivalent deployment SHAs with different letter casing', () => {
    const payment = makePaymentProof();
    (payment.context as { deployment: { sha: string; shortSha: string } }).deployment = {
      sha: deploymentSha.toUpperCase(),
      shortSha: shortSha.toUpperCase(),
    };
    const payout = makePayoutProof();
    (payout.context as { deployment: { sha: string; shortSha: string } }).deployment = {
      sha: deploymentSha.toUpperCase(),
      shortSha: shortSha.toUpperCase(),
    };
    const { result } = runAggregator({ payment, payout });
    expect(result.status).toBe(0);
  });

  it('rejects a payout outside the observed economics window', () => {
    const payout = makePayoutProof();
    (payout.context as { finalizedAt: string }).finalizedAt = '2026-08-31T23:59:59.000Z';
    (payout.events[2].data as { finalizedAt: string }).finalizedAt = '2026-08-31T23:59:59.000Z';
    const { result } = runAggregator({ payout });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('must fall inside the observed economics window');
  });

  it('rejects benchmark economics and non-positive contribution margin', () => {
    const benchmark = makeEconomics({ dataMode: 'benchmark' });
    const benchmarkResult = runAggregator({ economics: benchmark });
    expect(benchmarkResult.result.status).not.toBe(0);
    expect(benchmarkResult.result.stderr).toContain('observed production-ledger snapshot');

    const loss = makeEconomics({ otherVariableCostUsd: 3000 });
    const lossResult = runAggregator({ economics: loss });
    expect(lossResult.result.status).not.toBe(0);
    expect(lossResult.result.stderr).toContain('contribution margin');
  });

  it('requires observed payout costs to include the proven payout', () => {
    const { result } = runAggregator({ economics: makeEconomics({ cryptoAffiliatePayoutsUsd: 0 }) });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('do not include the confirmed payout');
  });

  it('rejects a source hash that does not match the supplied raw export', () => {
    const { result } = runAggregator({ economics: makeEconomics({ sourceSha256: 'f'.repeat(64) }) });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('sourceSha256 does not match the raw source export');
  });

  it('rejects production SLOs that miss the API target', () => {
    const { result } = runAggregator({
      slo: makeSlo({ metrics: { ...makeSlo().metrics, apiAvailabilityPercent: 99.8 } }),
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('availability must meet the 99.9% target');
  });

  it('rejects non-finite SLO metrics', () => {
    const { result } = runAggregator({
      slo: makeSlo({ metrics: { ...makeSlo().metrics, apiAvailabilityPercent: Infinity } }),
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('API availability must be between 0 and 100 percent');
  });
});
