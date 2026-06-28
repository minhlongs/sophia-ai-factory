#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const proofTests = [
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
  'src/forest/missions/handlers/video-create.test.ts',
  'src/forest/missions/handlers/video-status.test.ts',
  'src/app/api/v1/missions/__tests__/route.contract.test.ts',
  'src/app/api/v1/missions/[id]/generate-video/route.test.ts',
  'src/forest/inngest/functions/video-generate.test.ts',
  'src/app/api/v1/integrations/channels/route.test.ts',
  'src/forest/missions/handlers/social-publish.test.ts',
  'src/forest/missions/handlers/youtube-publish.test.ts',
  'src/app/api/v1/videos/[id]/distribute/__tests__/route.test.ts',
  'src/app/api/v1/distribute/jobs/[videoId]/status/__tests__/route.test.ts',
  'src/lib/publishing/__tests__/bundle-publisher.test.ts',
  'src/lib/publishing/__tests__/youtube-publisher.test.ts',
  'src/lib/publishing/__tests__/tiktok-publisher.test.ts',
  'src/lib/publishing/__tests__/instagram-publisher.test.ts',
  'src/lib/openclaw/__tests__/spawn-agent-fleet.test.ts',
  'src/tree/gateway/openclaw-gateway.test.ts',
  'src/tree/live-proof/__tests__/verify-user-video-flow-live-evidence.test.ts',
];

function run(label, command, commandArgs) {
  console.log(`\n==> ${label}`);
  console.log(`$ ${[command, ...commandArgs].join(' ')}`);

  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    const signal = result.signal ? ` signal=${result.signal}` : '';
    console.error(`\nFAIL: ${label} exited with code ${result.status ?? 'unknown'}${signal}`);
    process.exit(result.status ?? 1);
  }
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

const gates = [
  ['i18n key parity', 'npm', ['run', 'i18n:validate']],
  ['TypeScript compile', 'npm', ['run', 'ci:typecheck']],
  [
    'ESLint zero-error gate',
    'node',
    ['--max-old-space-size=14336', './node_modules/eslint/bin/eslint.js', 'src', '--quiet'],
  ],
  [
    'targeted user video flow tests',
    './node_modules/.bin/vitest',
    ['run', ...proofTests, '--reporter=default'],
  ],
];

for (const [label, command, commandArgs] of gates) {
  run(label, command, commandArgs);
}

console.log('\nPROOF PASS: local gates covered user API keys, credential lookup, BYOK video render, mission video generation, multi-platform distribution, and OpenClaw orchestration primitives.');
console.log('Boundary: live provider callbacks, browser checkout, and production publishing still require a live E2E run with real sandbox/production credentials.');
