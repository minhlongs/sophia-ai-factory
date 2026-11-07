#!/usr/bin/env node
/**
 * Release-Gate Evidence Collector
 *
 * Reads the live configuration of the `production` GitHub Environment over the
 * REST API and emits the JSON the release guard consumes. `GET .../environments/{name}`
 * needs only read access to the repository, which is why this can run inside the
 * deploy job without elevating the token beyond what the workflow already holds.
 *
 * This exists because the alternative — an `ENVIRONMENT_APPROVED=1` style variable —
 * would be one more author-controlled token. Reading the actual protection rules is
 * the only way to tell whether GitHub will genuinely pause this deployment for a human.
 */

import { execFileSync } from 'node:child_process';

const ENVIRONMENT = process.env.RELEASE_ENVIRONMENT ?? 'production';

function runGh(args, token) {
  return execFileSync('gh', ['api', ...args], {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: token },
  });
}

export function repositorySlug() {
  const repository = process.env.GITHUB_REPOSITORY ?? '';
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error(`GITHUB_REPOSITORY is missing or malformed: '${repository}'`);
  }
  return repository;
}

/** Reads the environment protection configuration; throws when unreachable. */
export function readEnvironmentGate(token) {
  return JSON.parse(runGh([`repos/${repositorySlug()}/environments/${encodeURIComponent(ENVIRONMENT)}`], token));
}

/**
 * Distils the live environment object into the exact facts the guard needs.
 * The protection-rule `type` values are only observable from live responses, so the
 * ones handled here are recorded in `release-gate-contract.test.ts`.
 * @param {Object} environment
 */
export function buildGateEvidence(environment) {
  const rules = Array.isArray(environment?.protection_rules) ? environment.protection_rules : [];
  const reviewers = rules.find((rule) => rule?.type === 'required_reviewers');
  const reviewerList = Array.isArray(reviewers?.reviewers) ? reviewers.reviewers : [];
  return {
    checked: true,
    repository: repositorySlug(),
    environment: String(environment?.name ?? '').trim(),
    runId: process.env.GITHUB_RUN_ID ?? '',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? '1',
    sha: process.env.GITHUB_SHA ?? '',
    requiresIndependentReview: Boolean(reviewers),
    reviewerCount: reviewerList.length,
    preventSelfReview: reviewers?.prevent_self_review === true,
    adminBypass: environment?.can_admins_bypass === true,
    actor: process.env.GITHUB_ACTOR ?? '',
  };
}

const isMainModule =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].endsWith('collect-release-gate-evidence.mjs');

if (isMainModule) {
  const token = process.env.GATE_READ_TOKEN;
  if (!token) {
    process.stderr.write('GATE_READ_TOKEN is required to read the live environment configuration.\n');
    process.exit(2);
  }
  try {
    process.stdout.write(`${JSON.stringify(buildGateEvidence(readEnvironmentGate(token)))}\n`);
  } catch (error) {
    process.stderr.write(`Failed to read environment '${ENVIRONMENT}': ${error?.message ?? error}\n`);
    process.exit(2);
  }
}
