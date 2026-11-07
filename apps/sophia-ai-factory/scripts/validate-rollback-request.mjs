#!/usr/bin/env node
/**
 * Rollback Request Validator
 *
 * Rollback inputs arrive from a workflow_dispatch form or an external alert
 * webhook. Both are attacker-reachable text, and the rollback job interpolates
 * them into a shell command that mutates the production Worker. This module
 * therefore decides, from the raw inputs alone, whether a rollback request is
 * safe to execute — before any shell, wrangler, or HTTP call happens.
 *
 * The severe failure this prevents: a reason string containing `$(...)`, a
 * backtick, `"`, `$`, or a newline would execute as part of the rollback
 * command line inside a job that holds the Cloudflare API token. Rejecting the
 * request is cheap; executing it is not reversible.
 *
 * The module is pure: no network, no filesystem, no subprocess. It exports
 * `validateRollbackRequest` so the decision is fully testable, and the CLI
 * entry prints the decision as JSON and exits non-zero on any rejected request.
 */

/**
 * @typedef {Object} RollbackRequest
 * @property {string} reason      free text describing why the rollback is happening
 * @property {string} alertId     identifier of the alert that requested it
 * @property {string} target      Worker name the rollback would apply to
 * @property {string} environment environment the rollback would apply to
 * @property {string} dryRun      'true' means build and verify, do not mutate
 */

/** The only Worker this repository is allowed to roll back. */
export const ROLLBACK_TARGET = 'sophia-ai-factory';

/** The only environment a production rollback may target. */
export const ROLLBACK_ENVIRONMENT = 'production';

export const MAX_REASON_LENGTH = 200;
export const MAX_ALERT_ID_LENGTH = 64;

/**
 * A safe reason character is printable ASCII minus everything the shell or a
 * URL query string would interpret. Newlines, backticks, `$`, quotes, `\`,
 * `&`, `|`, `;`, `<`, `>`, `(`, `)`, and control characters are all excluded.
 */
const SAFE_TEXT = /^[A-Za-z0-9 ,.:/_@#%+=?\[\]-]*$/;

/** An alert id is the narrow kind: alphanumerics, dash, underscore, dot. */
const SAFE_ALERT_ID = /^[A-Za-z0-9._-]*$/;

function read(value) {
  return String(value ?? '').trim();
}

function readBoolean(value) {
  return read(value).toLowerCase() === 'true';
}

/**
 * @param {Partial<RollbackRequest>} [request]
 * @returns {{ ok: boolean, decision: string, reason: string, sanitized: RollbackRequest }}
 */
export function validateRollbackRequest(request = {}) {
  const reason = read(request.reason);
  const alertId = read(request.alertId);
  const target = read(request.target);
  const environment = read(request.environment);
  const dryRun = readBoolean(request.dryRun);

  // Defaults are a reporting fallback for the caller's log line only. They are
  // applied to the sanitized copy after validation has already run against the
  // values the caller actually supplied, so they can never turn a rejected
  // request into an authorized one.
  const sanitized = {
    reason: reason === '' ? 'manual' : reason,
    alertId,
    target: target === '' ? ROLLBACK_TARGET : target,
    environment: environment === '' ? ROLLBACK_ENVIRONMENT : environment,
    dryRun: String(dryRun),
  };

  const reject = (decision, why) => ({ ok: false, decision, reason: why, sanitized });

  if (reason.length > MAX_REASON_LENGTH) {
    return reject(
      'REJECTED_REASON_TOO_LONG',
      `Rollback reason is ${reason.length} characters; the maximum is ${MAX_REASON_LENGTH}.`
    );
  }

  if (!SAFE_TEXT.test(reason)) {
    return reject(
      'REJECTED_REASON_UNSAFE_CHARACTERS',
      'Rollback reason contains characters the shell or a URL query string would interpret, so it cannot be passed through a command line.'
    );
  }

  if (alertId.length > MAX_ALERT_ID_LENGTH) {
    return reject(
      'REJECTED_ALERT_ID_TOO_LONG',
      `Alert id is ${alertId.length} characters; the maximum is ${MAX_ALERT_ID_LENGTH}.`
    );
  }

  if (!SAFE_ALERT_ID.test(alertId)) {
    return reject(
      'REJECTED_ALERT_ID_UNSAFE_CHARACTERS',
      'Alert id must contain only letters, digits, dot, dash, and underscore.'
    );
  }

  // A missing target or environment is a rejected request, not an invitation to
  // assume the production values. The caller must state what it intends to roll
  // back, and what it stated must match this repository's own Worker and
  // environment.
  if (target === '') {
    return reject(
      'REJECTED_TARGET_MISSING',
      'Rollback request did not state a target Worker. Refusing to assume the production Worker.'
    );
  }

  if (target !== ROLLBACK_TARGET) {
    return reject(
      'REJECTED_TARGET_MISMATCH',
      `Rollback target must be '${ROLLBACK_TARGET}', not '${target}'. A rollback can only ever move this repository's own Worker.`
    );
  }

  if (environment === '') {
    return reject(
      'REJECTED_ENVIRONMENT_MISSING',
      'Rollback request did not state an environment. Refusing to assume production.'
    );
  }

  if (environment !== ROLLBACK_ENVIRONMENT) {
    return reject(
      'REJECTED_ENVIRONMENT_MISMATCH',
      `Rollback environment must be '${ROLLBACK_ENVIRONMENT}', not '${environment}'.`
    );
  }

  if (dryRun) {
    return {
      ok: true,
      decision: 'DRY_RUN_ONLY',
      reason: 'Dry-run mode builds and verifies without mutating the production Worker.',
      sanitized,
    };
  }

  return {
    ok: true,
    decision: 'AUTHORIZED',
    reason: `Rollback request validated for target '${sanitized.target}' in environment '${sanitized.environment}'.`,
    sanitized,
  };
}

const isMainModule =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].endsWith('validate-rollback-request.mjs');

if (isMainModule) {
  const decision = validateRollbackRequest({
    reason: process.env.ROLLBACK_REASON,
    alertId: process.env.ROLLBACK_ALERT_ID,
    target: process.env.ROLLBACK_TARGET,
    environment: process.env.ROLLBACK_ENVIRONMENT,
    dryRun: process.env.ROLLBACK_DRY_RUN,
  });
  process.stdout.write(`${JSON.stringify(decision)}\n`);
  if (!decision.ok) {
    process.stderr.write(`❌ ${decision.reason}\n`);
    process.exit(1);
  }
}
