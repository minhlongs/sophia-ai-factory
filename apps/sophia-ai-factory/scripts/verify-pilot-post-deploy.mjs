#!/usr/bin/env node
/**
 * Pilot-Specific Post-Deploy Verification (G1.4).
 *
 * Verifies after `wrangler deploy --config wrangler.pilot.toml`:
 *   1. Active 100%-traffic Pilot Worker version has expected COMMIT_SHA,
 *      CF_WORKER_NAME, D1 binding (sophia-pilot-db), and Pilot safety feature flags.
 *   2. Cloudflare Access seal is intact (unauthenticated /api/health returns HTTP 302
 *      to cloudflareaccess.com — NEVER HTTP 200).
 *   3. Authenticated /api/health returns HTTP 200 when Access service token is configured,
 *      or emits explicit AUTHENTICATED_HEALTH_CHECK_UNCONFIGURED_ACCESS_SEAL_VERIFIED.
 *   4. Zero Production mutation: active Production Worker version_id matches prodVersionBefore.
 *   5. sophia-pilot-db schema compatibility re-verified via read-only D1 inspection.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_PILOT_D1_ID,
  EXPECTED_PILOT_D1_NAME,
  EXPECTED_PILOT_WORKER_NAME,
  EXPECTED_PROD_WORKER_NAME,
  fetchActiveWorkerDeployment,
  verifyRemotePilotD1Schema,
} from './verify-pilot-release-guards.mjs';

export const DEFAULT_PILOT_URL = 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev';

export const REQUIRED_PILOT_FEATURE_FLAGS = {
  CF_WORKER_NAME: EXPECTED_PILOT_WORKER_NAME,
  PAYMENTS_ENABLED: 'false',
  PILOT_FINANCING_MODE: 'CUSTOMER_BYOK',
  PILOT_INVITE_ONLY: 'true',
  SOPHIA_PILOT_MODE: 'true',
};

function getPlainTextBinding(bindings, name) {
  const found = bindings.find((b) => b && b.type === 'plain_text' && b.name === name);
  return found ? String(found.text ?? '').trim() : null;
}

function getD1Binding(bindings, name) {
  return bindings.find((b) => b && b.type === 'd1' && b.name === name) ?? null;
}

export async function verifyPilotPostDeploy({
  accountId,
  apiToken,
  expectedSha,
  prodVersionBefore,
  pilotUrl = DEFAULT_PILOT_URL,
  accessClientId = '',
  accessClientSecret = '',
  migrationsDir,
  workerName = EXPECTED_PILOT_WORKER_NAME,
  prodWorkerName = EXPECTED_PROD_WORKER_NAME,
  fetchFn = fetch,
}) {
  if (!accountId || !apiToken) {
    return {
      ok: false,
      code: 'MISSING_CLOUDFLARE_CREDENTIALS',
      detail: 'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.',
    };
  }
  if (!expectedSha || !/^[0-9a-fA-F]{40}$/.test(String(expectedSha).trim())) {
    return {
      ok: false,
      code: 'INVALID_EXPECTED_SHA',
      detail: 'expectedSha must be a 40-char hex commit SHA.',
    };
  }
  if (!prodVersionBefore || !String(prodVersionBefore).trim()) {
    return {
      ok: false,
      code: 'MISSING_PROD_VERSION_BEFORE',
      detail: 'prodVersionBefore snapshot is required to prove zero Production mutation.',
    };
  }

  // 1. Verify active 100%-traffic Pilot Worker version, COMMIT_SHA, D1 binding, and feature flags
  const pilotActive = await fetchActiveWorkerDeployment({
    accountId,
    apiToken,
    workerName,
    includeVersionDetails: true,
    fetchFn,
  });
  if (!pilotActive.ok) {
    return {
      ok: false,
      code: 'PILOT_ACTIVE_VERSION_CHECK_FAILED',
      detail: pilotActive.detail,
      upstreamCode: pilotActive.code,
    };
  }

  const bindings = pilotActive.bindings;
  const liveCommitSha = getPlainTextBinding(bindings, 'COMMIT_SHA');
  if (!liveCommitSha || liveCommitSha.toLowerCase() !== String(expectedSha).trim().toLowerCase()) {
    return {
      ok: false,
      code: 'PILOT_COMMIT_SHA_MISMATCH',
      detail: `Active Pilot COMMIT_SHA (${liveCommitSha ?? 'missing'}) does not match expectedSha (${expectedSha}).`,
      pilotVersionId: pilotActive.versionId,
      liveCommitSha,
      expectedSha,
    };
  }

  const dbBinding = getD1Binding(bindings, 'DB');
  const dbBindingId = String(dbBinding?.id ?? dbBinding?.database_id ?? '').trim();
  if (dbBindingId !== EXPECTED_PILOT_D1_ID) {
    return {
      ok: false,
      code: 'PILOT_D1_BINDING_MISMATCH',
      detail: `Active Pilot DB binding (${dbBindingId || 'missing'}) does not match ${EXPECTED_PILOT_D1_ID}.`,
      pilotVersionId: pilotActive.versionId,
    };
  }

  const flagMismatches = [];
  for (const [flagName, expectedValue] of Object.entries(REQUIRED_PILOT_FEATURE_FLAGS)) {
    const actual = getPlainTextBinding(bindings, flagName);
    if (actual !== expectedValue) {
      flagMismatches.push(`${flagName}=${actual ?? 'missing'} (expected ${expectedValue})`);
    }
  }
  if (flagMismatches.length > 0) {
    return {
      ok: false,
      code: 'PILOT_FEATURE_FLAG_MISMATCH',
      detail: `Active Pilot feature flag mismatch: ${flagMismatches.join(', ')}`,
      pilotVersionId: pilotActive.versionId,
      flagMismatches,
    };
  }

  // 2. Verify Cloudflare Access seal (unauthenticated /api/health MUST return 302 -> cloudflareaccess.com)
  const baseUrl = String(pilotUrl).replace(/\/+$/, '');
  const healthUrl = `${baseUrl}/api/health`;
  let unauthRes;
  try {
    unauthRes = await fetchFn(healthUrl, { method: 'GET', redirect: 'manual' });
  } catch (err) {
    return {
      ok: false,
      code: 'PILOT_ACCESS_SEAL_PROBE_FAILED',
      detail: `Failed to probe ${healthUrl}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const unauthStatus = Number(unauthRes?.status ?? 0);
  const locationHeader = String(unauthRes?.headers?.get?.('location') ?? '').trim();
  const pointsToAccess = /cloudflareaccess\.com/i.test(locationHeader);

  if (unauthStatus !== 302 || !pointsToAccess) {
    return {
      ok: false,
      code: unauthStatus === 200 ? 'PILOT_ACCESS_SEAL_BYPASSED' : 'PILOT_ACCESS_SEAL_INVALID',
      detail: `Unauthenticated GET ${healthUrl} returned HTTP ${unauthStatus} with location="${locationHeader}" (expected HTTP 302 -> cloudflareaccess.com).`,
      unauthStatus,
      locationHeader,
    };
  }

  // 3. Authenticated runtime health check (if service token configured)
  const hasServiceToken =
    Boolean(String(accessClientId ?? '').trim()) &&
    Boolean(String(accessClientSecret ?? '').trim());

  let authenticatedHealthStatus = 'AUTHENTICATED_HEALTH_CHECK_UNCONFIGURED_ACCESS_SEAL_VERIFIED';
  if (hasServiceToken) {
    let authRes;
    try {
      authRes = await fetchFn(healthUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'CF-Access-Client-Id': String(accessClientId).trim(),
          'CF-Access-Client-Secret': String(accessClientSecret).trim(),
        },
      });
    } catch (err) {
      return {
        ok: false,
        code: 'PILOT_AUTHENTICATED_HEALTH_FAILED',
        detail: `Authenticated health probe failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (Number(authRes?.status ?? 0) !== 200) {
      return {
        ok: false,
        code: 'PILOT_AUTHENTICATED_HEALTH_NON_200',
        detail: `Authenticated GET ${healthUrl} returned HTTP ${authRes?.status ?? 'unknown'} (expected 200).`,
      };
    }
    authenticatedHealthStatus = 'AUTHENTICATED_HEALTH_CHECK_PASSED';
  }

  // 4. Verify zero Production mutation
  const prodActive = await fetchActiveWorkerDeployment({
    accountId,
    apiToken,
    workerName: prodWorkerName,
    includeVersionDetails: false,
    fetchFn,
  });
  if (!prodActive.ok) {
    return {
      ok: false,
      code: 'PROD_VERSION_POST_CHECK_FAILED',
      detail: prodActive.detail,
      upstreamCode: prodActive.code,
    };
  }

  const prodVersionAfter = prodActive.versionId;
  if (prodVersionAfter !== String(prodVersionBefore).trim()) {
    return {
      ok: false,
      code: 'PRODUCTION_MUTATION_DETECTED',
      detail: `Production Worker version drifted during Pilot deploy: before=${prodVersionBefore}, after=${prodVersionAfter}.`,
      prodVersionBefore,
      prodVersionAfter,
    };
  }

  // 5. Re-verify sophia-pilot-db schema compatibility
  const d1Schema = await verifyRemotePilotD1Schema({
    accountId,
    apiToken,
    databaseId: EXPECTED_PILOT_D1_ID,
    databaseName: EXPECTED_PILOT_D1_NAME,
    migrationsDir,
    fetchFn,
  });
  if (!d1Schema.ok) {
    return {
      ok: false,
      code: 'PILOT_POST_DEPLOY_D1_SCHEMA_FAILED',
      detail: d1Schema.detail,
      d1Schema,
    };
  }

  return {
    ok: true,
    code: 'PILOT_POST_DEPLOY_VERIFIED',
    pilotVersionId: pilotActive.versionId,
    liveCommitSha,
    prodVersionBefore: String(prodVersionBefore).trim(),
    prodVersionAfter,
    productionUnchanged: true,
    accessSealVerified: true,
    authenticatedHealthStatus,
    d1Schema,
  };
}

async function main() {
  const cwd = process.cwd();
  const result = await verifyPilotPostDeploy({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    apiToken: process.env.CLOUDFLARE_API_TOKEN ?? '',
    expectedSha: process.env.GITHUB_SHA ?? '',
    prodVersionBefore: process.env.PROD_VERSION_BEFORE ?? '',
    pilotUrl: process.env.PILOT_VERIFY_URL || DEFAULT_PILOT_URL,
    accessClientId: process.env.PILOT_CF_ACCESS_CLIENT_ID ?? '',
    accessClientSecret: process.env.PILOT_CF_ACCESS_CLIENT_SECRET ?? '',
    migrationsDir: resolve(cwd, 'migrations'),
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.ok) {
    process.stderr.write(`❌ PILOT POST-DEPLOY VERIFICATION FAILED [${result.code}]: ${result.detail}\n`);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    process.stderr.write(
      `❌ PILOT POST-DEPLOY VERIFICATION UNHANDLED ERROR: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
