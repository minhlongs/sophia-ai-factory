/**
 * Real-verifier regression: an app-folder copy cannot satisfy a repository-root
 * artifact. This spawns the actual readiness script rather than stubbing it, so
 * the script's own path logic is under test.
 *
 * @module seed/config/__tests__/open-core-readiness-contract
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The repository root, found by walking up until a directory holding both the
 * catalog and the app folder is found — rather than assuming a checkout depth.
 */
function findRepoRoot(start: string): string {
  let current = start;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(current, 'apps/sophia-ai-factory/src/seed/config');
    if (existsSync(candidate) && existsSync(resolve(current, 'LICENSE'))) return current;
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  throw new Error('repository root not found');
}

const appRoot = process.cwd();
const repoRoot = findRepoRoot(appRoot);
const artifact = 'plans/company-blueprint/plan.md';
const verifier = resolve(appRoot, 'scripts/verify-open-core-readiness.mjs');

interface VerifierReport {
  passed: boolean;
  catalogComplete: boolean;
  errors: string[];
}

describe('Open-Core readiness verifier path contract', () => {
  it('marks a missing root artifact incomplete even when the app copy exists', () => {
    const preload = `
      import fs from 'node:fs';
      const originalExistsSync = fs.existsSync.bind(fs);
      fs.existsSync = (candidate) => {
        if (candidate === ${JSON.stringify(resolve(repoRoot, artifact))}) return false;
        if (candidate === ${JSON.stringify(resolve(appRoot, artifact))}) return true;
        return originalExistsSync(candidate);
      };
    `;
    const preloadUrl = `data:text/javascript;base64,${Buffer.from(preload).toString('base64')}`;
    const result = spawnSync(process.execPath, ['--import', preloadUrl, verifier], {
      cwd: appRoot, encoding: 'utf8', timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout) as VerifierReport;
    expect(report.passed).toBe(false);
    expect(report.catalogComplete).toBe(false);
    expect(report.errors).toContain(`Catalog reference does not exist: ${artifact}`);
  });

  it('passes when every artifact is present at its declared root', () => {
    const result = spawnSync(process.execPath, [verifier], {
      cwd: appRoot, encoding: 'utf8', timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as VerifierReport;
    expect(report.passed).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it('locates the repository root without assuming a checkout depth', () => {
    expect(readdirSync(repoRoot).length).toBeGreaterThan(0);
  });
});
