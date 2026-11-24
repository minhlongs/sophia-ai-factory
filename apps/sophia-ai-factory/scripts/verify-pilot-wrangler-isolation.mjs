#!/usr/bin/env node
/**
 * Automated Cloudflare isolation verification for `wrangler.pilot.toml`.
 *
 * Ensures the pilot Worker config:
 * 1. Uses isolated Worker name `sophia-ai-factory-pilot` (not production).
 * 2. Keeps `workers_dev = true` (bound to Cloudflare Access App 11a89148-d86e-4d3e-a1d4-e12edbeb6f75)
 *    and disables `preview_urls = false` so preview URLs cannot bypass Access.
 * 3. Contains ZERO production D1 IDs, R2 buckets, KV namespace IDs, WAE datasets,
 *    worker service bindings, or production hostnames.
 * 4. Contains ZERO cron triggers, queue bindings, or Durable Objects.
 * 5. Enforces strict invite-only mode, single-mode financing (`CUSTOMER_BYOK` or
 *    `FOUNDER_SPONSORED`), fail-closed cost & quota controls, and disabled payments/publishing.
 * 6. With `--require-resolved-ids`, fails if any `REPLACE_WITH_*` placeholder remains.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '..');
const prodPath = path.join(appDir, 'wrangler.toml');
const pilotPath = path.join(appDir, 'wrangler.pilot.toml');

const requireResolvedIds = process.argv.includes('--require-resolved-ids');
const checkBuild = process.argv.includes('--check-build');

function stripComments(toml) {
  return toml
    .split('\n')
    .map((line) => line.replace(/#.*$/, ''))
    .join('\n');
}

function extractMatches(text, regex) {
  const results = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) results.add(match[1].trim());
  }
  return Array.from(results);
}

const prodRaw = fs.readFileSync(prodPath, 'utf8');
const pilotRaw = fs.readFileSync(pilotPath, 'utf8');

const prodActive = stripComments(prodRaw);
const pilotActive = stripComments(pilotRaw);

const errors = [];

// 1. Worker identity & preview URL lockdown
const pilotName = extractMatches(pilotActive, /^\s*name\s*=\s*"([^"]+)"/gm)[0];
if (pilotName !== 'sophia-ai-factory-pilot') {
  errors.push(`Expected pilot worker name "sophia-ai-factory-pilot", got "${pilotName ?? 'missing'}"`);
}
if (!/^\s*workers_dev\s*=\s*true\b/m.test(pilotActive)) {
  errors.push(
    'Missing required `workers_dev = true` in wrangler.pilot.toml (required for Cloudflare Access-protected sophia-ai-factory-pilot.agencyos-openclaw.workers.dev)',
  );
}
if (!/^\s*preview_urls\s*=\s*false\b/m.test(pilotActive)) {
  errors.push('Missing required `preview_urls = false` in wrangler.pilot.toml (prevents public preview URL Access bypass)');
}

// 2. Zero production D1 IDs, D1 names, R2 buckets, KV IDs, WAE datasets, or worker service bindings
const prodD1Ids = extractMatches(prodActive, /database_id\s*=\s*"([^"]+)"/g);
const prodD1Names = extractMatches(prodActive, /database_name\s*=\s*"([^"]+)"/g);
const prodR2Buckets = extractMatches(prodActive, /bucket_name\s*=\s*"([^"]+)"/g);
const prodKvIds = extractMatches(prodActive, /\bid\s*=\s*"([0-9a-f]{32})"/gi);
const prodWaeDatasets = extractMatches(prodActive, /\bdataset\s*=\s*"([^"]+)"/g);
const prodWorkerName = extractMatches(prodActive, /^\s*name\s*=\s*"([^"]+)"/gm)[0];
const pilotServices = extractMatches(pilotActive, /\bservice\s*=\s*"([^"]+)"/g);

for (const id of prodD1Ids) {
  if (pilotActive.includes(id)) {
    errors.push(`Production D1 database_id "${id}" found active in wrangler.pilot.toml`);
  }
}
for (const name of prodD1Names) {
  if (pilotActive.includes(`"${name}"`)) {
    errors.push(`Production D1 database_name "${name}" found active in wrangler.pilot.toml`);
  }
}
for (const bucket of prodR2Buckets) {
  if (pilotActive.includes(`"${bucket}"`)) {
    errors.push(`Production R2 bucket_name "${bucket}" found active in wrangler.pilot.toml`);
  }
}
for (const kvId of prodKvIds) {
  if (pilotActive.includes(kvId)) {
    errors.push(`Production KV namespace id "${kvId}" found active in wrangler.pilot.toml`);
  }
}
for (const dataset of prodWaeDatasets) {
  if (pilotActive.includes(`"${dataset}"`)) {
    errors.push(`Production WAE dataset "${dataset}" found active in wrangler.pilot.toml`);
  }
}
if (prodWorkerName && pilotServices.includes(prodWorkerName)) {
  errors.push(`Production Worker service binding "${prodWorkerName}" found active in wrangler.pilot.toml`);
}

// 3. Exact production hostname check
const urlVars = ['APP_URL', 'BETTER_AUTH_URL', 'NEXT_PUBLIC_APP_URL', 'WORKER_TECHNICAL_URL'];
for (const key of urlVars) {
  const m = pilotActive.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, 'm'));
  if (!m) {
    errors.push(`Missing required URL variable ${key} in wrangler.pilot.toml`);
    continue;
  }
  const rawUrl = m[1];
  if (!rawUrl.includes('REPLACE_WITH_')) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.hostname.toLowerCase() === 'sophia.agencyos.network') {
        errors.push(`${key} points to production hostname "sophia.agencyos.network"`);
      }
    } catch {
      errors.push(`${key} is not a valid URL: "${rawUrl}"`);
    }
  }
}

const allowedHostsMatch = pilotActive.match(/^\s*ALLOWED_HOSTS\s*=\s*"([^"]+)"/m);
if (!allowedHostsMatch) {
  errors.push('Missing required ALLOWED_HOSTS variable in wrangler.pilot.toml');
} else if (
  allowedHostsMatch[1]
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .includes('sophia.agencyos.network')
) {
  errors.push('ALLOWED_HOSTS contains production hostname "sophia.agencyos.network"');
}

// 4. Zero crons, queues, or Durable Objects
for (const forbiddenSection of ['[triggers]', '[[queues', '[[durable_objects']) {
  if (pilotActive.includes(forbiddenSection)) {
    errors.push(`Forbidden section "${forbiddenSection}" present in wrangler.pilot.toml`);
  }
}

// 5. Required pilot safety vars & financing-mode consistency
const requiredVars = {
  SOPHIA_PILOT_MODE: 'true',
  PILOT_INVITE_ONLY: 'true',
  PILOT_MAX_GENERATIONS: '20',
  PILOT_MAX_ESTIMATED_SPEND_USD: '4.00',
  PILOT_ESTIMATED_COST_PER_ATTEMPT_USD: '0.02',
  PILOT_MODEL_ID: 'openai/gpt-4o-mini',
  PILOT_MAX_OUTPUT_TOKENS: '2048',
  PILOT_MAX_RETRIES: '1',
  PAYMENTS_ENABLED: 'false',
  B2_PUBLISH_ENABLED: 'false',
  FEATURE_PAYOS: 'false',
  NEXT_PUBLIC_DISTRIBUTE_ENABLED: '0',
};
for (const [key, expected] of Object.entries(requiredVars)) {
  const m = pilotActive.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, 'm'));
  if (!m || m[1] !== expected) {
    errors.push(`Expected ${key} = "${expected}" in wrangler.pilot.toml, got "${m?.[1] ?? 'missing'}"`);
  }
}

const financingMatch = pilotActive.match(/^\s*PILOT_FINANCING_MODE\s*=\s*"([^"]+)"/m);
const byokMatch = pilotActive.match(/^\s*BYOK_ENABLED\s*=\s*"([^"]+)"/m);
const financingMode = financingMatch?.[1] ?? '';
const byokEnabled = byokMatch?.[1] ?? '';
if (financingMode === 'CUSTOMER_BYOK') {
  if (byokEnabled !== '1') {
    errors.push(`Expected BYOK_ENABLED = "1" when PILOT_FINANCING_MODE = "CUSTOMER_BYOK", got "${byokEnabled || 'missing'}"`);
  }
} else if (financingMode === 'FOUNDER_SPONSORED') {
  if (byokEnabled !== '0') {
    errors.push(`Expected BYOK_ENABLED = "0" when PILOT_FINANCING_MODE = "FOUNDER_SPONSORED", got "${byokEnabled || 'missing'}"`);
  }
} else {
  errors.push(
    `Expected PILOT_FINANCING_MODE to be "CUSTOMER_BYOK" or "FOUNDER_SPONSORED", got "${financingMode || 'missing'}"`,
  );
}

// 6. Optional pre-deploy check: no unresolved placeholders
if (requireResolvedIds && pilotActive.includes('REPLACE_WITH_')) {
  errors.push('Unresolved REPLACE_WITH_* placeholder found in wrangler.pilot.toml (--require-resolved-ids)');
}

// 7. Guard against stale .wrangler/deploy/config.json redirection to production wrangler.toml
const wranglerRedirectPath = path.join(appDir, '.wrangler', 'deploy', 'config.json');
if (fs.existsSync(wranglerRedirectPath)) {
  try {
    const redirectJson = JSON.parse(fs.readFileSync(wranglerRedirectPath, 'utf8'));
    const configPath = String(redirectJson?.configPath ?? '');
    if (!configPath.endsWith('wrangler.pilot.toml')) {
      errors.push(
        `.wrangler/deploy/config.json redirects to "${configPath || 'unknown'}" instead of wrangler.pilot.toml`,
      );
    }
  } catch (err) {
    errors.push(`Failed to parse .wrangler/deploy/config.json: ${String(err)}`);
  }
}

// 8. Optional post-build check: verify generated OpenNext worker has no production scheduled() cron handler
if (checkBuild) {
  const builtWorkerPath = path.join(appDir, '.open-next', 'worker.js');
  if (!fs.existsSync(builtWorkerPath)) {
    errors.push('Missing .open-next/worker.js (--check-build requires a completed pilot OpenNext build)');
  } else {
    const workerSource = fs.readFileSync(builtWorkerPath, 'utf8');
    if (/\basync\s+scheduled\s*\(/.test(workerSource) || /\bscheduled\s*:\s*async\b/.test(workerSource)) {
      errors.push(
        'Generated .open-next/worker.js contains a production scheduled() cron handler; use `npm run pilot:build` instead of `npm run deploy:build`',
      );
    }
  }
}

if (errors.length > 0) {
  console.error('Pilot Wrangler isolation check FAILED:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(
  `Pilot Wrangler isolation check PASSED (worker=${pilotName}, financing=${financingMode}, workers_dev=true, preview_urls=false, requireResolvedIds=${requireResolvedIds}, checkBuild=${checkBuild})`,
);
