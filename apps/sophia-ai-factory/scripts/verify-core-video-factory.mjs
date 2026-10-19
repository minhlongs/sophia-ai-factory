#!/usr/bin/env node
/**
 * verify-core-video-factory.mjs
 *
 * Deterministic proof that the core video factory works end-to-end
 * from "me idea" to completed video artifact WITHOUT real provider keys.
 *
 * Proof mode: SOPHIA_CORE_VIDEO_PROOF=1 SOPHIA_VIDEO_PROVIDER=mock
 *
 * Gates:
 *   1. Unit tests for mock provider safety
 *   2. Unit tests for proof flow integration
 *   3. TypeScript compile
 *   4. ESLint zero-error gate
 *
 * Evidence written to: plans/reports/core-video-factory-proof-{timestamp}.json
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureSourceIdentity, sourceIdentityMatchesAtBoundaries } from './core-proof-source-identity.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRootResult = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' });
const repoRoot = repoRootResult.status === 0 ? repoRootResult.stdout.trim() : root;

const userVideoFlowTests = [
  'src/app/api/user/byok/route.test.ts',
  'src/app/api/setup/save/route.test.ts',
  'src/app/api/setup-wizard/save-credentials/route.test.ts',
  'src/app/api/setup-wizard/test-heygen/route.test.ts',
  'src/tree/byok/user-api-key-store.test.ts',
  'src/tree/byok/resolve-user-api-key.test.ts',
  'src/tree/components/setup-wizard/steps/api-keys-step.test.tsx',
  'src/tree/credentials/get-provider-key.test.ts',
  'src/tree/credentials/user-credentials-repo.test.ts',
  'src/land/video/__tests__/render-byok-video.test.ts',
  'src/land/missions/__tests__/auto-video-mission.test.ts',
  'src/land/openclaw-telegram/__tests__/openclaw-bridge.test.ts',
  'src/forest/video/missions/__tests__/video-create.test.ts',
  'src/forest/video/missions/__tests__/video-status.test.ts',
  'src/app/api/v1/missions/__tests__/route.contract.test.ts',
  'src/app/api/v1/missions/[id]/generate-video/route.test.ts',
  'src/forest/inngest/functions/video-generate.test.ts',
  'src/app/api/v1/integrations/channels/route.test.ts',
  'src/forest/publishing/missions/__tests__/social-publish.test.ts',
  'src/forest/youtube/missions/__tests__/youtube-publish.test.ts',
  'src/app/api/v1/videos/[id]/distribute/__tests__/route.test.ts',
  'src/app/api/v1/distribute/jobs/[videoId]/status/__tests__/route.test.ts',
  'src/forest/publishing/__tests__/bundle-publisher.test.ts',
  'src/forest/publishing/__tests__/youtube-publisher.test.ts',
  'src/forest/publishing/__tests__/tiktok-publisher.test.ts',
  'src/forest/publishing/__tests__/instagram-publisher.test.ts',
  'src/tree/agent-fleet/__tests__/spawn-agent-fleet.test.ts',
  'src/tree/agent-fleet/__tests__/skill-loader.test.ts',
  'src/tree/gateway/openclaw-gateway.test.ts',
  'src/tree/live-proof/__tests__/verify-user-video-flow-live-evidence.test.ts',
];

const proofTests = [
  ...userVideoFlowTests,
  'scripts/__tests__/load-test-target.test.ts',
  'src/land/video/__tests__/video-render-provider.test.ts',
  'src/land/video/__tests__/render-byok-video.test.ts',
  'src/land/missions/__tests__/auto-video-mission-proof.test.ts',
  'src/app/api/checkout/route.test.ts',
  'src/app/api/checkout/modules/payment-dispatcher-providers.test.ts',
  'src/app/api/checkout/status/__tests__/route.test.ts',
  'src/app/api/payos/route.test.ts',
  'src/app/api/webhooks/payos/modules/payos-verifier.test.ts',
  'src/app/api/webhooks/payos/modules/payos-idempotency.test.ts',
  'src/app/api/webhooks/payos/modules/payos-order-validator.test.ts',
  'src/app/api/webhooks/payos/modules/payos-subscription.test.ts',
  'src/app/api/webhooks/payos/modules/payos-subscription.sqlite.test.ts',
  'src/app/api/webhooks/payos/route.test.ts',
  'src/__tests__/unit/contracts/quote-to-cash.test.ts',
  'src/__tests__/e2e/enterprise/quote-to-cash.e2e.test.ts',
  'src/land/contracts/workflow/payos-contract-fulfillment.test.ts',
  'src/land/contracts/workflow/nowpayments-contract-fulfillment.test.ts',
  'src/land/orders/__tests__/pending-order-repo.test.ts',
  'src/land/orders/__tests__/pending-order-repo.sqlite.test.ts',
  'src/land/billing/__tests__/nowpayments-subscription-statements.sqlite.test.ts',
  'src/land/payments/__tests__/payos.test.ts',
  'src/seed/config/tiers/__tests__/pricing-truth.test.ts',
  'src/land/billing/__tests__/nowpayments-ipn-idempotency.test.ts',
  'src/land/billing/__tests__/nowpayments-ipn-dispatch.test.ts',
  'src/land/billing/__tests__/nowpayments-e2e-payment-lifecycle.test.ts',
  'src/tree/live-proof/__tests__/verify-user-video-flow-live-evidence.test.ts',
  'src/tree/live-proof/__tests__/evidence-recorder.test.ts',
  'src/tree/live-proof/__tests__/runtime.test.ts',
  'src/tree/live-proof/__tests__/verify-mp4-playback.test.ts',
  'src/tree/live-proof/__tests__/verify-core-video-factory-evidence.test.ts',
  'src/tree/live-proof/__tests__/core-proof-source-identity.test.ts',
  'src/tree/live-proof/__tests__/verify-saas-payment-live.test.ts',
  'src/tree/live-proof/__tests__/verify-saas-payment-live-evidence.test.ts',
  'src/tree/live-proof/__tests__/verify-saas-payout-live.test.ts',
  'src/tree/live-proof/__tests__/verify-saas-payout-live-evidence.test.ts',
  'src/tree/live-proof/__tests__/verify-sophia-business-flow-evidence.test.ts',
];

const gates = [];

function run(label, command, commandArgs) {
  console.log(`\n==> ${label}`);
  console.log(`$ ${[command, ...commandArgs].join(' ')}`);
  const startedAt = Date.now();
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      SOPHIA_CORE_VIDEO_PROOF: '1',
      SOPHIA_VIDEO_PROVIDER: 'mock',
    },
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const exitCode = result.status ?? 1;
  const gate = {
    name: label,
    command: [command, ...commandArgs],
    status: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    durationMs: Date.now() - startedAt,
    ...(result.signal ? { signal: result.signal } : {}),
    ...(result.error ? { error: result.error.message } : {}),
  };
  gates.push(gate);
  if (gate.status === 'failed') {
    console.error(`\nFAIL: ${label} exited with code ${exitCode}${gate.signal ? ` signal=${gate.signal}` : ''}`);
  }
  return gate;
}

function assertExistingTests() {
  const missing = proofTests.filter((path) => !existsSync(resolve(root, path)));
  if (missing.length === 0) {
    return;
  }
  console.error('FAIL: proof test list references missing files:');
  for (const path of missing) {
    console.error(`- ${path}`);
  }
  process.exit(1);
}

assertExistingTests();
const sourceAtStart = captureSourceIdentity(repoRoot);
let snapshotInputSource = null;
try {
  snapshotInputSource = JSON.parse(process.env.SOPHIA_CORE_VIDEO_SOURCE_IDENTITY ?? 'null');
} catch {
  snapshotInputSource = null;
}

const gatesToRun = [
  ['i18n key parity', 'npm', ['run', 'i18n:validate']],
  ['four-layer import boundaries', 'npm', ['run', 'ci:boundaries']],
  [
    'mock provider safety tests',
    './node_modules/.bin/vitest',
    ['run', 'src/land/video/__tests__/video-render-provider.test.ts', '--reporter=default'],
  ],
  [
    'proof flow integration tests',
    './node_modules/.bin/vitest',
    [
      'run',
      'scripts/__tests__/load-test-target.test.ts',
      'src/land/video/__tests__/render-byok-video.test.ts',
      'src/land/missions/__tests__/auto-video-mission-proof.test.ts',
      'src/app/api/checkout/route.test.ts',
      'src/app/api/checkout/modules/payment-dispatcher-providers.test.ts',
      'src/app/api/checkout/status/__tests__/route.test.ts',
      'src/app/api/payos/route.test.ts',
      'src/app/api/webhooks/payos/modules/payos-verifier.test.ts',
      'src/app/api/webhooks/payos/modules/payos-idempotency.test.ts',
      'src/app/api/webhooks/payos/modules/payos-order-validator.test.ts',
      'src/app/api/webhooks/payos/modules/payos-subscription.test.ts',
      'src/app/api/webhooks/payos/modules/payos-subscription.sqlite.test.ts',
      'src/app/api/webhooks/payos/route.test.ts',
      'src/__tests__/unit/contracts/quote-to-cash.test.ts',
      'src/__tests__/e2e/enterprise/quote-to-cash.e2e.test.ts',
      'src/land/contracts/workflow/payos-contract-fulfillment.test.ts',
      'src/land/contracts/workflow/nowpayments-contract-fulfillment.test.ts',
      'src/land/orders/__tests__/pending-order-repo.test.ts',
      'src/land/orders/__tests__/pending-order-repo.sqlite.test.ts',
      'src/land/billing/__tests__/nowpayments-subscription-statements.sqlite.test.ts',
      'src/land/payments/__tests__/payos.test.ts',
      'src/seed/config/tiers/__tests__/pricing-truth.test.ts',
      'src/land/billing/__tests__/nowpayments-ipn-idempotency.test.ts',
      'src/land/billing/__tests__/nowpayments-e2e-payment-lifecycle.test.ts',
      '--reporter=default',
    ],
  ],
  [
    'end-to-end user video flow tests',
    './node_modules/.bin/vitest',
    ['run', ...userVideoFlowTests, '--reporter=default'],
  ],
  [
    'live and business evidence contract tests',
    './node_modules/.bin/vitest',
    [
      'run',
      'src/tree/live-proof/__tests__/verify-user-video-flow-live-evidence.test.ts',
      'src/tree/live-proof/__tests__/evidence-recorder.test.ts',
      'src/tree/live-proof/__tests__/runtime.test.ts',
      'src/tree/live-proof/__tests__/verify-mp4-playback.test.ts',
      'src/tree/live-proof/__tests__/verify-core-video-factory-evidence.test.ts',
      'src/tree/live-proof/__tests__/core-proof-source-identity.test.ts',
      'src/tree/live-proof/__tests__/verify-saas-payment-live.test.ts',
      'src/tree/live-proof/__tests__/verify-saas-payment-live-evidence.test.ts',
      'src/tree/live-proof/__tests__/verify-saas-payout-live.test.ts',
      'src/tree/live-proof/__tests__/verify-saas-payout-live-evidence.test.ts',
      'src/tree/live-proof/__tests__/verify-sophia-business-flow-evidence.test.ts',
      '--reporter=default',
    ],
  ],
  ['TypeScript compile', 'npm', ['run', 'ci:typecheck']],
  ['migration prefix audit', 'npm', ['run', 'check:migrations']],
  [
    'ESLint zero-error gate',
    'node',
    ['--max-old-space-size=14336', './node_modules/eslint/bin/eslint.js', 'src', '--quiet'],
  ],
];

for (const [label, command, commandArgs] of gatesToRun) {
  run(label, command, commandArgs);
}

const sourceAtEnd = captureSourceIdentity(repoRoot);
const sourceIdentityMatchedAtBoundaries = sourceIdentityMatchesAtBoundaries(sourceAtStart, sourceAtEnd);
const immutableSnapshotMode = process.env.SOPHIA_CORE_VIDEO_EXECUTION_MODE === 'immutable-readonly-worktree';
const snapshotInputMatched = immutableSnapshotMode && sourceIdentityMatchesAtBoundaries(snapshotInputSource, sourceAtStart);
gates.push({
  name: 'snapshot input identity matched the source repository',
  command: ['source and immutable snapshot identity comparison'],
  status: snapshotInputMatched ? 'passed' : 'failed',
  exitCode: snapshotInputMatched ? 0 : 1,
  durationMs: 0,
});
if (!snapshotInputMatched) console.error('\nFAIL: immutable snapshot does not match the captured source repository identity');
gates.push({
  name: 'proof ran from immutable read-only worktree',
  command: ['read-only temporary Git worktree'],
  status: immutableSnapshotMode ? 'passed' : 'failed',
  exitCode: immutableSnapshotMode ? 0 : 1,
  durationMs: 0,
});
if (!immutableSnapshotMode) console.error('\nFAIL: run the proof with npm run verify:core-video-factory to use the immutable snapshot wrapper');
gates.push({
  name: 'source identity matched at run boundaries',
  command: ['git', 'source identity at start and end'],
  status: sourceIdentityMatchedAtBoundaries ? 'passed' : 'failed',
  exitCode: sourceIdentityMatchedAtBoundaries ? 0 : 1,
  durationMs: 0,
});
if (!sourceIdentityMatchedAtBoundaries) console.error('\nFAIL: source identity differed or could not be captured at the proof run boundaries');

const evidence = writeEvidence();
const allPassed = gates.every((gate) => gate.status === 'passed');
console.log(`\n${allPassed ? 'DETERMINISTIC MOCK GATES PASS' : 'DETERMINISTIC MOCK GATES FAIL'}: ${evidence.path}`);
console.log('This report covers mocked video tests and static checks only; it does not prove live provider, payment, publishing, production SLO, or positive unit economics.');
if (!allPassed) process.exit(1);

function writeEvidence() {
  const reportsDir = process.env.SOPHIA_CORE_VIDEO_EVIDENCE_DIR
    ? resolve(process.env.SOPHIA_CORE_VIDEO_EVIDENCE_DIR)
    : resolve(root, 'plans/reports');
  mkdirSync(reportsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = resolve(reportsDir, `core-video-factory-proof-${ts}.json`);
  const latestPath = resolve(reportsDir, 'core-video-factory-proof-latest.json');
  const proof = {
    schema: 'sophia-core-video-deterministic-proof-v4',
    status: gates.every((gate) => gate.status === 'passed') ? 'passed' : 'failed',
    generatedAt: new Date().toISOString(),
    scope: 'deterministic-mock-tests',
    proofMode: true,
    provider: 'mock',
    sourceAtStart,
    source: sourceAtEnd,
    snapshotInputSource,
    sourceIdentityMatchedAtBoundaries,
    executionMode: immutableSnapshotMode ? 'immutable-readonly-worktree' : 'mutable-worktree',
    gates,
    realKeysUsed: false,
    liveProviderValidated: false,
    checkoutValidated: false,
    livePayoutValidated: false,
    productionPublishValidated: false,
    productionSloValidated: false,
    commercialUnitEconomicsValidated: false,
    limitations: [
      'Provider calls are mocked.',
      'Source identity is sampled before and after gates. Matching samples do not rule out a transient edit that is reverted before the final sample.',
      'No real MP4 download or production publish is verified by this runner.',
      'Payment lifecycle and production SLO require separate evidence.',
      'Crypto payout confirmation, full media decoding, and production SLO require separate evidence.',
      'Positive contribution margin requires observed revenue and variable-cost data.',
    ],
  };
  const json = `${JSON.stringify(proof, null, 2)}\n`;
  writeFileSync(path, json);
  writeFileSync(latestPath, json);
  console.log(`Evidence written: ${path}`);
  return { path, proof };
}
