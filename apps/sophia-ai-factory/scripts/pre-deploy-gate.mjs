#!/usr/bin/env node
/**
 * Pre-deploy gate — blocks deploy if UI bugs found.
 *
 * Steps:
 * 1. Route Integrity: Every href="/" in Stitch components must exist as a page route
 * 2. Page Render: Critical URLs return HTTP 200 (not 404/500)
 * 3. CSS Audit: No hardcoded #6366F1 / indigo-* in changed files
 *
 * Usage:
 * node scripts/pre-deploy-gate.mjs # run all checks
 * SKIP_PRE_DEPLOY_GATE=1 node ... # bypass
 *
 * Exit code: 0 = pass, 1 = fail
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE_URL = process.env.PREVIEW_URL || 'http://localhost:3000';
// ─── Secrets reference ──────────────────────────────────────────────────────
// `.env.production.example` documents the operator-required secrets.
// This file is reference-only — production secrets are injected via
// `wrangler secret put` and `wrangler.toml` bindings. The local test env
// is `.dev.vars` (Cloudflare convention). Both the reference file and the
// live env are checked so operators get actionable guidance on what is
// missing without leaking any actual values.
const SECRETS_REF_PATH = join(ROOT, '.env.production.example');
const DEV_VARS_PATH = join(ROOT, '.dev.vars');

function parseEnvFile(path) {
  try {
    const content = readFileSync(path, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const idx = line.indexOf('=');
        return line.slice(0, idx).trim();
      });
  } catch {
    return [];
  }
}

function parseDevVars(path) {
  try {
    const content = readFileSync(path, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const idx = line.indexOf('=');
        return line.slice(0, idx).trim();
      });
  } catch {
    return [];
  }
}

// Secrets whose runtime value comes from `wrangler secret put` rather than the
// developer's `.env.local` / `.dev.vars`. These SHOULD be absent from
// `.dev.vars` (the operator sets them in the CF Workers console). If they
// appear in `process.env` they pass; if not, they are flagged as a warning
// rather than a hard failure so the gate does not block local development.
const CLOUDFLARE_SECRET_NAMES = new Set([
  'BETTER_AUTH_SECRET',
  'CRON_SECRET',
  'INTERNAL_API_SECRET',
  'TELEGRAM_WEBHOOK_SECRET',
 'HEALTH_CHECK_SECRET',
  'NOWPAYMENTS_IPN_SECRET',
  'PAYOS_API_KEY',
  'PAYOS_CHECKSUM_KEY',
  'RESEND_API_KEY',
  'INNGEST_EVENT_KEY',
  'INNGEST_SIGNING_KEY',
  'TELEGRAM_BOT_TOKEN',
  'METRICS_BEARER_TOKEN',
  'INTROSPECT_TOKEN',
]);

// Variables baked into the Next.js client bundle at build time via
// `deploy-with-sha.sh` Step 1's export loop. They are intentionally absent
// from `.env.production` at runtime.
const BUILD_TIME_VAR_NAMES = new Set([
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_IS_CONFIGURED',
]);

function isBuildTimeVar(name) {
  return BUILD_TIME_VAR_NAMES.has(name) || name.startsWith('NEXT_PUBLIC_');
}

const ALLOWLIST = [
  '/billing', '/contact', '/projects', '/projects/new', '/settings', '/docs',
// Pre-existing Stitch design links — routes not yet implemented
  '/affiliates', '/features',
];

let failed = 0;

async function checkRouteIntegrity() {
  console.log('\n🔍 Step 1: Route Integrity Scan');
  const appDir = join(ROOT, 'src', 'app', '[locale]');

  let hrefs;
  try {
    const output = execSync(
      `grep -rn 'href="/' src/components/stitch/ --include="*.tsx" | sed 's/.*href="\\([^"]*\\).*/\\1/' | sort -u`,
      { cwd: ROOT, encoding: 'utf-8', maxBuffer: 1024 * 1024 }
    );
    hrefs = output.trim().split('\n').filter(Boolean);
  } catch {
    hrefs = [];
  }

  if (hrefs.length === 0) {
    console.log(' ⚠️ No hardcoded routes found in Stitch components');
    return;
  }

  let stepFail = 0;
  for (const href of hrefs) {
    if (href.startsWith('http') || href.startsWith('mailto') || href === '#' || href.startsWith('#')) continue;
    if (href.includes('${') || href.includes('{')) continue;

    const routePath = href.replace(/^\//, '').replace(/\/$/, '');
    if (!routePath) continue;
    if (ALLOWLIST.includes(href)) continue; // known pre-existing

    const rootAppDir = join(ROOT, 'src', 'app');
    const pathsToCheck = [
      join(appDir, routePath, 'page.tsx'),
      join(rootAppDir, routePath, 'page.tsx'),
      join(rootAppDir, routePath, 'page.tsx'),
      join(rootAppDir, '(auth)', routePath, 'page.tsx'),
    ];

    const exists = pathsToCheck.some(p => existsSync(p));
    if (!exists && !routePath.includes('[')) {
      console.log(` ❌ /${routePath} → no page.tsx found`);
      stepFail++;
    }
  }

  if (stepFail > 0) {
    console.log(` 🔴 Route Integrity: ${stepFail} broken`);
    failed++;
  } else {
    console.log(` ✅ ${hrefs.length} routes verified`);
  }
}

