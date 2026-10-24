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
  /** Steps whose artifact resolved. Zero when verification did not run. */
  readonly verifiedSteps: number;
  /**
   * Paths that were checked and did not resolve, reported verbatim so a failure
   * names the file instead of only moving a percentage.
   *
   * Empty when verification was not performed: nothing was checked, so nothing
   * is missing. This list is only ever evidence of *checked* absence.
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
 * The single base every catalog path is resolved against. `ARTIFACT_RESOLUTION_BASE`
 * records that paths are written against the **repository root**, so the probe
 * must be rooted there too.
 *
 * There is deliberately no app-folder fallback. `README.md` exists at BOTH the
 * repository root and under `apps/sophia-ai-factory/`, so a fallback lets a
 * deleted root file be "found" at its stale twin and reported as present. This
 * is not hypothetical: the earlier dual-base build of this module scored 100%
 * with the root `README.md` hidden, which is the exact false pass the module
 * exists to prevent.
 */
const ARTIFACT_RESOLUTION_BASES: readonly string[] = ['.'];

const NOT_PERFORMED: Omit<ArtifactResolutionResult, 'verifiedSteps' | 'missingVerificationArtifacts'> =
  { verificationPerformed: false, verifiedArtifactsPercentage: null };

/**
 * Candidates for one catalog path: exactly one, the path exactly as the catalog
 * declares it.
 *
 * `bases` is still accepted so existing callers keep type-checking, but it
 * cannot redirect a catalog path. Allowing it to would reintroduce the false
 * pass this module prevents: a caller could route a repo-root path to a
 * different tree and have a stale twin answer for it.
 */
export function artifactPathCandidates(
  artifact: string,
  _bases: readonly string[] = ARTIFACT_RESOLUTION_BASES,
): readonly string[] {
  return [artifact];
}

/**
 * Resolves every path, or reports that verification was not performed.
 *
 * A probe that throws ends the evaluation whole. A filesystem error over mostly
 * unknown paths is not evidence of absence, so reporting a confident partial
 * score would be the lie this module prevents.
 */
function attemptResolution(
  artifacts: readonly string[],
  probe: ArtifactExistenceProbe | null,
  bases: readonly string[],
): ArtifactResolutionResult {
  if (!probe) {
    return { verifiedSteps: 0, missingVerificationArtifacts: [], ...NOT_PERFORMED };
  }
  const missing: string[] = [];
  let verified = 0;
  for (const artifact of artifacts) {
    const candidates = artifactPathCandidates(artifact, bases);
    let found = false;
    try {
      found = candidates.some((candidate) => probe(candidate));
    } catch {
      return { verifiedSteps: 0, missingVerificationArtifacts: [], ...NOT_PERFORMED };
    }
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
