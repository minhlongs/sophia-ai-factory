#!/usr/bin/env node
/**
 * deploy-audit-pre.mjs — pre-deployment audit (all ESM, no require)
 *
 * Gates:
 *   1. Git: HEAD == origin/main, clean working tree
 *   2. TypeScript: npm run ci:typecheck
 *   3. Tests: vitest run
 *   4. ESLint: eslint src --quiet
 *   5. Env vars documented in deployment-checklist.md
 *   6. D1 migrations/ directory present
 *   7. Core video factory proof (no real keys)
 *
 * Evidence: plans/reports/deploy-audit-pre-{ts}.json
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = resolve(root, 'plans/reports');
mkdirSync(reportsDir, { recursive: true });

function run(label, command, args, extraEnv = {}) {
  console.log(`\n==> ${label}\n$ ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: root, stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    const sig = result.signal ? ` signal=${result.signal}` : '';
    console.error(`\nFAIL: ${label} exited ${result.status ?? 'unknown'}${sig}`);
    return { label, status: 'failed' };
  }
  console.log(`PASS: ${label}`);
  return { label, status: 'passed' };
}

function gateGit() {
  console.log('\n==> Gate 1: Git preconditions');
  try {
    const unpushed = spawnSync('git', ['log', 'origin/main..HEAD', '--oneline'], {
      cwd: root, encoding: 'utf8', stdio: 'pipe',
    });
    const count = unpushed.stdout.split('\n').filter(Boolean).length;
    if (count > 0) {
      console.error(`FAIL: ${count} commit(s) on HEAD but not on origin/main`);
      return { label: 'git: HEAD == origin/main', status: 'failed' };
    }
    const dirty = spawnSync('git', ['diff-index', '--quiet', 'HEAD', '--'], {
      cwd: root, stdio: 'pipe',
    });
    if (dirty.status !== 0) {
      console.error('FAIL: working tree has uncommitted changes');
      return { label: 'git: clean working tree', status: 'failed' };
    }
    console.log('PASS: git preconditions');
    return { label: 'git preconditions', status: 'passed' };
  } catch (err) {
    console.error(`FAIL: ${err.message}`);
    return { label: 'git preconditions', status: 'failed' };
  }
}

function gateEnvVars() {
  console.log('\n==> Gate 5: Environment variables');
  const path = resolve(root, 'docs/deployment-checklist.md');
  if (!existsSync(path)) {
    console.error('FAIL: docs/deployment-checklist.md not found');
    return { label: 'env vars documented', status: 'failed' };
  }
  const doc = readFileSync(path, 'utf-8');
  const required = ['BETTER_AUTH_SECRET', 'NOWPAYMENTS_API_KEY', 'HEYGEN_API_KEY',
    'ELEVENLABS_API_KEY', 'OPENROUTER_API_KEY', 'TELEGRAM_BOT_TOKEN',
    'CRON_SECRET', 'RESEND_API_KEY', 'INTERNAL_API_SECRET'];
  const missing = required.filter(v => !doc.includes(v));
  if (missing.length > 0) {
    console.error(`FAIL: missing from checklist: ${missing.join(', ')}`);
    return { label: 'env vars documented', status: 'failed' };
  }
  console.log(`PASS: env vars documented (${required.length} vars)`);
  return { label: 'env vars documented', status: 'passed' };
}

function gateD1Migrations() {
  console.log('\n==> Gate 6: D1 migrations');
  const dir = resolve(root, 'migrations');
  if (!existsSync(dir)) {
    console.error('FAIL: migrations/ directory not found');
    return { label: 'D1 migrations ready', status: 'failed' };
  }
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  console.log(`PASS: D1 migrations (${files.length} files)`);
  return { label: 'D1 migrations ready', status: 'passed' };
}

function main() {
  console.log('=== PRE-DEPLOY AUDIT ===');
  console.log(`Root: ${root}\nTime: ${new Date().toISOString()}`);

  const gates = [
    gateGit(),
    run('TypeScript compile', 'npm', ['run', 'ci:typecheck']),
    run('Unit + integration tests', './node_modules/.bin/vitest',
      ['run', '--reporter=default']),
    run('ESLint zero-error gate', 'node', [
      '--max-old-space-size=14336', './node_modules/eslint/bin/eslint.js',
      'src', '--quiet',
    ]),
    gateEnvVars(),
    gateD1Migrations(),
    run('Core video factory proof', 'node', [
      'scripts/verify-core-video-factory.mjs',
    ], { SOPHIA_CORE_VIDEO_PROOF: '1', SOPHIA_VIDEO_PROVIDER: 'mock' }),
  ];

  const allPassed = gates.every(g => g.status === 'passed');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const json = JSON.stringify({
    stage: 'pre-deploy',
    timestamp: new Date().toISOString(),
    overall: allPassed ? 'passed' : 'failed',
    gates,
  }, null, 2);

  const tsPath = resolve(reportsDir, `deploy-audit-pre-${timestamp}.json`);
  writeFileSync(tsPath, json);
  writeFileSync(resolve(reportsDir, 'deploy-audit-pre-latest.json'), json);
  console.log(`\nEvidence: ${tsPath}`);

  console.log('\n=== PRE-DEPLOY AUDIT SUMMARY ===');
  for (const g of gates) console.log(`  ${g.status === 'passed' ? '✓' : '✗'} ${g.label}`);

  if (allPassed) {
    console.log('\n✅ PRE-DEPLOY AUDIT PASSED — safe to deploy');
  } else {
    console.error('\n❌ PRE-DEPLOY AUDIT FAILED — deploy blocked');
    process.exit(1);
  }
}

main();
