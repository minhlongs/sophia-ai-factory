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
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const proofTests = [
  'src/land/video/__tests__/video-render-provider.test.ts',
  'src/land/video/__tests__/render-byok-video.test.ts',
  'src/land/missions/__tests__/auto-video-mission-proof.test.ts',
  'src/app/api/checkout/route.test.ts',
  'src/app/api/checkout/status/__tests__/route.test.ts',
  'src/land/billing/__tests__/nowpayments-ipn-idempotency.test.ts',
  'src/land/billing/__tests__/nowpayments-e2e-payment-lifecycle.test.ts',
  'src/tree/live-proof/__tests__/verify-user-video-flow-live-evidence.test.ts',
  'src/tree/live-proof/__tests__/evidence-recorder.test.ts',
  'src/tree/live-proof/__tests__/runtime.test.ts',
  'src/tree/live-proof/__tests__/verify-mp4-playback.test.ts',
  'src/tree/live-proof/__tests__/verify-core-video-factory-evidence.test.ts',
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

const gatesToRun = [
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
      'src/land/video/__tests__/render-byok-video.test.ts',
      'src/land/missions/__tests__/auto-video-mission-proof.test.ts',
      'src/app/api/checkout/route.test.ts',
      'src/app/api/checkout/status/__tests__/route.test.ts',
      'src/land/billing/__tests__/nowpayments-ipn-idempotency.test.ts',
      'src/land/billing/__tests__/nowpayments-e2e-payment-lifecycle.test.ts',
      '--reporter=default',
    ],
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
      'src/tree/live-proof/__tests__/verify-saas-payment-live.test.ts',
      'src/tree/live-proof/__tests__/verify-saas-payment-live-evidence.test.ts',
      'src/tree/live-proof/__tests__/verify-saas-payout-live.test.ts',
      'src/tree/live-proof/__tests__/verify-saas-payout-live-evidence.test.ts',
      'src/tree/live-proof/__tests__/verify-sophia-business-flow-evidence.test.ts',
      '--reporter=default',
    ],
  ],
  ['TypeScript compile', 'npm', ['run', 'ci:typecheck']],
  [
    'ESLint zero-error gate',
    'node',
    ['--max-old-space-size=14336', './node_modules/eslint/bin/eslint.js', 'src', '--quiet'],
  ],
];

for (const [label, command, commandArgs] of gatesToRun) {
  run(label, command, commandArgs);
}

const evidence = writeEvidence();
const allPassed = gates.every((gate) => gate.status === 'passed');
console.log(`\n${allPassed ? 'DETERMINISTIC MOCK GATES PASS' : 'DETERMINISTIC MOCK GATES FAIL'}: ${evidence.path}`);
console.log('This report covers mocked video tests and static checks only; it does not prove live provider, payment, publishing, production SLO, or positive unit economics.');
if (!allPassed) process.exit(1);

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : null;
}

function sourceIdentity() {
  const status = gitOutput(['status', '--porcelain=v1', '--untracked-files=all']);
  const diff = gitOutput(['diff', 'HEAD', '--binary', '--', '.']);
  const untracked = gitOutput(['ls-files', '--others', '--exclude-standard', '-z']);
  const fingerprint = createHash('sha256');
  fingerprint.update(status ?? 'git-status-unavailable');
  fingerprint.update(diff ?? 'git-diff-unavailable');

  if (untracked) {
    for (const relativePath of untracked.split('\0').filter(Boolean)) {
      const absolutePath = resolve(root, relativePath);
      try {
        if (statSync(absolutePath).isFile()) {
          fingerprint.update(relativePath);
          fingerprint.update(readFileSync(absolutePath));
        }
      } catch {
        fingerprint.update(`${relativePath}:unreadable`);
      }
    }
  }

  return {
    commitSha: gitOutput(['rev-parse', 'HEAD'])?.trim() ?? null,
    worktreeClean: status === '',
    changedPathCount: status ? status.split('\n').filter(Boolean).length : 0,
    worktreeFingerprint: fingerprint.digest('hex'),
  };
}

function writeEvidence() {
  const reportsDir = resolve(root, 'plans/reports');
  mkdirSync(reportsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = resolve(reportsDir, `core-video-factory-proof-${ts}.json`);
  const latestPath = resolve(reportsDir, 'core-video-factory-proof-latest.json');
  const proof = {
    schema: 'sophia-core-video-deterministic-proof-v2',
    status: gates.every((gate) => gate.status === 'passed') ? 'passed' : 'failed',
    generatedAt: new Date().toISOString(),
    scope: 'deterministic-mock-tests',
    proofMode: true,
    provider: 'mock',
    source: sourceIdentity(),
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
