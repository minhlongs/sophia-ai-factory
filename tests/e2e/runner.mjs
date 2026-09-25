#!/usr/bin/env node

/**
 * Sophia AI Factory — E2E Test Suite Runner
 *
 * Runs the 4-tier E2E testing suite covering all 31 features across:
 * - Tier 1: Feature Coverage (Features 1 - 31)
 * - Tier 2: Boundary & Corner Cases (Features 1 - 31)
 * - Tier 3: Cross-Feature State & Data Sharing
 * - Tier 4: Real-World Multi-Actor Application Scenarios
 *
 * Usage:
 *   node tests/e2e/runner.mjs
 *   node tests/e2e/runner.mjs --tier1
 *   node tests/e2e/runner.mjs --tier2
 *   node tests/e2e/runner.mjs --tier3
 *   node tests/e2e/runner.mjs --tier4
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const vitestBin = path.resolve(projectRoot, 'apps/sophia-ai-factory/node_modules/vitest/vitest.mjs');

const args = process.argv.slice(2);
let targetPattern = 'tests/e2e/';

if (args.includes('--tier1')) {
  targetPattern = 'tests/e2e/tier1-feature-coverage/';
} else if (args.includes('--tier2')) {
  targetPattern = 'tests/e2e/tier2-boundary-corner/';
} else if (args.includes('--tier3')) {
  targetPattern = 'tests/e2e/tier3-cross-feature/';
} else if (args.includes('--tier4')) {
  targetPattern = 'tests/e2e/tier4-real-world/';
}

console.log('======================================================================');
console.log('  Sophia AI Factory — E2E Test Suite Runner (31 Features / 4 Tiers)');
console.log('======================================================================');
console.log(`Target: ${targetPattern}`);
console.log(`Node:   ${process.version}`);
console.log(`Time:   ${new Date().toISOString()}`);
console.log('----------------------------------------------------------------------\n');

const vitestArgs = [
  vitestBin,
  'run',
  '--root',
  '.',
  '--config',
  'tests/e2e/vitest.config.ts',
  '--exclude',
  '**/.stryker-tmp/**',
  '--exclude',
  '**/.claude/**',
  '--exclude',
  'apps/**',
  targetPattern,
];

const child = spawn(process.execPath, vitestArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n----------------------------------------------------------------------');
    console.log('  ✅ ALL E2E TESTS PASSED (100% Pass Rate)');
    console.log('======================================================================\n');
  } else {
    console.error('\n----------------------------------------------------------------------');
    console.error(`  ❌ E2E TEST FAILURES DETECTED (Exit code: ${code})`);
    console.error('======================================================================\n');
  }
  process.exit(code ?? 1);
});
