#!/usr/bin/env node
/**
 * No-Tech Doctrine Compliance Audit
 *
 * Verifies no operator credentials are needed for production to be "green".
 * Every integration must be BYOK (customer-configured) or optional/degradable.
 *
 * Exit 0 = pass, 1 = violations.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

let failed = 0;
let warnings = 0;

function pass(label) { console.log(' PASS  ' + label); }
function fail(label, msg) { console.log(' FAIL  ' + label + ': ' + msg); failed++; }
function warn(label, msg) { console.log(' WARN  ' + label + ': ' + msg); warnings++; }

// ─── 1. Banned payment providers ───────────────────────────────────────────
function checkBannedProviders() {
  console.log('\n[1] Banned payment providers');
  const banned = ['@polar-sh/nextjs', 'polar-sh', '@paypal', 'paypal'];
  const pkgPath = join(ROOT, 'package.json');
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  const keys = Object.keys(deps);
  for (const b of banned) {
    const hits = keys.filter(k => k.toLowerCase().indexOf(b.toLowerCase()) >= 0);
    if (hits.length > 0) fail(b, 'Found in deps: ' + hits.join(', '));
    else pass('No ' + b);
  }
}

// ─── 2. Credential encryption ───────────────────────────────────────────────
function checkCredentialEncryption() {
  console.log('\n[2] Credential encryption');
  const files = [
    'src/seed/security/credential-crypto.ts',
    'src/tree/credentials/encryption.ts',
    'src/tree/credentials/user-credentials-repo.ts',
  ];
  let found = 0;
  for (const f of files) {
    if (existsSync(join(ROOT, f))) found++;
  }
  if (found > 0) pass('Encryption files present (' + found + ')');
  else fail('No credential encryption files', 'encryptValue/decryptValue not found');
}

// ─── 3. Operator-side secrets ───────────────────────────────────────────────
function checkOperatorSecrets() {
  console.log('\n[3] Operator-side secrets');
  const secrets = [
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY',
    'SENTRY_AUTH_TOKEN',
  ];
  const approved = [
    'src/seed/cache/redis.ts', 'src/seed/utils/redis-client.ts',
    'src/seed/redis.ts', 'src/tree/clients/upstash-redis-client.ts',
    'src/land/redis.ts', 'src/tree/clients/index.ts',
    'src/land/payouts/stripe-connect.ts',
  ];
  let hits = 0;
  for (const s of secrets) {
    try {
      const out = execSync('grep -rln ' + JSON.stringify(s) +
        ' src/ --include=' + JSON.stringify('*.ts') +
        ' --include=' + JSON.stringify('*.tsx'), { cwd: ROOT, encoding: 'utf8' });
      const files = out.split('\n').filter(Boolean);
      for (const f of files) {
        if (approved.some(a => f.indexOf(a) >= 0 || f.indexOf('/__tests__/') >= 0)) continue;
        warn(s + ' in unexpected file', f);
        hits++;
      }
    } catch {}
  }
  if (hits === 0) pass('No unchecked operator-side secrets');
}

// ─── 4. Hard-fail on missing optional secrets ───────────────────────────────
const byokGlobs = [
  'src/seed/cache/redis.ts',
  'src/seed/utils/redis-client.ts',
  'src/seed/redis.ts',
  'src/tree/clients/upstash-redis-client.ts',
  'src/land/redis.ts',
];

function checkHardFails() {
  console.log('\n[4] Graceful degradation for optional secrets');
  const optSecrets = ['SENTRY_AUTH_TOKEN', 'HONEYCOMB_API_KEY',
    'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  let hardFails = 0;
  for (const s of optSecrets) {
    try {
      const out = execSync('grep -rn ' + JSON.stringify(s) +
        ' src/ --include=' + JSON.stringify('*.ts') +
        ' --include=' + JSON.stringify('*.tsx'), { cwd: ROOT, encoding: 'utf8' });
      const lines = out.split('\n').filter(Boolean);
      for (const line of lines) {
        const fileFromLine = (line.split(':')[0] || '');
        if (byokGlobs.some(g => fileFromLine.indexOf(g) >= 0)) continue;

        if (line.indexOf('throw') >= 0 || line.indexOf('required') >= 0) {
          const parts = line.split(':');
          warn(s + ' hard-fail', (parts[0] + ':' + (parts[1] || '').trim()).slice(0, 80));
          hardFails++;
        }
      }
    } catch {}
  }
  if (hardFails === 0) pass('Optional secrets degrade gracefully');
}

// ─── 5. CF-Direct vs GitHub Actions contradiction ──────────────────────────
function checkCFDirect() {
  console.log('\n[5] CF-Direct doctrine (GitHub Actions contradiction)');
  let actionsFiles = [];
  for (const d of ['.github/workflows']) {
    if (existsSync(join(ROOT, d))) {
      try {
        actionsFiles = actionsFiles.concat(readdirSync(join(ROOT, d)).map(f => d + '/' + f));
      } catch {}
    }
  }
  const active = actionsFiles.filter(f => !f.includes('.disabled') && !f.includes('.archive'));
  if (active.length > 0) {
    warn('Active GitHub Actions workflows (' + active.length + ')', active.join(', '));
    console.log('       CF-direct doctrine: disable these — see sophia-no-tech-doctrine.md');
  } else {
    pass('No active GitHub Actions workflows');
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
function main() {
  console.log('═══════════════════════════════════');
  console.log(' No-Tech Doctrine Compliance Audit');
  console.log('═══════════════════════════════════');
  checkBannedProviders();
  checkCredentialEncryption();
  checkOperatorSecrets();
  checkHardFails();
  checkCFDirect();
  console.log('\n═══════════════════════════════════');
  if (failed > 0) {
    console.log(' RESULT FAILED: ' + failed + ' violation(s), ' + warnings + ' warning(s)');
    process.exit(1);
  }
  console.log(' RESULT PASSED: ' + warnings + ' warning(s)');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
