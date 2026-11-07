#!/usr/bin/env node
/**
 * Release Authorization Guard
 *
 * Production mutation is authorized ONLY by GitHub's Environment approval mechanism,
 * verified against the live configuration of the `production` environment. The three
 * previously accepted sources — `[RELEASE-AUTHORIZED]` in the commit message, the
 * `authorize_production_release` dispatch input, and the `SOPHIA_RELEASE_AUTHORIZED`
 * repository variable — are author-controlled payload, so they are no longer
 * authorization sources. They are still accepted as a non-authorizing operator intent
 * signal and recorded in the emitted reason.
 *
 * The guard is pure: it receives an evidence object describing the state of the
 * release gate (see `collect-release-gate-evidence.mjs`) and decides. It performs no
 * network access, so the decision is fully testable.
 *
 * Why the gate configuration itself is what gets verified: when an environment carries
 * a required-reviewer protection rule and no admin bypass, GitHub pauses the job until
 * a required reviewer explicitly approves it. Multi-reviewer environments (`reviewerCount > 1`)
 * additionally require `prevent_self_review` so the run actor cannot self-approve; a
 * sole-operator OPC environment (`reviewerCount === 1`) allows the single operator to
 * approve the paused deployment while still forbidding `can_admins_bypass`. Proving
 * that rule exists on this environment, bound to this run, attempt, and commit, is
 * therefore proof that a human approval gated this revision — without inventing a
 * bypassable token of our own.
 */

/** @typedef {Object} ReleaseGateEvidence
 * @property {boolean} checked        the live configuration was actually read
 * @property {string}  repository     repository the environment belongs to
 * @property {string}  environment    environment name the job runs in
 * @property {string}  runId          GitHub Actions run id
 * @property {string}  runAttempt     GitHub Actions run attempt
 * @property {string}  sha            commit the run checked out
 * @property {boolean} requiresIndependentReview  a required-reviewer protection rule exists
 * @property {number}  reviewerCount  eligible required reviewers on that rule
 * @property {boolean} preventSelfReview  a reviewer may not approve their own run
 * @property {boolean} adminBypass    repository admins may bypass the gate
 * @property {string}  actor          login triggering the run
 */

export const RELEASE_ENVIRONMENT = 'production';

/** Reads a value and trims it; empty and missing are both treated as absent. */
function read(value) {
  return String(value ?? '').trim();
}

function readBoolean(value) {
  return read(value).toLowerCase() === 'true';
}

/**
 * Parses the serialized evidence the workflow passes through the environment.
 * Returns null when it is absent or unparseable, so the caller can fail closed
 * rather than assume a gate that was never checked.
 * @param {string | undefined} raw
 * @returns {ReleaseGateEvidence | null}
 */
