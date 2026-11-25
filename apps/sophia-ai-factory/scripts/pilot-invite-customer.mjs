#!/usr/bin/env node
/**
 * Operator Customer Invitation & Scoped Shortlink Bypass Provisioner.
 *
 * Modes:
 *   1. `node scripts/pilot-invite-customer.mjs <exact-email> [--dry-run]`
 *      Reads live operator emails on Policy `5ad49a50-b19a-4cc9-a43d-d2455e92fa42`
 *      so operator/GitHub SSO emails are never accidentally overwritten, adds the
 *      single invited customer email, updates Worker secret `PILOT_ALLOWED_EMAILS`,
 *      and ensures + probes the scoped `/api/r/*` public redirect bypass.
 *   2. `node scripts/pilot-invite-customer.mjs --ensure-shortlink-bypass [--dry-run]`
 *      Ensures ONLY the scoped `/api/r/*` Cloudflare Access subpath bypass app exists
 *      and probes live HTTP edge behavior without modifying the invited email list.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertAccessPoliciesSafeAndExact,
  assertShortlinkBypassPoliciesExact,
  buildAccessSingleEmailPolicyPayload,
  buildCustomerUrlsAndVietnameseInvite,
  buildShortlinkSubpathBypassAppPayload,
  buildShortlinkSubpathBypassPolicyPayload,
  DEFAULT_PILOT_OPERATOR_EMAILS,
  extractExistingOperatorEmails,
  PILOT_ACCESS_APP_ID,
  PILOT_ACCESS_POLICY_ID,
  PILOT_BASE_URL,
  PILOT_CF_ACCOUNT_ID,
  PILOT_SHORTLINK_BYPASS_DOMAIN,
  resolveAuthorizedPilotEmails,
  validateSinglePilotEmail,
} from './pilot-invite-policy.mjs';

export {
  assertAccessPoliciesSafeAndExact,
  assertShortlinkBypassPoliciesExact,
  buildAccessSingleEmailPolicyPayload,
  buildCustomerUrlsAndVietnameseInvite,
  buildShortlinkSubpathBypassAppPayload,
  buildShortlinkSubpathBypassPolicyPayload,
  DEFAULT_PILOT_OPERATOR_EMAILS,
  extractExistingOperatorEmails,
  PILOT_ACCESS_APP_ID,
  PILOT_ACCESS_POLICY_ID,
  PILOT_BASE_URL,
  PILOT_CF_ACCOUNT_ID,
  PILOT_SHORTLINK_BYPASS_DOMAIN,
  resolveAuthorizedPilotEmails,
  validateSinglePilotEmail,
};

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_TIMEOUT_MS = 15_000;

export function resolveAccessToken() {
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

async function cfAccountAccessApi(token, method, subPath, body) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${PILOT_CF_ACCOUNT_ID}/access${subPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(`Cloudflare Access ${method} ${subPath} failed (HTTP ${res.status}).`);
  }
  return json.result;
}

export async function verifyLiveShortlinkBypassPerimeter(fetchImpl = fetch, maxAttempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) {
      await new Promise((r) => setTimeout(r, 2500));
    }
    try {
      const shortlinkProbe = await fetchImpl(`${PILOT_BASE_URL}/api/r/abcdefghij`, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const shortlinkLocation = shortlinkProbe.headers.get('location') ?? '';
      if (shortlinkLocation.includes('cloudflareaccess.com')) {
        throw new Error(
          `Public shortlink probe was intercepted by Cloudflare Access (${shortlinkProbe.status} -> ${shortlinkLocation}).`,
        );
      }

      const protectedProbe = await fetchImpl(`${PILOT_BASE_URL}/vi/dashboard/first-value`, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const protectedLocation = protectedProbe.headers.get('location') ?? '';
      if (protectedProbe.status !== 302 || !protectedLocation.includes('cloudflareaccess.com')) {
        throw new Error(
          `Protected pilot workspace did not enforce Cloudflare Access redirect (got HTTP ${protectedProbe.status}).`,
        );
      }

      return {
        shortlinkPublicHttpStatus: shortlinkProbe.status,
        protectedWorkspaceAccessRedirectVerified: true,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('Failed to verify live shortlink bypass perimeter');
}

export async function ensureShortlinkBypassApp(token) {
  const apps = await cfAccountAccessApi(token, 'GET', '/apps');
  const appPayload = buildShortlinkSubpathBypassAppPayload();
  let bypassApp = Array.isArray(apps)
    ? apps.find((a) => String(a?.domain ?? '').toLowerCase() === PILOT_SHORTLINK_BYPASS_DOMAIN)
    : null;

  if (!bypassApp) {
    bypassApp = await cfAccountAccessApi(token, 'POST', '/apps', appPayload);
  } else {
    bypassApp = await cfAccountAccessApi(token, 'PUT', `/apps/${bypassApp.id}`, appPayload);
  }

  const existingPolicies = await cfAccountAccessApi(token, 'GET', `/apps/${bypassApp.id}/policies`);
  const policyPayload = buildShortlinkSubpathBypassPolicyPayload();
  if (Array.isArray(existingPolicies) && existingPolicies.length > 0) {
    await cfAccountAccessApi(
      token,
      'PUT',
      `/apps/${bypassApp.id}/policies/${existingPolicies[0].id}`,
      policyPayload,
    );
    for (const extra of existingPolicies.slice(1)) {
      await cfAccountAccessApi(token, 'DELETE', `/apps/${bypassApp.id}/policies/${extra.id}`);
    }
  } else {
    await cfAccountAccessApi(token, 'POST', `/apps/${bypassApp.id}/policies`, policyPayload);
  }

  const bypassPoliciesAfter = await cfAccountAccessApi(token, 'GET', `/apps/${bypassApp.id}/policies`);
  assertShortlinkBypassPoliciesExact(bypassPoliciesAfter);

  const rootPolicies = await cfAccountAccessApi(token, 'GET', `/apps/${PILOT_ACCESS_APP_ID}/policies`);
  for (const pol of rootPolicies ?? []) {
    if (pol.decision === 'bypass' || pol.decision === 'non_identity') {
      throw new Error(`Safety violation: root Pilot Access app carries forbidden decision "${pol.decision}".`);
    }
  }

  return {
    bypassAppId: bypassApp.id,
    domain: bypassApp.domain,
  };
}

function updateAndVerifyWorkerAllowlistSecret(authorizedEmails) {
  const secretValue = Array.isArray(authorizedEmails)
    ? authorizedEmails.join(',')
    : String(authorizedEmails);
  const env = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_WORKER_API_TOKEN ?? '',
  };
  execFileSync(
    'npx',
    ['wrangler', 'secret', 'put', 'PILOT_ALLOWED_EMAILS', '--config', 'wrangler.pilot.toml'],
    {
      cwd: APP_ROOT,
      input: `${secretValue}\n`,
      encoding: 'utf8',
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const listRaw = execFileSync(
    'npx',
    ['wrangler', 'secret', 'list', '--config', 'wrangler.pilot.toml', '--format', 'json'],
    { cwd: APP_ROOT, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const secrets = JSON.parse(listRaw);
  if (!Array.isArray(secrets) || !secrets.some((s) => s?.name === 'PILOT_ALLOWED_EMAILS')) {
    throw new Error('Worker secret readback failed: PILOT_ALLOWED_EMAILS not found on sophia-ai-factory-pilot.');
  }
}

async function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const onlyBypass = argv.includes('--ensure-shortlink-bypass');

  if (onlyBypass) {
    if (dryRun) {
      process.stdout.write(
        `${JSON.stringify(
          {
            mode: 'dry-run',
            shortlinkBypassApp: buildShortlinkSubpathBypassAppPayload(),
            shortlinkBypassPolicy: buildShortlinkSubpathBypassPolicyPayload(),
          },
          null,
          2,
        )}\n`,
      );
      return;
    }
    const token = resolveAccessToken();
    const bypass = await ensureShortlinkBypassApp(token);
    const perimeter = await verifyLiveShortlinkBypassPerimeter();
    process.stdout.write(
      `${JSON.stringify({ ok: true, shortlinkBypass: bypass, perimeter }, null, 2)}\n`,
    );
    return;
  }

  const emailArg = argv.find((a) => !a.startsWith('--'));
  const email = validateSinglePilotEmail(emailArg);
  const bundle = buildCustomerUrlsAndVietnameseInvite(email);

  if (dryRun) {
    const authorizedEmails = resolveAuthorizedPilotEmails(email);
    const payload = buildAccessSingleEmailPolicyPayload(email, {
      operatorEmails: authorizedEmails.filter((item) => item !== email),
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'dry-run',
          email,
          authorizedEmails,
          accessPolicyPayload: payload,
          shortlinkBypassDomain: PILOT_SHORTLINK_BYPASS_DOMAIN,
          ...bundle,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  const token = resolveAccessToken();
  const policiesBefore = await cfAccountAccessApi(
    token,
    'GET',
    `/apps/${PILOT_ACCESS_APP_ID}/policies`,
  );
  const preservedOperators =
    process.env.PILOT_OPERATOR_EMAILS !== undefined
      ? undefined
      : extractExistingOperatorEmails(policiesBefore);
  const authorizedEmails = resolveAuthorizedPilotEmails(email, preservedOperators);
  const payload = buildAccessSingleEmailPolicyPayload(email, {
    operatorEmails: authorizedEmails.filter((item) => item !== email),
  });

  await cfAccountAccessApi(
    token,
    'PUT',
    `/apps/${PILOT_ACCESS_APP_ID}/policies/${PILOT_ACCESS_POLICY_ID}`,
    payload,
  );
  const policiesAfter = await cfAccountAccessApi(
    token,
    'GET',
    `/apps/${PILOT_ACCESS_APP_ID}/policies`,
  );
  assertAccessPoliciesSafeAndExact(policiesAfter, authorizedEmails);
  updateAndVerifyWorkerAllowlistSecret(authorizedEmails);
  const shortlinkBypass = await ensureShortlinkBypassApp(token);
  const perimeter = await verifyLiveShortlinkBypassPerimeter();

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        email,
        authorizedEmails,
        accessVerified: true,
        workerSecretVerified: true,
        shortlinkBypass,
        perimeter,
        ...bundle,
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`[pilot-invite-customer] ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
