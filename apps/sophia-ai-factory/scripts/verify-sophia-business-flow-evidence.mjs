#!/usr/bin/env node
/**
 * Join private live video/payment/payout evidence with 28-day production SLO
 * and observed unit-economics snapshots. The output is a redacted report.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMp4Brand, isMp4FormatName } from './live-proof/media.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DAY_MS = 24 * 60 * 60 * 1000;
const MINIMUM_WINDOW_MS = 28 * DAY_MS;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const SUCCESS_JOB_STATUSES = new Set(['live', 'published', 'completed', 'succeeded']);

function usage() {
  console.log(`Usage:
  node scripts/verify-sophia-business-flow-evidence.mjs \\
    --video <live-video-proof.json> \\
    --payment <live-payment-proof.json> \\
    --payout <live-payout-proof.json> \\
    --expected-sha <full-40-character-commit-sha> \\
    --economics <production-economics.json> \\
    --slo <production-slo.json> \\
    [--out <redacted-report.json>]

The economics and SLO inputs must be observed Cloudflare/ledger exports with
their source SHA-256. Mock test evidence cannot satisfy the live proof inputs.`);
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!['--video', '--payment', '--payout', '--expected-sha', '--economics', '--slo', '--out'].includes(key)) {
      fail(`unknown option: ${key}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail(`missing value for ${key}`);
    options[key.slice(2)] = value;
    index += 1;
  }
  for (const key of ['video', 'payment', 'payout', 'expected-sha', 'economics', 'slo']) {
    if (!options[key]) fail(`missing required --${key} evidence file`);
  }
  return options;
}

function readJson(path, label) {
  const absolutePath = resolve(root, path);
  try {
    return { path: absolutePath, value: JSON.parse(readFileSync(absolutePath, 'utf8')) };
  } catch (error) {
    fail(`${label} evidence could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function verifySourceFile(input, label) {
  if (typeof input.sourcePath !== 'string' || input.sourcePath.trim().length === 0) {
    fail(`${label} sourcePath must point to the raw source export`);
  }
  const path = resolve(root, input.sourcePath);
  let sha256;
  try {
    sha256 = hashFile(path);
  } catch (error) {
    fail(`${label} source export could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (sha256.toLowerCase() !== String(input.sourceSha256).toLowerCase()) {
    fail(`${label} sourceSha256 does not match the raw source export`);
  }
  return { path, sha256 };
}

function hashValue(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function assertSha(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) fail(`${label} must be a SHA-256 hex digest`);
}

function assertDeployment(deployment, label) {
  if (typeof deployment.sha !== 'string' || !/^[a-f0-9]{40,64}$/i.test(deployment.sha)) {
    fail(`${label} proof must contain the full deployment commit SHA`);
  }
  if (typeof deployment.shortSha !== 'string' || deployment.sha.slice(0, 8).toLowerCase() !== deployment.shortSha.toLowerCase()) {
    fail(`${label} full and short deployment SHAs do not match`);
  }
}

function assertObservedWindow(startValue, endValue, label) {
  const start = Date.parse(startValue);
  const end = Date.parse(endValue);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) fail(`${label} window is invalid`);
  if (end - start < MINIMUM_WINDOW_MS) fail(`${label} window must cover at least 28 days`);
  if (end > Date.now() + MAX_CLOCK_SKEW_MS) fail(`${label} observed window cannot end in the future`);
  return { start, end };
}

function validateVideoProof(video) {
  if (video.schema !== 'sophia-live-user-video-flow-proof-v4') fail('video proof must use the current v4 full-decode live schema');
  if (video.status !== 'passed') fail('video live proof did not pass');
  const context = video.context ?? {};
  if (!context.runId || !context.deployment?.shortSha || !context.videoId || !context.missionId) {
    fail('video proof is missing run, deployment, mission, or video identity');
  }
  assertDeployment(context.deployment, 'video');
  const events = new Map((video.events ?? []).map((event) => [event.step, event]));
  const required = [
    'deployment-version', 'sign-in', 'save-llm-byok', 'save-heygen-credential',
    'channel-preflight', 'auto-video', 'heygen-completion', 'video-row',
    'video-full-decode', 'distribution-scheduled', 'publish-jobs-live',
  ];
  for (const step of required) if (events.get(step)?.status !== 'passed') fail(`video proof step did not pass: ${step}`);
  const artifact = events.get('video-full-decode')?.data;
  if (artifact?.status !== 200 || artifact?.fullDecode !== true || !Number.isSafeInteger(artifact.totalBytes) || artifact.totalBytes <= 0) {
    fail('video proof does not establish a complete download and full decode');
  }
  assertSha(artifact.sha256, 'video artifact');
  if (
    !isMp4FormatName(artifact.formatName) ||
    typeof artifact.majorBrand !== 'string' || artifact.majorBrand.length !== 4 ||
    !isMp4Brand(artifact.compatibleMp4Brand) ||
    typeof artifact.durationSec !== 'number' || !Number.isFinite(artifact.durationSec) || artifact.durationSec <= 0 ||
    !Array.isArray(artifact.videoStreams) || artifact.videoStreams.length === 0 ||
    !artifact.videoStreams.every((stream) => typeof stream?.codec === 'string' && stream.codec.length > 0) ||
    !Array.isArray(artifact.audioStreams)
  ) {
    fail('video proof is missing decoded container, duration, or video stream metadata');
  }
  const channels = context.channelProviders;
  if (!Array.isArray(channels) || channels.length < 2) fail('video proof requires at least two publish channels');
  const jobs = events.get('publish-jobs-live')?.data?.jobs;
  if (!Array.isArray(jobs) || jobs.length < channels.length || jobs.some((job) => !SUCCESS_JOB_STATUSES.has(job.status))) {
    fail('video proof has incomplete or failed publish jobs');
  }
  return { context, events };
}

function validatePaymentProof(payment) {
  if (payment.schema !== 'sophia-live-saas-payment-proof-v2') fail('payment proof schema is not supported');
  if (payment.status !== 'passed') fail('live payment proof did not pass');
  const context = payment.context ?? {};
  if (context.provider !== 'nowpayments' || !context.runId || !context.deployment?.shortSha) {
    fail('payment proof is missing provider, run, or deployment identity');
  }
  assertDeployment(context.deployment, 'payment');
  if (!['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'].includes(context.tier)) fail('payment proof tier is invalid');
  if (!Number.isFinite(context.amountConfirmedUsd) || context.amountConfirmedUsd <= 0) fail('payment proof has no operator-confirmed invoice amount');
  if (!/^[a-f0-9]{64}$/i.test(context.orderRefHash ?? '') || !/^[a-f0-9]{64}$/i.test(context.paymentRefHash ?? '')) {
    fail('payment proof must contain hashed order and payment references');
  }
  const events = new Map((payment.events ?? []).map((event) => [event.step, event]));
  for (const step of ['deployment-version', 'sign-in', 'checkout-created', 'payment-completed', 'tier-activated']) {
    if (events.get(step)?.status !== 'passed') fail(`payment proof step did not pass: ${step}`);
  }
  if (events.get('tier-activated')?.data?.userTier !== context.tier) fail('payment proof does not show the purchased tier active');
  return { context, events };
}

function validatePayoutProof(payout) {
  if (payout.schema !== 'sophia-live-saas-payout-proof-v2') fail('payout proof schema is not supported');
  if (payout.status !== 'passed') fail('live payout proof did not pass');
  const context = payout.context ?? {};
  if (context.provider !== 'nowpayments' || context.currency !== 'USDT' || context.network !== 'TRC20') {
    fail('payout proof must establish a NOWPayments USDT TRC20 payout');
  }
  if (!context.runId || !context.deployment?.shortSha) fail('payout proof is missing run or deployment identity');
  assertDeployment(context.deployment, 'payout');
  if (!Number.isFinite(context.expectedUsd) || context.expectedUsd <= 0) fail('payout amount is invalid');
  if (!/^[a-f0-9]{64}$/i.test(context.batchRefHash ?? '') || !/^[a-f0-9]{64}$/i.test(context.payoutRefHash ?? '')) {
    fail('payout proof must contain hashed batch and withdrawal references');
  }
  const finalizedAt = Date.parse(context.finalizedAt ?? '');
  if (!Number.isFinite(finalizedAt)) fail('payout proof finalizedAt timestamp is invalid');
  const events = new Map((payout.events ?? []).map((event) => [event.step, event]));
  for (const step of ['deployment-version', 'sign-in', 'payout-confirmed']) {
    if (events.get(step)?.status !== 'passed') fail(`payout proof step did not pass: ${step}`);
  }
  const settled = events.get('payout-confirmed')?.data;
  if (settled?.status !== 'confirmed' || settled?.providerStatus !== 'confirmed-via-signed-ipn') {
    fail('payout proof does not establish a provider-confirmed payout');
  }
  if (settled?.paymentMethod !== 'usdt_trc20' || settled?.network !== 'TRC20') fail('payout method is not USDT TRC20');
  if (!Number.isFinite(settled?.amountUsd) || Math.abs(settled.amountUsd - context.expectedUsd) > 0.01) {
    fail('payout amount does not match the confirmed expected amount');
  }
  if (settled?.batchRefHash !== context.batchRefHash || settled?.payoutRefHash !== context.payoutRefHash) {
    fail('payout reference hashes do not match context');
  }
  if (settled?.chainTransactionHashAvailable !== false) fail('payout proof must disclose that an on-chain transaction hash is unavailable');
  if (settled?.finalizedAt !== context.finalizedAt) fail('payout finalization timestamps do not match');
  return { context, events, finalizedAt };
}

function validateEconomics(input) {
  if (input.schema !== 'sophia-production-economics-evidence-v1' || input.dataMode !== 'observed') {
    fail('economics input must be an observed production-ledger snapshot, not benchmark data');
  }
  if (input.revenueScope !== 'sophia-saas') fail('economics revenue scope must be Sophia SaaS receipts');
  assertSha(input.sourceSha256, 'economics sourceSha256');
  if (typeof input.sourceName !== 'string' || input.sourceName.trim().length === 0) fail('economics sourceName is missing');
  const sourceFile = verifySourceFile(input, 'economics');
  const window = assertObservedWindow(input.windowStart, input.windowEnd, 'economics');
  if (!Number.isInteger(input.paidTransactions) || input.paidTransactions < 1) fail('economics snapshot requires at least one settled SaaS transaction');
  if (!Number.isInteger(input.completedVideoJobs) || input.completedVideoJobs < 1) fail('economics snapshot requires completed video jobs');

  const values = [
    'grossCollectedUsd', 'refundsUsd', 'paymentFeesUsd', 'aiProviderCostUsd',
    'renderProviderCostUsd', 'storageDeliveryCostUsd', 'cryptoAffiliatePayoutsUsd', 'otherVariableCostUsd',
  ];
  for (const key of values) {
    if (!Number.isFinite(input[key]) || input[key] < 0) fail(`economics ${key} must be a non-negative number`);
  }
  const netCollectedUsd = input.grossCollectedUsd - input.refundsUsd - input.paymentFeesUsd;
  const variableCostsUsd = input.aiProviderCostUsd + input.renderProviderCostUsd + input.storageDeliveryCostUsd + input.cryptoAffiliatePayoutsUsd + input.otherVariableCostUsd;
  const contributionMarginUsd = netCollectedUsd - variableCostsUsd;
  if (netCollectedUsd <= 0) fail('net collected SaaS revenue must be positive');
  if (contributionMarginUsd <= 0) fail('contribution margin after refunds, fees, and variable costs must be positive');
  return { window, sourceFile, netCollectedUsd, variableCostsUsd, contributionMarginUsd, contributionMarginPct: contributionMarginUsd / netCollectedUsd * 100 };
}

function validateSlo(input) {
  if (input.schema !== 'sophia-production-slo-evidence-v1' || input.dataMode !== 'observed') {
    fail('SLO input must be observed production evidence');
  }
  if (!['cloudflare-worker-logs', 'cloudflare-metrics'].includes(input.sourceName)) fail('SLO source must be Cloudflare-native telemetry');
  assertSha(input.sourceSha256, 'SLO sourceSha256');
  const sourceFile = verifySourceFile(input, 'SLO');
  const window = assertObservedWindow(input.windowStart, input.windowEnd, 'SLO');
  if (!Number.isInteger(input.unresolvedP0) || input.unresolvedP0 !== 0) fail('unresolved P0 count must be zero');
  if (!Number.isInteger(input.unresolvedP1) || input.unresolvedP1 !== 0) fail('unresolved P1 count must be zero');

  const metrics = input.metrics ?? {};
  const targets = input.targets ?? {};
  if (!Number.isFinite(metrics.apiAvailabilityPercent) || metrics.apiAvailabilityPercent < 0 || metrics.apiAvailabilityPercent > 100) fail('API availability must be between 0 and 100 percent');
  if (!Number.isFinite(metrics.apiP95Ms) || metrics.apiP95Ms < 0) fail('API p95 must be a finite non-negative duration');
  if (!Number.isFinite(metrics.api5xxPercent) || metrics.api5xxPercent < 0 || metrics.api5xxPercent > 100) fail('API 5xx rate must be between 0 and 100 percent');
  if (metrics.apiAvailabilityPercent < 99.9) fail('API availability must meet the 99.9% target');
  if (metrics.apiP95Ms >= 500) fail('API p95 must be below 500 ms');
  if (metrics.api5xxPercent >= 0.1) fail('API 5xx rate must be below 0.1%');
  if (!Number.isFinite(metrics.videoCompletionPercent) || metrics.videoCompletionPercent < 0 || metrics.videoCompletionPercent > 100) fail('video completion rate must be between 0 and 100 percent');
  if (!Number.isFinite(metrics.videoP95Seconds) || metrics.videoP95Seconds < 0) fail('video completion p95 must be a finite non-negative duration');
  if (!Number.isFinite(targets.videoCompletionPercent) || targets.videoCompletionPercent <= 0 || targets.videoCompletionPercent > 100) {
    fail('a video completion rate target must be declared');
  }
  if (!Number.isFinite(targets.videoP95Seconds) || targets.videoP95Seconds <= 0) fail('a video completion latency target must be declared');
  if (!(metrics.videoCompletionPercent >= targets.videoCompletionPercent)) fail('video completion rate missed its declared target');
  if (!(metrics.videoP95Seconds <= targets.videoP95Seconds)) fail('video completion p95 missed its declared target');
  if (!Number.isInteger(metrics.eligibleVideoJobs) || metrics.eligibleVideoJobs < 1) fail('SLO evidence requires eligible video job observations');
  return { window, sourceFile, metrics, targets };
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }

  const options = parseArgs(process.argv.slice(2));
  const videoFile = readJson(options.video, 'video');
  const paymentFile = readJson(options.payment, 'payment');
  const payoutFile = readJson(options.payout, 'payout');
  const economicsFile = readJson(options.economics, 'economics');
  const sloFile = readJson(options.slo, 'SLO');
  const video = validateVideoProof(videoFile.value);
  const payment = validatePaymentProof(paymentFile.value);
  const payout = validatePayoutProof(payoutFile.value);
  const expectedSha = options['expected-sha'];
  if (!/^[a-f0-9]{40,64}$/i.test(expectedSha)) fail('--expected-sha must be the full 40 to 64 character commit SHA');
  const economics = validateEconomics(economicsFile.value);
  const slo = validateSlo(sloFile.value);

  const deployedSha = video.context.deployment.sha;
  if (deployedSha.toLowerCase() !== expectedSha.toLowerCase()) fail('live deployment SHA does not match --expected-sha');
  if (payment.context.deployment.sha.toLowerCase() !== deployedSha.toLowerCase()) fail('video and payment proofs target different deployed SHAs');
  if (payout.context.deployment.sha.toLowerCase() !== deployedSha.toLowerCase()) fail('video and payout proofs target different deployed SHAs');
  if (payout.finalizedAt < economics.window.start || payout.finalizedAt > economics.window.end) {
    fail('confirmed payout must fall inside the observed economics window');
  }
  if (economicsFile.value.cryptoAffiliatePayoutsUsd + 0.01 < payout.context.expectedUsd) {
    fail('observed crypto affiliate payout costs do not include the confirmed payout');
  }
  if (Math.abs(economics.window.start - slo.window.start) > 60_000 || Math.abs(economics.window.end - slo.window.end) > 60_000) {
    fail('economics and SLO evidence must cover the same 28-day production window');
  }

  const outputPath = options.out
    ? resolve(root, options.out)
    : resolve(root, `plans/reports/sophia-business-flow-proof-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const report = {
    schema: 'sophia-business-flow-readiness-v2',
    status: 'passed-source-bound-operator-attestation',
    generatedAt: new Date().toISOString(),
    proofRunId: randomUUID(),
    deployment: { sha: deployedSha, shortSha: video.context.deployment.shortSha },
    sourceEvidence: [videoFile.path, paymentFile.path, payoutFile.path, economicsFile.path, sloFile.path,
      economics.sourceFile.path, slo.sourceFile.path].map((path) => ({
      name: basename(path),
      sha256: hashFile(path),
    })),
    video: {
      status: 'passed',
      runId: video.context.runId,
      missionRefHash: hashValue(video.context.missionId),
      videoRefHash: hashValue(video.context.videoId),
      jobCount: video.events.get('publish-jobs-live').data.jobs.length,
      reportedObjectBytes: video.events.get('video-full-decode').data.totalBytes,
      artifactSha256: video.events.get('video-full-decode').data.sha256,
      elapsedMs: video.events.get('publish-jobs-live').at && video.events.get('start')?.at
        ? Date.parse(video.events.get('publish-jobs-live').at) - Date.parse(video.events.get('start').at)
        : null,
    },
    payment: {
      status: 'passed',
      runId: payment.context.runId,
      provider: payment.context.provider,
      tier: payment.context.tier,
      period: payment.context.period,
      amountConfirmedUsd: payment.context.amountConfirmedUsd,
      orderRefHash: payment.context.orderRefHash,
      paymentRefHash: payment.context.paymentRefHash,
    },
    cryptoPayout: {
      status: 'provider-confirmed-via-signed-ipn',
      runId: payout.context.runId,
      provider: payout.context.provider,
      currency: payout.context.currency,
      network: payout.context.network,
      amountUsd: payout.context.expectedUsd,
      batchRefHash: payout.context.batchRefHash,
      payoutRefHash: payout.context.payoutRefHash,
      finalizedAt: payout.context.finalizedAt,
      chainTransactionHashAvailable: false,
    },
    productionWindow: {
      start: economicsFile.value.windowStart,
      end: economicsFile.value.windowEnd,
      durationDays: Number(((economics.window.end - economics.window.start) / DAY_MS).toFixed(2)),
    },
    slo: {
      status: 'operator-attested-source-bound-pass',
      apiAvailabilityPercent: slo.metrics.apiAvailabilityPercent,
      apiP95Ms: slo.metrics.apiP95Ms,
      api5xxPercent: slo.metrics.api5xxPercent,
      videoCompletionPercent: slo.metrics.videoCompletionPercent,
      videoP95Seconds: slo.metrics.videoP95Seconds,
      videoCompletionTargetPercent: slo.targets.videoCompletionPercent,
      videoP95TargetSeconds: slo.targets.videoP95Seconds,
    },
    economics: {
      status: 'operator-attested-source-bound-positive-contribution-margin-before-fixed-opex',
      currency: 'USD',
      revenueScope: 'sophia-saas',
      paidTransactions: economicsFile.value.paidTransactions,
      completedVideoJobs: economicsFile.value.completedVideoJobs,
      grossCollectedUsd: economicsFile.value.grossCollectedUsd,
      refundsUsd: economicsFile.value.refundsUsd,
      paymentFeesUsd: economicsFile.value.paymentFeesUsd,
      cryptoAffiliatePayoutsUsd: economicsFile.value.cryptoAffiliatePayoutsUsd,
      variableCostsUsd: economics.variableCostsUsd,
      netCollectedUsd: economics.netCollectedUsd,
      contributionMarginUsd: economics.contributionMarginUsd,
      contributionMarginPercent: Number(economics.contributionMarginPct.toFixed(2)),
      sourceSha256: economicsFile.value.sourceSha256,
    },
    unresolvedP0: sloFile.value.unresolvedP0,
    unresolvedP1: sloFile.value.unresolvedP1,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`BUSINESS FLOW EVIDENCE PASS: ${outputPath}`);
  console.log(`Deployment: ${deployedSha}`);
  console.log(`API SLO: ${report.slo.apiAvailabilityPercent}% availability, p95 ${report.slo.apiP95Ms}ms, ${report.slo.api5xxPercent}% 5xx`);
  console.log(`SaaS contribution margin: $${report.economics.contributionMarginUsd.toFixed(2)} (${report.economics.contributionMarginPercent}%)`);
}

try {
  main();
} catch (error) {
  console.error(`BUSINESS FLOW EVIDENCE FAIL: ${error instanceof Error ? error.message : String(error)}`);
  usage();
  process.exitCode = 1;
}
