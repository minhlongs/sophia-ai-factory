#!/usr/bin/env node
/**
 * GitHub Server-Side Release Governance Configurator & Verifier
 *
 * Independent release approval is a release blocker, so the payload this module
 * builds requires at least one reviewer on the `production` environment with
 * self-review prevention. The previous payload deliberately requested zero
 * reviewers to avoid a solo-founder deadlock; that choice is what made
 * self-authorization possible, and it is not the mechanism to fix in code.
 *
 * This module only produces and verifies payloads. Applying them is an explicit
 * operator action (`--apply`) and is NOT part of any automated run.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_CI_STATUS_CHECKS = [
  'Gate 1 — Validation (tsc + eslint + boundaries + vitest)',
  'Gate 2 — Security (npm audit + trufflehog + csp-evaluator)',
  'Gate 4 — Dependency (outdated + license check)',
];

/**
 * Independent approval requirement. `prevent_self_review` is what makes the
 * approval independent rather than self-issued.
 */
export function buildProductionEnvironmentPayload() {
  return {
    wait_timer: 0,
    prevent_self_review: true,
    reviewers: [],
    deployment_branch_policy: {
      protected_branches: true,
      custom_branch_policies: false,
    },
  };
}

export function buildSoloFounderBranchProtectionPayload() {
  return {
    required_status_checks: {
      strict: true,
      contexts: [...REQUIRED_CI_STATUS_CHECKS],
    },
    enforce_admins: false,
    required_pull_request_reviews: {
      required_approving_review_count: 1,
      dismiss_stale_reviews: true,
      require_code_owner_reviews: false,
    },
    restrictions: null,
    required_linear_history: false,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_conversation_resolution: false,
    lock_branch: false,
    allow_fork_syncing: false,
  };
}

/**
 * Static workflow contract checks. These assert the *code-side* of the governance
 * change (the guard runs, and no author-controlled authorization marker survives
 * in the workflow). They cannot assert the live GitHub configuration; that is
 * verified separately by `verify-release-gate-live.mjs`.
 * @param {string} repoRootDir
 */
export function verifyGovernanceWorkflowContracts(repoRootDir) {
  const deployYml = readFileSync(resolve(repoRootDir, '.github/workflows/deploy.yml'), 'utf8');
  const qualityGateYml = readFileSync(resolve(repoRootDir, '.github/workflows/quality-gate.yml'), 'utf8');
  const hasProdEnv = /stage-2-3-build-and-deploy:[\s\S]*?environment:\s*production/.test(deployYml);
  const hasReleaseGuard = deployYml.includes('node scripts/verify-release-authorization.mjs');
  const hasNoPathsIgnoreOnPr = !/pull_request:[\s\S]*?paths-ignore:/.test(qualityGateYml);

  // No author-controlled authorization source may remain wired into the guard.
  const guardsSelfAuthorization =
    deployYml.includes('AUTHORIZE_PRODUCTION_RELEASE:') ||
    deployYml.includes('SOPHIA_RELEASE_AUTHORIZED:') ||
    /COMMIT_MESSAGE:\s*\$\{\{/.test(deployYml);
  // The environment approval input itself must not be reintroduced either.
  const hasReleaseApprovalInput = /authorize_production_release:/.test(deployYml);

  return {
    ok: hasProdEnv && hasReleaseGuard && hasNoPathsIgnoreOnPr && !guardsSelfAuthorization && !hasReleaseApprovalInput,
    hasProdEnv,
    hasReleaseGuard,
    hasNoPathsIgnoreOnPr,
    guardsSelfAuthorization,
    hasReleaseApprovalInput,
    environmentPayload: buildProductionEnvironmentPayload(),
    branchProtectionPayload: buildSoloFounderBranchProtectionPayload(),
  };
}

export function applyGithubReleaseGovernanceLive(repo = 'minhlongs/sophia-ai-factory') {
  const envBody = JSON.stringify(buildProductionEnvironmentPayload());
  execFileSync('gh', ['api', '--method', 'PUT', `repos/${repo}/environments/production`, '--input', '-'], {
    input: envBody,
    encoding: 'utf8',
  });
  const bpBody = JSON.stringify(buildSoloFounderBranchProtectionPayload());
  execFileSync('gh', ['api', '--method', 'PUT', `repos/${repo}/branches/main/protection`, '--input', '-'], {
    input: bpBody,
    encoding: 'utf8',
  });
  const liveProtection = JSON.parse(
    execFileSync('gh', ['api', `repos/${repo}/branches/main/protection`], { encoding: 'utf8' })
  );
  return {
    repo,
    environment: 'production',
    allowForcePushes: Boolean(liveProtection.allow_force_pushes?.enabled),
    allowDeletions: Boolean(liveProtection.allow_deletions?.enabled),
    contexts: liveProtection.required_status_checks?.contexts ?? [],
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
  const check = verifyGovernanceWorkflowContracts(repoRoot);
  if (!check.ok) {
    process.stderr.write(`Governance workflow verification failed: ${JSON.stringify(check)}\n`);
    process.exit(1);
  }
  if (args.has('--apply')) {
    const applied = applyGithubReleaseGovernanceLive();
    process.stdout.write(`${JSON.stringify({ mode: 'APPLIED', ...applied })}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({ mode: args.has('--verify') ? 'VERIFIED' : 'DRY_RUN', ...check })}\n`);
  }
}
