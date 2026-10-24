/**
 * Unit tests for catalog artifact path resolution
 *
 * @module seed/config/__tests__/open-core-artifact-resolution
 */

import { describe, expect, it } from 'vitest';
import {
  artifactPathCandidates,
  evaluateGovernanceFileResolution,
  evaluateOpenCoreArtifactResolution,
} from '../open-core-artifact-resolution';
import { OPEN_CORE_25_STEPS } from '../open-core-25-steps-catalog';
import { REQUIRED_GITHUB_COMMUNITY_FILES } from '../open-core-25-steps-catalog';

const everythingExists = () => true;
const nothingExists = () => false;

describe('artifact resolution against the declared repo-root base', () => {
  it('counts a step as verified when its declared path resolves', () => {
    const result = evaluateOpenCoreArtifactResolution(OPEN_CORE_25_STEPS, everythingExists);
    expect(result.verificationPerformed).toBe(true);
    expect(result.verifiedSteps).toBe(OPEN_CORE_25_STEPS.length);
    expect(result.verifiedArtifactsPercentage).toBe(100);
  });

  it('generates exactly one candidate: the path as declared', () => {
    const bases = ['.'];
    expect(artifactPathCandidates('README.md', bases)).toEqual(['README.md']);
    expect(artifactPathCandidates('apps/sophia-ai-factory/src/seed/config/open-core-manifest.ts', bases))
      .toEqual(['apps/sophia-ai-factory/src/seed/config/open-core-manifest.ts']);
  });

  it('does NOT let an app-folder twin stand in for a missing root file', () => {
    // apps/sophia-ai-factory/README.md exists alongside the root README.md.
    // A probe that cannot find the root copy must not be told the app twin is
    // an acceptable substitute, because the catalog promises the root path.
    const rootReadmeDeleted = (p: string) => p !== 'README.md';
    const result = evaluateOpenCoreArtifactResolution(OPEN_CORE_25_STEPS, rootReadmeDeleted);
    expect(result.verificationPerformed).toBe(true);
    expect(result.verifiedArtifactsPercentage).toBeLessThan(100);
    expect(result.missingVerificationArtifacts).toContain('README.md');
  });

  it('names every unresolved path so a failure is actionable', () => {
    const result = evaluateOpenCoreArtifactResolution(OPEN_CORE_25_STEPS, nothingExists);
    expect(result.verificationPerformed).toBe(true);
    expect(result.verifiedSteps).toBe(0);
    expect(result.verifiedArtifactsPercentage).toBe(0);
    expect(result.missingVerificationArtifacts).toContainEqual(
      OPEN_CORE_25_STEPS[0].verificationArtifact,
    );
  });

  it('checks the verbatim catalog path even when a base is passed', () => {
    // A legacy bases argument must not redirect a catalog path to another tree,
    // where a stale twin could answer for the missing root file.
    expect(artifactPathCandidates('README.md', ['apps/sophia-ai-factory'])).toEqual(['README.md']);
    const result = evaluateOpenCoreArtifactResolution(
      OPEN_CORE_25_STEPS,
      (candidate) => candidate.startsWith('apps/sophia-ai-factory/'),
      ['apps/sophia-ai-factory'],
    );
    // Only the 16 artifacts whose declared path already begins with the app
    // prefix resolve. The 9 root-level paths are NOT re-pointed at the app tree.
    const appPrefixed = OPEN_CORE_25_STEPS.filter((step) =>
      step.verificationArtifact.startsWith('apps/sophia-ai-factory/'),
    );
    expect(appPrefixed).toHaveLength(16);
    expect(result.verifiedSteps).toBe(appPrefixed.length);
    expect(result.verifiedArtifactsPercentage).toBe(Math.round((16 / 25) * 100));
  });
});

describe('resolution when no probe is supplied', () => {
  it('reports unknown, not a zero or a full score', () => {
    const result = evaluateOpenCoreArtifactResolution(OPEN_CORE_25_STEPS, null);
    expect(result.verificationPerformed).toBe(false);
    expect(result.verifiedArtifactsPercentage).toBeNull();
    expect(result.verifiedSteps).toBe(0);
    // Nothing was checked, so nothing is reported missing.
    expect(result.missingVerificationArtifacts).toEqual([]);
  });
});

describe('resolution when the probe throws', () => {
  it('discards partial results instead of scoring unknown data', () => {
    let calls = 0;
    const throwingAfterTwo = (): boolean => {
      calls += 1;
      if (calls > 2) throw new Error('filesystem unavailable');
      return true;
    };
    const result = evaluateOpenCoreArtifactResolution(OPEN_CORE_25_STEPS, throwingAfterTwo);
    expect(result.verificationPerformed).toBe(false);
    expect(result.verifiedArtifactsPercentage).toBeNull();
    expect(result.verifiedSteps).toBe(0);
    // A partial "2 of 25 verified" score would be evidence of nothing.
    expect(result.verifiedArtifactsPercentage).not.toBe(8);
    expect(result.missingVerificationArtifacts).toEqual([]);
  });
});

describe('governance file resolution', () => {
  it('verifies every declared governance file', () => {
    const result = evaluateGovernanceFileResolution(REQUIRED_GITHUB_COMMUNITY_FILES, everythingExists);
    expect(result.verificationPerformed).toBe(true);
    expect(result.verifiedSteps).toBe(REQUIRED_GITHUB_COMMUNITY_FILES.length);
    expect(result.verifiedArtifactsPercentage).toBe(100);
  });

  it('names a governance file that does not resolve', () => {
    const result = evaluateGovernanceFileResolution(REQUIRED_GITHUB_COMMUNITY_FILES, nothingExists);
    expect(result.verifiedArtifactsPercentage).toBe(0);
    expect(result.missingVerificationArtifacts).toHaveLength(REQUIRED_GITHUB_COMMUNITY_FILES.length);
  });
});
