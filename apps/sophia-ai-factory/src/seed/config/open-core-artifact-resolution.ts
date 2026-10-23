/**
 * Artifact path resolution for the 25-Step Open-Core catalog
 *
 * A step's `verificationArtifact` is written relative to the repository root,
 * which is where a self-hoster clones. Some paths historically only resolved
 * against the app folder, so resolution tries both bases and reports what it
 * found rather than assuming.
 *
 * The existence probe is injected: `seed/config` must stay free of Node-only
 * imports so it can be pulled into the edge bundle, and callers decide when
 * touching a real filesystem is legitimate.
 *
 * Layer: seed/config
 * @module seed/config/open-core-artifact-resolution
 */

import { ARTIFACT_RESOLUTION_BASE } from './open-core-25-steps-catalog';
import type { OpenCoreStepDefinition } from './open-core-25-steps-types';

export { ARTIFACT_RESOLUTION_BASE };

/**
 * Whether a candidate path exists. Callers pass `fs.existsSync` bound to the
 * base directory, or a stub in tests. Throwing is treated as "unknown", never
 * as "present".
 */
export type ArtifactExistenceProbe = (absolutePath: string) => boolean;

export interface ArtifactResolutionResult {
  /** Steps whose artifact resolved. */
  readonly verifiedSteps: number;
  /**
   * Paths that did not resolve. Reported verbatim so a failure names the file
   * instead of only moving a percentage.
   */
  readonly missingVerificationArtifacts: readonly string[];
  /**
   * False when the probe was unavailable or threw. A caller must never read
   * this state as a pass.
   */
  readonly verificationPerformed: boolean;
  /**
   * Percentage of artifacts that resolved, or null when verification was not
   * performed. Null rather than 0 or 100 so no caller can render an unchecked
   * state as a result.
   */
  readonly verifiedArtifactsPercentage: number | null;
}

/**
 * Where the probe is rooted. `ARTIFACT_RESOLUTION_BASE` in the catalog records
 * that paths are written against the **repository root**, so a probe must be
 * created with that directory as its root — a probe rooted elsewhere reports
 * false misses.
 */
export const ARTIFACT_RESOLUTION_BASES: readonly string[] = ['.', 'apps/sophia-ai-factory'];

const APP_DIRECTORY = 'apps/sophia-ai-factory';

const NOT_PERFORMED: Omit<ArtifactResolutionResult, 'verifiedSteps' | 'missingVerificationArtifacts'> =
  { verificationPerformed: false, verifiedArtifactsPercentage: null };

/**
 * Candidates for one catalog path. The path is tried verbatim first (correct
 * for a probe rooted at the repo root), then with the app prefix, which only
 * resolves paths that genuinely live under the app folder.
 */
export function artifactPathCandidates(
  artifact: string,
  bases: readonly string[] = ARTIFACT_RESOLUTION_BASES,
): readonly string[] {
  if (artifact.startsWith(`${APP_DIRECTORY}/`)) {
    return bases.includes(APP_DIRECTORY)
      ? [artifact, artifact.slice(APP_DIRECTORY.length + 1)]
      : [artifact];
  }
  return bases.map((base) => (base === '.' ? artifact : `${base}/${artifact}`));
}

function attemptResolution(
  artifacts: readonly string[],
  probe: ArtifactExistenceProbe | null,
  bases: readonly string[],
): ArtifactResolutionResult {
  if (!probe) {
    return { verifiedSteps: 0, missingVerificationArtifacts: artifacts, ...NOT_PERFORMED };
  }
  const missing: string[] = [];
  let verified = 0;
  for (const artifact of artifacts) {
    const found = artifactPathCandidates(artifact, bases).some((candidate) => {
      try {
        return probe(candidate);
      } catch {
        return false;
      }
    });
    if (found) verified += 1;
    else missing.push(artifact);
  }
  return {
    verifiedSteps: verified,
    missingVerificationArtifacts: missing,
    verificationPerformed: true,
    verifiedArtifactsPercentage:
      artifacts.length === 0 ? null : Math.round((verified / artifacts.length) * 100),
  };
}

/**
 * Resolves every step's artifact path against the given bases. Returns the
 * unchecked result when no probe is supplied, so a filesystem-less caller
 * cannot accidentally claim coverage it did not measure.
 */
export function evaluateOpenCoreArtifactResolution(
  steps: readonly OpenCoreStepDefinition[],
  probe: ArtifactExistenceProbe | null,
  bases: readonly string[] = ARTIFACT_RESOLUTION_BASES,
): ArtifactResolutionResult {
  return attemptResolution(steps.map((step) => step.verificationArtifact), probe, bases);
}

/** Resolves the required GitHub community files against the given bases. */
export function evaluateGovernanceFileResolution(
  requiredFiles: readonly string[],
  probe: ArtifactExistenceProbe | null,
  bases: readonly string[] = ARTIFACT_RESOLUTION_BASES,
): ArtifactResolutionResult {
  return attemptResolution(requiredFiles, probe, bases);
}