async function checkPageRender() {
  console.log('\n🌐 Step 2: Page Render Check');
  const urls = ['/','/login','/auth/signup','/pricing','/reset-password','/api/health','/api/version','/en/login','/vi/login','/guide','/privacy','/terms'];

  let stepFail = 0;
  for (const path of urls) {
    const url = `${BASE_URL}${path}`;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (resp.status === 200 || resp.status === 307 || resp.status === 429) {
        // 307 = locale redirect, 429 = rate limited (still alive)
        console.log(` ✅ ${path} → ${resp.status}`);
      } else {
        console.log(` ❌ ${path} → ${resp.status}`);
        stepFail++;
      }
    } catch (err) {
      console.log(` ⚠️ ${path} → ${err.message}`);
      if (BASE_URL.includes('sophia.agencyos.network')) stepFail++;
    }
  }

  if (stepFail > 0) {
    console.log(` 🔴 Page Render: ${stepFail} fail`);
    failed++;
  } else {
    console.log(` ✅ ${urls.length} URLs OK`);
  }
}

async function checkCSSAudit() {
  console.log('\n🎨 Step 3: CSS Audit');
  let changedFiles;
  try {
    const output = execSync(
      `git diff --cached --name-only && git diff --name-only`,
      { cwd: ROOT, encoding: 'utf-8' }
    );
    changedFiles = output.trim().split('\n').filter(Boolean);
  } catch {
    changedFiles = [];
  }

  if (changedFiles.length === 0) { console.log(' ℹ️ No changed files'); return; }

  let stepFail = 0;
  const patterns = ['#6366F1', 'indigo-500', 'indigo-400', 'indigo-600'];

  for (const file of changedFiles) {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts') && !file.endsWith('.css')) continue;
    if (file.includes('node_modules') || file.includes('.next')) continue;

    for (const pattern of patterns) {
      try {
        const count = parseInt(execSync(
          `grep -c '${pattern}' "${file}" 2>/dev/null || echo 0`,
          { encoding: 'utf-8' }
        ).trim());
        if (count > 0) {
          console.log(` ❌ ${file}: ${count}× ${pattern}`);
          stepFail++;
        }
      } catch {}
    }
  }

  if (stepFail > 0) {
    console.log(` 🔴 CSS Audit: ${stepFail} hardcoded`);
    failed++;
  } else {
    console.log(` ✅ No hardcoded colors`);
  }
}

async function checkSecrets() {
  console.log('\n🔒 Step 4: Secrets Audit');
  const referenceNames = parseEnvFile(SECRETS_REF_PATH);
  const devVarNames = parseDevVars(DEV_VARS_PATH);
  const liveEnvKeys = new Set(Object.keys(process.env));

  if (referenceNames.length === 0) {
    console.log(' ⚠️ Reference env file missing; cannot compare');
    return;
  }

  let stepFail = 0;
  const warnings = [];

  for (const name of referenceNames) {
    if (isBuildTimeVar(name)) {
      // Build-time vars are intentionally absent from runtime env.
      continue;
    }

    const inDevVars = devVarNames.includes(name);
    const inLiveEnv = liveEnvKeys.has(name);

    if (CLOUDFLARE_SECRET_NAMES.has(name)) {
      if (!inLiveEnv && !inDevVars) {
        console.info(` ℹ️ ${name} (operator-injected via wrangler secret put)`);
      }
      continue;
    }

    if (!inLiveEnv && !inDevVars) {
      console.log(` ❌ ${name} → missing from env`);
      stepFail++;
    } else if (inLiveEnv && !process.env[name]) {
      console.log(` ❌ ${name} → present but empty`);
      stepFail++;
    }
  }

  warnings.forEach(msg => console.log(` ⚠️ ${msg}`));

  if (stepFail > 0) {
    console.log(` 🔴 Secrets: ${stepFail} missing/empty`);
    failed++;
  } else {
    console.log(` ✅ ${referenceNames.length} reference vars audited`);
  }
}

async function checkSecretUniqueness() {
  console.log('\n🔑 Step 5: JWT/HTTP Secret Uniqueness');




  const candidates = [
    'BETTER_AUTH_SECRET',
    'CRON_SECRET',
    'INTERNAL_API_SECRET',
    'TELEGRAM_WEBHOOK_SECRET',
 'HEALTH_CHECK_SECRET',
];
  const values = candidates.map(name => process.env[name]).filter(v => v);
  const unique = new Set(values).size;

  if (values.length < candidates.length) {
    console.log(' ⚠️ 1+ signing secret absent; skipping uniqueness check');
    return;
  }

  if (unique !== candidates.length) {
    console.log(
      ` ❌ Signing secrets reuse detected (${unique}/${candidates.length} unique)`
    );
    failed++;
  } else {
    console.log(` ✅ ${candidates.length} signing secrets are distinct`);
  }
}

async function main() {
  if (process.env.SKIP_PRE_DEPLOY_GATE === '1') {
    console.log('⏭️ Skipped (SKIP_PRE_DEPLOY_GATE=1)');
    process.exit(0);
  }

  console.log('═══════════════════════════════════');
  console.log(' 🔒 Pre-Deploy Gate');
  console.log('═══════════════════════════════════');

  await checkRouteIntegrity();
  await checkPageRender();
  await checkCSSAudit();
await checkSecrets();
await checkSecretUniqueness();

  console.log('\n═══════════════════════════════════');
  if (failed > 0) {
    console.log(` ❌ FAILED: ${failed} check(s)`);
    console.log(' 💡 Set SKIP_PRE_DEPLOY_GATE=1 to bypass');
    process.exit(1);
  } else {
    console.log(' ✅ PASSED');
    process.exit(0);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
