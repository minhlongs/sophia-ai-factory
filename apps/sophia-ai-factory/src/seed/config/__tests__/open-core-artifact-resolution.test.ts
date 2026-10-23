/**
 * Unit tests for catalog artifact path resolution
 *
 * @module seed/config/__tests__/open-core-artifact-resolution
 */

import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_RESOLUTION_BASES,
  evaluateGovernanceFileResolution,
  evaluateOpenCoreArtifactResolution,
} from '../open-core-artifact-resolution';
import { OPEN_CORE_25_STEPS } from '../open-core-25-steps-catalog';
import { REQUIRED_GITHUB_COMMUNITY_FILES } from '../open-core-25-steps-catalog';

const everythingExists = () => true;
const nothingExists = () => false;

describe('artifact resolution against both bases', () => {
  it('counts a step as verified when either base resolves it', () => {
    const result = evaluateOpenCoreArtifactResolution(OPEN_CORE_25_STEPS, (candidate) =>
      candidate.startsWith('apps/sophia-ai-factory/'),
    );
    expect(result.verificationPerformed).toBe(true);
    expect(result.verifiedSteps).toBe(OPEN_CORE_25_STEPS.length);
    expect(result.verifiedArtifactsPercentage).toBe(100);
  });

  it('resolves a path that only exists at the repo root', () => {
    const result = evaluateOpenCoreArtifactResolution(OPEN_CORE_25_STEPS, (candidate) =>
      candidate === 'LICENSE',
    );
    expect(result.missingVerificationArtifacts).toHaveLength(OPEN_CORE_25_STEPS.length);
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

  it('tries both bases for each artifact', () => {
    expect(ARTIFACT_RESOLUTION_BASES.length).toBeGreaterThan(1);
  });
});

describe('resolution when no probe is supplied', () => {
  it('reports unchecked rather than a zero or a full score', () => {
    const result = evaluateOpenCoreArtifactResolution(OPEN_CORE_25_STEPS, null);
    expect(result.verificationPerformed).toBe(false);
    expect(result.verifiedArtifactsPercentage).toBeNull();
    expect(result.verifiedSteps).toBe(0);
  });
});

describe('resolution when the probe throws', () => {
  it('degrades to unchecked instead of claiming coverage', () => {
    const throwing = (): boolean => {
      throw new Error('filesystem unavailable');
    };
    const result = evaluateOpenCoreArtifactResolution(OPEN_CORE_25_STEPS, throwing);
    expect(result.verificationPerformed).toBe(true);
    expect(result.verifiedSteps).toBe(0);
    expect(result.verifiedArtifactsPercentage).toBe(0);
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
