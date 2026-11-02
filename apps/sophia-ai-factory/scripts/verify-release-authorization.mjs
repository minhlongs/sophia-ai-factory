#!/usr/bin/env node
/**
 * Release Authorization Guard (Supreme #02.1 P0.3, P5, T23)
 *
 * Prevents automated agent merges (`/ak-vibe --ship`, read-only audit runs) from silently
 * deploying production unless an explicit human release authorization token is present:
 *   1. `workflow_dispatch` input `authorize_production_release=true`, OR
 *   2. Commit message contains `[RELEASE-AUTHORIZED]`, OR
 *   3. Environment variable `SOPHIA_RELEASE_AUTHORIZED=1` is explicitly set.
 *
 * Also supports `--dry-run` / `DRY_RUN=true` so Stage 1 & Stage 2 build checks remain usable
 * without mutating production.
 */

/** @param {Record<string, string | undefined>} [env] */
export function evaluateReleaseAuthorization(env = process.env) {
  const dryRun = String(env.DRY_RUN ?? env.INPUT_DRY_RUN ?? '').toLowerCase() === 'true';
  if (dryRun) {
    return {
      authorized: true,
      mode: 'DRY_RUN_ONLY',
      reason: 'Dry-run mode skips production D1 migration and Cloudflare Edge deployment.',
    };
  }

  const readOnlyLock = String(env.SOPHIA_PRODUCTION_READ_ONLY ?? '').trim() === '1';
  if (readOnlyLock) {
    return {
      authorized: false,
      mode: 'BLOCKED_READ_ONLY_MISSION',
      reason: 'SOPHIA_PRODUCTION_READ_ONLY=1 is active; production deployment is strictly forbidden.',
    };
  }

  const dispatchAuthorized =
    String(env.AUTHORIZE_PRODUCTION_RELEASE ?? env.INPUT_AUTHORIZE_PRODUCTION_RELEASE ?? '').toLowerCase() === 'true';
  const envAuthorized = String(env.SOPHIA_RELEASE_AUTHORIZED ?? '').trim() === '1';
  const commitMessage = String(env.COMMIT_MESSAGE ?? '');
  const commitTagAuthorized = commitMessage.includes('[RELEASE-AUTHORIZED]');

  if (dispatchAuthorized || envAuthorized || commitTagAuthorized) {
    return {
      authorized: true,
      mode: dispatchAuthorized
        ? 'WORKFLOW_DISPATCH_APPROVED'
        : envAuthorized
          ? 'ENV_TOKEN_APPROVED'
          : 'COMMIT_TAG_APPROVED',
      reason: 'Explicit production release authorization verified.',
    };
  }

  return {
    authorized: false,
    mode: 'BLOCKED_UNAUTHORIZED_AUTO_DEPLOY',
    reason:
      'Production deployment blocked: missing explicit release authorization ([RELEASE-AUTHORIZED] in commit message, AUTHORIZE_PRODUCTION_RELEASE=true dispatch input, or SOPHIA_RELEASE_AUTHORIZED=1).',
  };
}

const isMainModule =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].endsWith('verify-release-authorization.mjs');

if (isMainModule) {
  const decision = evaluateReleaseAuthorization(process.env);
  process.stdout.write(`${JSON.stringify(decision)}\n`);
  if (!decision.authorized) {
    process.stderr.write(`❌ ${decision.reason}\n`);
    process.exit(1);
  }
}
