/**
 * Real-verifier regression: an app-folder copy cannot satisfy a repository-root
 * artifact, and Edge SHA-256 snapshot tampering fails closed at CI/build time.
 * This spawns the actual readiness script rather than stubbing it, so the
 * script's own path and SHA-256 parity logic is under test.
 *
 * @module seed/config/__tests__/open-core-readiness-contract
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
const snapshotFile = resolve(appRoot, 'src/seed/config/open-core-verified-artifacts-snapshot.ts');
const verifier = resolve(appRoot, 'scripts/verify-open-core-readiness.mjs');

interface VerifierReport {
  passed: boolean;
  catalogComplete: boolean;
  errors: string[];
}

describe('Open-Core readiness verifier path & SHA-256 snapshot contract', () => {
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

  it('fails closed when the Edge snapshot SHA-256 or path list drifts from the catalog', () => {
    const preload = `
      import fs from 'node:fs';
      const originalReadFileSync = fs.readFileSync.bind(fs);
      fs.readFileSync = (candidate, ...rest) => {
        const raw = originalReadFileSync(candidate, ...rest);
        if (String(candidate) === ${JSON.stringify(snapshotFile)} && typeof raw === 'string') {
          return raw
            .replace(/VERIFIED_CATALOG_SHA256\\s*=\\s*'[0-9a-f]{64}'/, "VERIFIED_CATALOG_SHA256 = '" + '0'.repeat(64) + "'")
            .replace("'README.md',", '');
        }
        return raw;
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
    expect(report.errors).toContain('Verified Edge snapshot missing catalog/governance artifact: README.md');
    expect(report.errors.some((e) => e.startsWith('Verified Edge snapshot SHA-256 drift:'))).toBe(true);
  });

  it('passes when every artifact is present at its declared root and matches the Edge snapshot', () => {
    const result = spawnSync(process.execPath, [verifier], {
      cwd: appRoot, encoding: 'utf8', timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as VerifierReport;
    expect(report.passed).toBe(true);
    expect(report.catalogComplete).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it('locates the repository root without assuming a checkout depth', () => {
    expect(readdirSync(repoRoot).length).toBeGreaterThan(0);
  });
});
