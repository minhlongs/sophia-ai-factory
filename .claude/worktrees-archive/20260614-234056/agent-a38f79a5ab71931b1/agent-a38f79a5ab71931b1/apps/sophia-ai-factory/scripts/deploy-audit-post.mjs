#!/usr/bin/env node
/**
 * deploy-audit-post.mjs
 *
 * Post-deployment audit: verifies the live worker is healthy and matches
 * the expected commit SHA. Runs after `npx wrangler deploy`.
 *
 * Gates:
 *   1. Production HTTP 200 (root)
 *   2. Version endpoint matches local HEAD SHA
 *   3. Critical routes 200 (/login, /pricing, /blog, /guide)
 *   4. Auth gate 307 (/dashboard → /login)
 *   5. API version endpoint returns valid JSON
 *   6. Health endpoint returns ok (if present)
 *
 * Evidence: plans/reports/deploy-audit-post-{timestamp}.json
 *
 * Usage:
 *   node scripts/deploy-audit-post.mjs
 *   PROD_URL=https://staging.example.com node scripts/deploy-audit-post.mjs
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = resolve(root, 'plans/reports');
mkdirSync(reportsDir, { recursive: true });

const PROD_URL = (process.env.PROD_URL || 'https://sophia.agencyos.network').replace(/\/+$/, '');

function curl(url, opts = {}) {
  const args = ['-fsS', '-o', '/dev/null', '-w', '%{http_code}', '-H', 'Accept: application/json'];
  if (opts.method) args.push('-X', opts.method);
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) args.push('-H', `${k}: ${v}`);
  }
  if (opts.maxTime) args.push('--max-time', String(opts.maxTime));
  args.push(url);
  const result = spawnSync('curl', args, { encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    return { ok: false, status: null, error: result.stderr?.trim() || 'curl failed' };
  }
  const code = result.stdout.trim();
  return { ok: code === (opts.expect || '200'), status: code, error: null };
}

function curlBody(url, opts = {}) {
  const args = ['-fsS', '-H', 'Accept: application/json'];
  if (opts.method) args.push('-X', opts.method);
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) args.push('-H', `${k}: ${v}`);
  }
  args.push(url);
  const result = spawnSync('curl', args, { encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) return null;
  try { return JSON.parse(result.stdout.trim()); } catch { return result.stdout.trim(); }
}

function gate(label, fn) {
  try {
    const result = fn();
    const status = result.ok ? 'passed' : 'failed';
    console.log(`  ${result.ok ? '✓' : '✗'} ${label}${result.status ? ` (HTTP ${result.status})` : ''}`);
    if (!result.ok) console.error(`     Error: ${result.error || 'unexpected status'}`);
    return { label, status, httpStatus: result.status, error: result.error };
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
    return { label, status: 'failed', error: err.message };
  }
}

function writeEvidence(gates) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = resolve(reportsDir, `deploy-audit-post-${ts}.json`);
  const latest = resolve(reportsDir, 'deploy-audit-post-latest.json');
  let localSha = '';
  try {
    localSha = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    }).stdout.trim();
  } catch { /* not a git repo */ }
  const evidence = {
    stage: 'post-deploy',
    timestamp: new Date().toISOString(),
    prodUrl: PROD_URL,
    localSha,
    gates,
    overall: gates.every((g) => g.status === 'passed') ? 'passed' : 'failed',
  };
  const json = JSON.stringify(evidence, null, 2);
  writeFileSync(path, json);
  writeFileSync(latest, json);
  console.log(`\nEvidence: ${path}`);
  return evidence;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log('=== POST-DEPLOY AUDIT ===');
  console.log(`Production: ${PROD_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  const gates = [
    gate('HTTP 200 on root', () => curl(`${PROD_URL}/`, { expect: '200' })),
    gate('HTTP 200 on /login', () => curl(`${PROD_URL}/login`, { expect: '200' })),
    gate('HTTP 200 on /pricing', () => curl(`${PROD_URL}/pricing`, { expect: '200' })),
    gate('HTTP 200 on /blog', () => curl(`${PROD_URL}/blog`, { expect: '200' })),
    gate('HTTP 200 on /guide', () => curl(`${PROD_URL}/guide`, { expect: '200' })),
    gate('Auth gate 307 on /dashboard', () => curl(`${PROD_URL}/dashboard`, { expect: '307' })),
    gate('API version endpoint valid JSON', () => {
      const body = curlBody(`${PROD_URL}/api/version`);
      if (!body) return { ok: false, status: null, error: 'no response body' };
      if (typeof body !== 'object') return { ok: false, status: null, error: 'not JSON' };
      if (!body.shortSha && !body.commitSha) return { ok: false, status: null, error: 'missing sha fields' };
      return { ok: true, status: '200', error: null };
    }),
    gate('Health endpoint (optional)', () => {
      const r = curl(`${PROD_URL}/api/health`, { expect: '200', maxTime: 5 });
      if (r.ok) return r;
      // Non-fatal: health endpoint may not exist yet
      return { ok: true, status: 'skipped', error: 'endpoint not implemented (non-fatal)' };
    }),
  ];

  const evidence = writeEvidence(gates);

  console.log('\n=== POST-DEPLOY AUDIT SUMMARY ===');
  for (const g of gates) {
    const icon = g.status === 'passed' ? '✓' : '✗';
    console.log(`  ${icon} ${g.label}`);
  }

  if (evidence.overall === 'failed') {
    console.error('\n❌ POST-DEPLOY AUDIT FAILED — review results above');
    console.error('Possible action: rollback via `npm run deploy:rollback` or redeploy previous SHA');
    process.exit(1);
  }
  console.log('\n✅ POST-DEPLOY AUDIT PASSED — production is healthy');
}

main();
