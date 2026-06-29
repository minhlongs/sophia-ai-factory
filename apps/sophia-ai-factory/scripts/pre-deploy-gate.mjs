#!/usr/bin/env node
/**
 * pre-deploy-gate.mjs — Pre-deployment validation
 * Exit codes: 0=green, 1=blocked, 2=usage error
 *
 * Runs before deploy to catch issues early.
 * Bypass: SKIP_PRE_DEPLOY_GATE=1
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = process.cwd(); // deploy script cd's here before invoking this gate

// Platform secrets that MUST exist in wrangler secrets for core functionality
const REQUIRED_SECRETS = [
  'NOWPAYMENTS_API_KEY',
];

// Recommended platform fallbacks (warn if missing, but don't block — customers BYOK)
const RECOMMENDED_SECRETS = [
  'OPENROUTER_API_KEY',
  'TELEGRAM_BOT_TOKEN',
];

const results = [];

function pass(name) { results.push({ name, passed: true }); }
function fail(name, reason) { results.push({ name, passed: false, reason }); }
function skip(name, reason) { results.push({ name, passed: true, skipped: true, reason }); }

function runCommand(cmd, cwd = ROOT) {
  try {
    execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' });
    return true;
  } catch (e) {
    return false;
  }
}

async function checkGitClean() {
  try {
    execSync('git update-index --refresh', { cwd: ROOT, stdio: 'ignore' });
    const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim();
    if (status) {
      fail('Git clean', `uncommitted changes:\n${status.split('\n').slice(0, 10).join('\n')}`);
      return;
    }
    const untracked = execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' }).trim();
    if (untracked) {
      fail('Git clean', `untracked files:\n${untracked.split('\n').slice(0, 10).join('\n')}`);
      return;
    }
    pass('Git clean');
  } catch (e) {
    fail('Git clean', String(e));
  }
}

async function checkTests() {
  if (process.env.SKIP_TESTS === '1') {
    skip('Tests', 'SKIP_TESTS=1');
    return;
  }
  const ok = runCommand('npm test', ROOT);
  if (ok) pass('Tests');
  else fail('Tests', 'npm test failed — fix failing tests before deploy');
}

async function checkBuild() {
  if (process.env.SKIP_BUILD === '1') {
    skip('Build', 'SKIP_BUILD=1');
    return;
  }
  // Clean test artifacts before build — vitest run may leave .next/ in a state
  // that conflicts with production build (Turbopack cache, instrumentation files)
  execSync('rm -rf .next', { cwd: ROOT, stdio: 'ignore' });
  const ok = runCommand('npm run build', ROOT);
  if (ok) pass('Build');
  else fail('Build', 'npm run build failed — fix build errors before deploy');
}

async function checkTypeCheck() {
  if (process.env.SKIP_TSC === '1') {
    skip('TypeScript', 'SKIP_TSC=1');
    return;
  }
  const ok = runCommand('npm run type-check', ROOT);
  if (ok) pass('TypeScript');
  else fail('TypeScript', 'TypeScript errors — fix before deploy');
}

async function checkMigrationsReview() {
  try {
    const changed = execSync('git diff --name-only origin/main...HEAD -- migrations/*.sql', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    if (!changed) {
      pass('Migrations review', 'no new migrations');
      return;
    }
    const files = changed.split('\n').filter(Boolean);
    const unreviewed = [];
    for (const file of files) {
      const fullPath = resolve(ROOT, file);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, 'utf8');
      const hasReview = /(?:Reviewed by|Reviewed-by|RR:|AUTHORIZED:|Ticket:).*/i.test(content);
      if (!hasReview) unreviewed.push(file);
    }
    if (unreviewed.length === 0) {
      pass('Migrations review', `${files.length} migration(s) have review notes`);
    } else {
      fail('Migrations review', `Unreviewed migrations:\n${unreviewed.join('\n')}\nAdd review comment in migration header.`);
    }
  } catch (e) {
    skip('Migrations review', `cannot determine changed migrations: ${e.message}`);
  }
}

async function checkSecrets() {
  // 1. Check local env files
  const envFiles = [resolve(ROOT, '.env.local'), resolve(ROOT, '.dev.vars')];
  const env = {};
  for (const p of envFiles) {
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (val) env[key] = val;
    }
  }

  // 2. Also collect process.env
  for (const k of Object.keys(process.env)) {
    if (process.env[k]) env[k] = process.env[k];
  }

  // 3. Query wrangler secret list for Worker secrets (production runtime)
  let wranglerSecrets = [];
  try {
    const raw = execSync('npx wrangler secret list', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    wranglerSecrets = JSON.parse(raw);
  } catch (_) {
    // wrangler not available or unauthenticated — skip wrangler secrets check
  }
  const wranglerNames = new Set(wranglerSecrets.map(s => s.name));

  // 4. Check required platform secrets
  const missing = REQUIRED_SECRETS.filter(
    k => !env[k] && !wranglerNames.has(k)
  );

  // 5. Check recommended secrets (warn only, don't block)
  const missingRecommended = RECOMMENDED_SECRETS.filter(
    k => !env[k] && !wranglerNames.has(k)
  );

  if (missing.length === 0) {
    const extras = [];
    if (missingRecommended.length > 0) {
      extras.push(`⚠️ Recommended missing: ${missingRecommended.join(', ')} (customer BYOK, not blocking)`);
    }
    pass('Secrets', [
      `${REQUIRED_SECRETS.length + RECOMMENDED_SECRETS.length} checked`,
      `${wranglerSecrets.length} wrangler secrets`,
      ...extras,
    ].join(' | '));
  } else {
    fail('Secrets', `Missing required: ${missing.join(', ')} — set via: npx wrangler secret put <NAME>`);
  }
}

async function main() {
  if (process.env.SKIP_PRE_DEPLOY_GATE === '1') {
    console.log('⚠️ SKIP_PRE_DEPLOY_GATE=1 — bypassing pre-deploy gate');
    process.exit(0);
  }

  await checkGitClean();
  await checkTests();
  await checkBuild();
  await checkTypeCheck();
  await checkMigrationsReview();
  await checkSecrets();

  const passed = results.filter(r => r.passed && !r.skipped).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = results.filter(r => r.skipped).length;

  console.log('\nPre-Deploy Gate Results:');
  for (const r of results) {
    const icon = r.passed ? (r.skipped ? '⏭️' : '✅') : '❌';
    console.log(`${icon} ${r.name}${r.reason ? ` (${r.reason})` : ''}`);
  }
  console.log(`\nTotal: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Gate crashed:', e);
  process.exit(2);
});
