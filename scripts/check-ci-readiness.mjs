#!/usr/bin/env node
/**
 * check-ci-readiness.mjs
 * Preflight verification tool for Sophia AI Factory GitHub Actions CI/CD.
 *
 * Verifies:
 *   1. Workflow infrastructure (.github/workflows/deploy.yml 4-stage pipeline).
 *   2. Dependency lockfile integrity (apps/sophia-ai-factory/package-lock.json).
 *   3. Cloudflare API credentials presence (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID).
 *   4. Live Cloudflare API authentication (/user/tokens/verify).
 *   5. Cloudflare D1 database access (sophia-raas-db).
 *   6. Actionable GitHub repository secrets configuration instructions.
 *
 * Usage:
 *   node scripts/check-ci-readiness.mjs
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const APP_ROOT = resolve(REPO_ROOT, 'apps/sophia-ai-factory');

const D1_DATABASE_ID = '78bd1961-b62d-43bb-b551-0c5d7d389506';

const pass = (title, msg = '') => console.log(`  ✅ ${title}${msg ? ` — ${msg}` : ''}`);
const warn = (title, msg = '') => console.log(`  ⚠️  ${title}${msg ? ` — ${msg}` : ''}`);
const fail = (title, msg = '') => console.log(`  ❌ ${title}${msg ? ` — ${msg}` : ''}`);

async function main() {
  console.log('\n🔍 Sophia AI Factory — CI/CD Preflight Readiness Audit\n');

  let errors = 0;
  let warnings = 0;

  // 1. Workflow Infrastructure Check
  console.log('1. Workflow Infrastructure:');
  const deployWorkflowPath = resolve(REPO_ROOT, '.github/workflows/deploy.yml');
  const disabledWorkflowPath = resolve(REPO_ROOT, '.github/workflows/deploy.yml.disabled');

  if (existsSync(disabledWorkflowPath)) {
    fail('Workflow Disabled', '.github/workflows/deploy.yml.disabled exists. Remove .disabled extension.');
    errors++;
  } else if (existsSync(deployWorkflowPath)) {
    const content = readFileSync(deployWorkflowPath, 'utf8');
    const hasPushMain = /branches:\s*\[.*main.*\]|branches:\s*\n\s*-\s*main/.test(content);
    const hasWorkflowDispatch = content.includes('workflow_dispatch');
    const hasStage1 = content.includes('stage-1-quality-gate') || content.includes('Quality Gate');
    const hasStage2 = content.includes('stage-2') || content.includes('Build') || content.includes('build-and-deploy');
    const hasStage4 = content.includes('stage-4') || content.includes('post-deploy') || content.includes('Post-Deploy');

    if (hasPushMain && hasWorkflowDispatch && hasStage1 && hasStage2 && hasStage4) {
      pass('Canonical Workflow', '.github/workflows/deploy.yml active with 4-stage pipeline');
    } else {
      warn('Workflow Structure', '.github/workflows/deploy.yml present but may be missing required stages or triggers');
      warnings++;
    }
  } else {
    fail('Workflow Missing', '.github/workflows/deploy.yml not found');
    errors++;
  }

  // 2. Lockfile Check
  console.log('\n2. Dependency Lockfiles:');
  const appLockfile = resolve(APP_ROOT, 'package-lock.json');
  if (existsSync(appLockfile)) {
    pass('App Lockfile', 'apps/sophia-ai-factory/package-lock.json is present');
  } else {
    fail('App Lockfile Missing', 'apps/sophia-ai-factory/package-lock.json is missing');
    errors++;
  }

  // 3. Cloudflare Credentials & Secrets Check
  console.log('\n3. Cloudflare Credentials & Secrets:');
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!token) {
    warn('CLOUDFLARE_API_TOKEN', 'Not set in local environment (must be configured in GitHub Repo Secrets)');
    warnings++;
  } else {
    const masked = token.length > 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : '***';
    pass('CLOUDFLARE_API_TOKEN', `Present (${masked})`);
  }

  if (!accountId) {
    warn('CLOUDFLARE_ACCOUNT_ID', 'Not set in local environment (must be configured in GitHub Repo Secrets)');
    warnings++;
  } else {
    const masked = accountId.length > 6 ? `${accountId.slice(0, 6)}...` : '***';
    pass('CLOUDFLARE_ACCOUNT_ID', `Present (${masked})`);
  }

  // 4. Live Cloudflare API Verification (if token present)
  if (token) {
    console.log('\n4. Live Cloudflare API Verification:');
    try {
      let verifyData;
      try {
        const verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
        verifyData = await verifyRes.json();
      } catch (err) {
        // Fallback to curl (execFile — no shell interpolation of the token)
        const { execFileSync } = await import('child_process');
        const out = execFileSync('curl', ['-s', '-H', `Authorization: Bearer ${token}`, 'https://api.cloudflare.com/client/v4/user/tokens/verify'], {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
        });
        verifyData = JSON.parse(out);
      }

      if (verifyData.success && verifyData.result?.status === 'active') {
        pass('Token Status', 'Active & Authenticated with Cloudflare API');
      } else {
        warn('Token Status', `Token verification failed: ${JSON.stringify(verifyData.errors || [])}`);
        warnings++;
      }
    } catch (e) {
      warn('Token Verification', `Network error querying Cloudflare API: ${e.message}`);
      warnings++;
    }

    if (accountId) {
      try {
        let d1Data;
        try {
          const d1Res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${D1_DATABASE_ID}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          d1Data = await d1Res.json();
        } catch (err) {
          const { execFileSync } = await import('child_process');
          const out = execFileSync('curl', ['-s', '-H', `Authorization: Bearer ${token}`, `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${D1_DATABASE_ID}`], {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
          });
          d1Data = JSON.parse(out);
        }

        if (d1Data.success) {
          pass('D1 Database Access', `Connected to ${d1Data.result?.name || 'sophia-raas-db'}`);
        } else {
          warn('D1 Database Access', `Cannot verify D1 database: ${JSON.stringify(d1Data.errors || [])}`);
          warnings++;
        }
      } catch (e) {
        warn('D1 Probe', `Network error querying D1 API: ${e.message}`);
        warnings++;
      }
    }
  }

  // 5. Summary & Instructions
  console.log('\n════════════════════════════════════════════════════════════════');
  if (errors === 0 && warnings === 0) {
    console.log('✨ ALL SYSTEMS READY: CI/CD pipeline infrastructure is 100% prepared! ✨');
  } else {
    console.log(`📋 CI/CD Readiness Summary: ${errors} error(s), ${warnings} warning(s)\n`);
    console.log('👉 GitHub Repository Secrets Configuration Instructions:');
    console.log('   Configure the required secrets in GitHub:');
    console.log('   https://github.com/minhlongs/sophia-ai-factory/settings/secrets/actions\n');
    console.log('   Required Repository Secrets:');
    console.log('   1. CLOUDFLARE_API_TOKEN');
    console.log('      Permissions required:');
    console.log('        - Account | Workers Scripts | Edit');
    console.log('        - Account | D1 | Edit');
    console.log('        - Account | Workers R2 Storage | Edit');
    console.log('        - Account | Workers KV Storage | Edit');
    console.log('        - Zone | Workers Routes | Edit\n');
    console.log('   2. CLOUDFLARE_ACCOUNT_ID');
    console.log('      The 32-character hex account ID from Cloudflare dashboard.\n');
    console.log('   Set via GitHub CLI (gh):');
    console.log('     gh secret set CLOUDFLARE_API_TOKEN --body "$CLOUDFLARE_API_TOKEN"');
    console.log('     gh secret set CLOUDFLARE_ACCOUNT_ID --body "$CLOUDFLARE_ACCOUNT_ID"');
  }
  console.log('════════════════════════════════════════════════════════════════\n');

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error during CI readiness check:', err);
  process.exit(1);
});
