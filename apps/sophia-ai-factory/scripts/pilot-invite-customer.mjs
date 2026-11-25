#!/usr/bin/env node
/**
 * Operator Customer Invitation Provisioner (Section IX).
 *
 * Validates one invited customer email, merges it with preserved operator emails
 * (`DEFAULT_PILOT_OPERATOR_EMAILS` / `PILOT_OPERATOR_EMAILS`), rejects wildcards,
 * Everyone, Bypass, and non-email selectors, and updates BOTH:
 *   1. Cloudflare Access App `11a89148-d86e-4d3e-a1d4-e12edbeb6f75`
 *      Policy `5ad49a50-b19a-4cc9-a43d-d2455e92fa42` (1-click GitHub OAuth + OTP)
 *   2. Pilot Worker secret `PILOT_ALLOWED_EMAILS` (`wrangler.pilot.toml`)
 *
 * Usage:
 *   node scripts/pilot-invite-customer.mjs <exact-email> [--dry-run]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertAccessPoliciesSafeAndExact,
  buildAccessSingleEmailPolicyPayload,
  buildCustomerUrlsAndVietnameseInvite,
  parseInviteCliArgs,
  PILOT_ACCESS_APP_ID,
  PILOT_ACCESS_POLICY_ID,
  PILOT_CF_ACCOUNT_ID,
  resolveAuthorizedPilotEmails,
} from './pilot-invite-policy.mjs';

export * from './pilot-invite-policy.mjs';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_TRANSIENT_RETRIES = 2;

function resolveAccessToken() {
  if (process.env.CLOUDFLARE_ACCESS_TOKEN?.trim()) {
    return process.env.CLOUDFLARE_ACCESS_TOKEN.trim();
  }
  const tokenPath = join(homedir(), '.config', 'sophia-pilot-cf-token');
  if (existsSync(tokenPath)) {
    const val = readFileSync(tokenPath, 'utf8').trim();
    if (val) return val;
  }
  throw new Error('Missing Cloudflare Access token (set CLOUDFLARE_ACCESS_TOKEN or ~/.config/sophia-pilot-cf-token).');
}

function buildWranglerEnv() {
  return {
    ...process.env,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_WORKER_API_TOKEN ?? '',
  };
}

function listWorkerSecrets() {
  const listRaw = execFileSync(
    'npx',
    ['wrangler', 'secret', 'list', '--config', 'wrangler.pilot.toml', '--format', 'json'],
    { cwd: APP_ROOT, encoding: 'utf8', env: buildWranglerEnv(), stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  const lineBracket = listRaw.search(/(?:^|\n)\s*\[/);
  const jsonSlice = listRaw.startsWith('[')
    ? listRaw
    : lineBracket >= 0
      ? listRaw.slice(lineBracket).trim()
      : listRaw;
  const parsed = JSON.parse(jsonSlice);
  if (!Array.isArray(parsed)) throw new Error('Unexpected Wrangler secret list payload.');
  return parsed;
}

function putWorkerAllowlistSecret(authorizedEmails) {
  const secretValue = authorizedEmails.join(',');
  execFileSync(
    'npx',
    ['wrangler', 'secret', 'put', 'PILOT_ALLOWED_EMAILS', '--config', 'wrangler.pilot.toml'],
    {
      cwd: APP_ROOT,
      input: `${secretValue}\n`,
      encoding: 'utf8',
      env: buildWranglerEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
}

async function cfAccessRequest(token, method, path, body) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${PILOT_CF_ACCOUNT_ID}/access/apps/${PILOT_ACCESS_APP_ID}${path}`;
  let lastErr = null;

  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt += 1) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    }
    let res;
    let rawText = '';
    try {
      res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      rawText = await res.text();
    } catch (netErr) {
      lastErr = netErr instanceof Error ? netErr : new Error(String(netErr));
      continue;
    }

    let json = null;
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch {
      json = null;
    }
    if (res.ok && json?.success) {
      return json.result;
    }
    const codes = Array.isArray(json?.errors)
      ? json.errors.map((e) => e?.code).filter(Boolean).join(',')
      : '';
    const suffix = codes ? ` [codes:${codes}]` : '';
    lastErr = new Error(`Cloudflare Access ${method} ${path} failed (HTTP ${res.status}${suffix}).`);
    if (res.status !== 429 && res.status < 500) {
      throw lastErr;
    }
  }
  throw lastErr ?? new Error(`Cloudflare Access ${method} ${path} failed.`);
}

async function main(argv) {
  const { dryRun, email } = parseInviteCliArgs(argv);
  const authorizedEmails = resolveAuthorizedPilotEmails(email);
  const payload = buildAccessSingleEmailPolicyPayload(email);
  const bundle = buildCustomerUrlsAndVietnameseInvite(email);

  if (dryRun) {
    process.stdout.write(
      `${JSON.stringify({ mode: 'dry-run', email, authorizedEmails, accessPolicyPayload: payload, ...bundle }, null, 2)}\n`,
    );
    return;
  }

  const token = resolveAccessToken();
  const appMeta = await cfAccessRequest(token, 'GET', '');
  if (appMeta?.auto_redirect_to_identity === true || !Array.isArray(appMeta?.allowed_idps) || appMeta.allowed_idps.length < 2) {
    throw new Error('Cloudflare Access App must keep GitHub + OTP allowed_idps configured with auto_redirect_to_identity=false.');
  }
  listWorkerSecrets();
  const policiesBefore = await cfAccessRequest(token, 'GET', '/policies');
  const previousTarget = Array.isArray(policiesBefore) && policiesBefore.length === 1
    ? policiesBefore.find((p) => p?.id === PILOT_ACCESS_POLICY_ID)
    : null;
  if (!previousTarget) {
    throw new Error(`Expected single pre-existing Access policy ${PILOT_ACCESS_POLICY_ID}.`);
  }

  let workerSecretMutated = false;
  await cfAccessRequest(token, 'PUT', `/policies/${PILOT_ACCESS_POLICY_ID}`, payload);
  try {
    const policiesAfter = await cfAccessRequest(token, 'GET', '/policies');
    assertAccessPoliciesSafeAndExact(policiesAfter, authorizedEmails);
    putWorkerAllowlistSecret(authorizedEmails);
    workerSecretMutated = true;
    const secrets = listWorkerSecrets();
    if (!secrets.some((s) => s?.name === 'PILOT_ALLOWED_EMAILS')) {
      throw new Error('Worker secret readback failed: PILOT_ALLOWED_EMAILS not found on sophia-ai-factory-pilot.');
    }
  } catch (err) {
    if (!workerSecretMutated) {
      const rollbackPayload = {
        name: previousTarget.name ?? 'Sophia Pilot Authorized Emails',
        decision: previousTarget.decision ?? 'allow',
        include: previousTarget.include ?? [],
        exclude: previousTarget.exclude ?? [],
        require: previousTarget.require ?? [],
        precedence: previousTarget.precedence ?? 1,
      };
      await cfAccessRequest(token, 'PUT', `/policies/${PILOT_ACCESS_POLICY_ID}`, rollbackPayload).catch((rbErr) => {
        process.stderr.write(`[pilot-invite-customer] WARN: Access rollback failed (${rbErr instanceof Error ? rbErr.message : String(rbErr)}).\n`);
      });
    }
    throw err;
  }

  process.stdout.write(
    `${JSON.stringify({ ok: true, email, authorizedEmails, accessVerified: true, workerSecretVerified: true, ...bundle }, null, 2)}\n`,
  );
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]))) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`[pilot-invite-customer] ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
