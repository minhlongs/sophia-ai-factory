#!/usr/bin/env node
/**
 * verify-core-video-factory-evidence.mjs
 *
 * Reads the evidence JSON produced by the verifier and validates:
 * - All gates passed
 * - Required artifacts present (video row, mock video URL)
 * - No real API keys were used (proof mode enforced)
 *
 * Usage: node scripts/verify-core-video-factory-evidence.mjs [evidence-path]
 * Default evidence path: plans/reports/core-video-factory-proof-latest.json
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function resolveEvidencePath() {
  const cliArg = process.argv[2];
  if (cliArg) return resolve(root, cliArg);
  const latest = resolve(root, 'plans/reports/core-video-factory-proof-latest.json');
  if (existsSync(latest)) return latest;
  // Fall back to timestamped file in plans/reports/
  const reportsDir = resolve(root, 'plans/reports');
  const files = [];
  try {
    const entries = readdirSync(reportsDir);
    files.push(...entries.filter((f) => f.startsWith('core-video-factory-proof-') && f.endsWith('.json')));
  } catch { /* directory may not exist */ }
  files.sort().reverse();
  if (files.length === 0) {
    console.error('FAIL: no evidence file found in plans/reports/');
    process.exit(1);
  }
  return resolve(root, 'plans/reports', files[0]);
}

function main() {
  const evidencePath = resolveEvidencePath();
  console.log(`Validating evidence: ${evidencePath}`);

  if (!existsSync(evidencePath)) {
    console.error(`FAIL: evidence file not found: ${evidencePath}`);
    process.exit(1);
  }

  let evidence;
  try {
    evidence = JSON.parse(readFileSync(evidencePath, 'utf-8'));
  } catch (err) {
    console.error(`FAIL: could not parse evidence JSON: ${err.message}`);
    process.exit(1);
  }

  const checks = [];
  const isCurrentSchema = evidence.schema === 'sophia-core-video-deterministic-proof-v2';
  const isLegacySchema = !evidence.schema && evidence.proofMode === true;
  const requiredGates = [
    'mock provider safety tests',
    'proof flow integration tests',
    'live and business evidence contract tests',
    'TypeScript compile',
    'ESLint zero-error gate',
  ];
  const requiredGatesForEvidence = isLegacySchema
    ? requiredGates.filter((name) => name !== 'live and business evidence contract tests')
    : requiredGates;
  const gates = Array.isArray(evidence.gates) ? evidence.gates : [];
  const byName = new Map(gates.map((gate) => [gate.name, gate]));
  checks.push({
    name: 'all required deterministic gates passed',
    passed: requiredGatesForEvidence.every((name) => byName.get(name)?.status === 'passed'),
  });
  checks.push({ name: 'proof mode active', passed: evidence.proofMode === true });
  checks.push({ name: 'mock provider used', passed: evidence.provider === 'mock' });

  checks.push({ name: 'recognized evidence schema', passed: isCurrentSchema || isLegacySchema });

  if (isCurrentSchema) {
    checks.push({ name: 'deterministic mock scope declared', passed: evidence.scope === 'deterministic-mock-tests' });
    checks.push({ name: 'worktree fingerprint present', passed: typeof evidence.source?.worktreeFingerprint === 'string' && evidence.source.worktreeFingerprint.length === 64 });
    checks.push({ name: 'live and commercial claims remain false', passed:
      evidence.liveProviderValidated === false &&
      evidence.checkoutValidated === false &&
      evidence.livePayoutValidated === false &&
      evidence.productionPublishValidated === false &&
      evidence.productionSloValidated === false &&
      evidence.commercialUnitEconomicsValidated === false,
    });
  } else if (isLegacySchema) {
    const hasMockUrl = String(evidence.artifacts?.videoUrl ?? '').includes('mock.sophia.local');
    checks.push({ name: 'legacy mock artifact declaration present', passed: hasMockUrl && evidence.artifacts?.videoStatus === 'completed' });
  }

  // Print results
  let allOk = true;
  for (const check of checks) {
    const icon = check.passed ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${check.name}`);
    if (!check.passed) allOk = false;
  }

  if (!allOk) {
    console.error('\nEVIDENCE VALIDATION FAILED');
    process.exit(1);
  }

  if (isLegacySchema) {
    console.log('\nLEGACY MOCK EVIDENCE VALID: this only validates the historical deterministic test declaration.');
  } else {
    console.log('\nDETERMINISTIC MOCK EVIDENCE VALID: live provider, payment, production SLO, and unit economics remain unproven.');
  }
}

main();