export function parseReleaseGateEvidence(raw) {
  const text = read(raw);
  if (text === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return {
    checked: parsed.checked === true,
    repository: read(parsed.repository),
    environment: read(parsed.environment),
    runId: read(parsed.runId),
    runAttempt: read(parsed.runAttempt),
    sha: read(parsed.sha),
    requiresIndependentReview: parsed.requiresIndependentReview === true,
    reviewerCount: Number.isFinite(parsed.reviewerCount) ? Number(parsed.reviewerCount) : 0,
    preventSelfReview: parsed.preventSelfReview === true,
    adminBypass: parsed.adminBypass === true,
    actor: read(parsed.actor),
  };
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {ReleaseGateEvidence | null} [gate]
 */
export function evaluateReleaseAuthorization(env = process.env, gate = null) {
  if (readBoolean(env.DRY_RUN ?? env.INPUT_DRY_RUN)) {
    return {
      authorized: true,
      mode: 'DRY_RUN_ONLY',
      reason: 'Dry-run mode builds and verifies without mutating production.',
      operatorIntent: null,
    };
  }

  if (read(env.SOPHIA_PRODUCTION_READ_ONLY) === '1') {
    return {
      authorized: false,
      mode: 'BLOCKED_READ_ONLY_MISSION',
      reason: 'SOPHIA_PRODUCTION_READ_ONLY=1 is active; production deployment is strictly forbidden.',
      operatorIntent: null,
    };
  }

  if (!gate || !gate.checked) {
    return blocked(
      'BLOCKED_RELEASE_GATE_UNVERIFIED',
      'No release-gate evidence was supplied, or it could not be collected; refusing to assume an approval mechanism exists.'
    );
  }

  if (gate.environment !== RELEASE_ENVIRONMENT) {
    return blocked(
      'BLOCKED_RELEASE_GATE_ENVIRONMENT_MISMATCH',
      `Release gate must be verified for the '${RELEASE_ENVIRONMENT}' environment, not '${gate.environment || '(none)'}'.`
    );
  }

  const expectedRepository = read(env.GITHUB_REPOSITORY);
  if (expectedRepository !== '' && gate.repository !== expectedRepository) {
    return blocked(
      'BLOCKED_RELEASE_GATE_REPOSITORY_MISMATCH',
      `Release gate evidence belongs to '${gate.repository}', not this repository '${expectedRepository}'.`
    );
  }

  const expectedRunId = read(env.GITHUB_RUN_ID);
  if (expectedRunId === '') {
    return blocked(
      'BLOCKED_RELEASE_GATE_RUN_MISSING',
      'This run does not expose a workflow run id, so the release gate cannot be bound to it.'
    );
  }
  if (gate.runId !== expectedRunId) {
    return blocked(
      'BLOCKED_RELEASE_GATE_RUN_MISMATCH',
      'Release gate evidence belongs to a different workflow run and cannot authorize this one.'
    );
  }

  const expectedAttempt = read(env.GITHUB_RUN_ATTEMPT);
  if (expectedAttempt !== '' && gate.runAttempt !== expectedAttempt) {
    return blocked(
      'BLOCKED_RELEASE_GATE_ATTEMPT_MISMATCH',
      'Release gate evidence belongs to a different run attempt and cannot authorize this one.'
    );
  }

  const expectedSha = read(env.GITHUB_SHA);
  if (expectedSha === '') {
    return blocked(
      'BLOCKED_RELEASE_GATE_REVISION_MISSING',
      'This run does not expose a head commit SHA, so the release gate cannot be bound to a revision.'
    );
  }
  if (gate.sha !== expectedSha) {
    return blocked(
      'BLOCKED_RELEASE_GATE_REVISION_MISMATCH',
      `Release gate evidence was collected for commit ${gate.sha || '(none)'}, not the ${expectedSha} this run deploys.`
    );
  }

  if (!gate.requiresIndependentReview || gate.reviewerCount < 1) {
    return blocked(
      'BLOCKED_RELEASE_GATE_NO_INDEPENDENT_REVIEWER',
      `Environment '${RELEASE_ENVIRONMENT}' has no required-reviewer protection rule; GitHub will not pause this deploy for a human approval.`
    );
  }

  if (gate.reviewerCount > 1 && !gate.preventSelfReview) {
    return blocked(
      'BLOCKED_RELEASE_GATE_SELF_REVIEW_ALLOWED',
      `Environment '${RELEASE_ENVIRONMENT}' has ${gate.reviewerCount} reviewers but permits a run actor to approve their own deployment; multi-reviewer gates must enforce prevent_self_review.`
    );
  }

  if (gate.adminBypass) {
    return blocked(
      'BLOCKED_RELEASE_GATE_ADMIN_BYPASS',
      `Environment '${RELEASE_ENVIRONMENT}' allows repository admins to bypass the approval gate; the approval is not enforced.`
    );
  }

  return {
    authorized: true,
    mode: 'ENVIRONMENT_APPROVAL_BOUND',
    reason: `Production mutation authorized by GitHub Environment approval on '${RELEASE_ENVIRONMENT}', bound to run ${gate.runId || '(unknown)'} attempt ${gate.runAttempt || '(unknown)'} at commit ${gate.sha || '(unknown)'}.`,
    operatorIntent: operatorIntent(env),
  };
}

function blocked(mode, reason) {
  return { authorized: false, mode, reason, operatorIntent: null };
}

/**
 * Operator intent signals that are deliberately NOT authorization. They are
 * recorded so a reviewer can see what the operator asked for, and nothing more.
 * @param {Record<string, string | undefined>} env
 */
function operatorIntent(env) {
  const commitMarker = String(env.COMMIT_MESSAGE ?? '').includes('[RELEASE-AUTHORIZED]');
  const dispatchRequested = readBoolean(env.AUTHORIZE_PRODUCTION_RELEASE ?? env.INPUT_AUTHORIZE_PRODUCTION_RELEASE);
  const variableRequested = read(env.SOPHIA_RELEASE_AUTHORIZED) === '1';
  if (!commitMarker && !dispatchRequested && !variableRequested) return null;
  return {
    commitMessageMarker: commitMarker,
    dispatchInputRequested: dispatchRequested,
    repositoryVariableRequested: variableRequested,
    note: 'Operator intent signal only. It grants no authorization.',
  };
}

const isMainModule =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].endsWith('verify-release-authorization.mjs');

if (isMainModule) {
  const gate = parseReleaseGateEvidence(process.env.RELEASE_GATE_EVIDENCE);
  const decision = evaluateReleaseAuthorization(process.env, gate);
  process.stdout.write(`${JSON.stringify(decision)}\n`);
  if (!decision.authorized) {
    process.stderr.write(`❌ ${decision.reason}\n`);
    process.exit(1);
  }
}
