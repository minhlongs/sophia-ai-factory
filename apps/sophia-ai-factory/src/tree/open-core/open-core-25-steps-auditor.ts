/**
 * 25-Step Open-Core catalog metadata auditor
 *
 * Checks catalog structure and required documentation fields. This does not
 * claim that the listed work, verification artifacts, or product flows ship.
 *
 * Layer: tree/open-core
 * @module tree/open-core/open-core-25-steps-auditor
 */

import type { SophiaEdition } from '@/seed/config/open-core-manifest';
import {
  evaluateGovernanceFileResolution,
  evaluateOpenCoreArtifactResolution,
  type ArtifactExistenceProbe,
} from '@/seed/config/open-core-artifact-resolution';
import {
  OPEN_CORE_25_STEPS,
  OPEN_CORE_PHASES,
  PROTECTED_OPEN_CORE_FLOWS,
  REQUIRED_GITHUB_COMMUNITY_FILES,
  TOTAL_OPEN_CORE_STEPS,
  type OpenCorePhaseId,
  type OpenCoreStepDefinition,
} from '@/seed/config/open-core-25-steps-catalog';
import type { EditionContextInput } from '@/seed/config/edition-config';
import { sha256Hex } from '@/seed/security/token-hash';
import { success, type Result } from '@/seed/types/result';
import {
  evaluateEditionFeatureBreakdown,
  buildPhaseCatalogSummaries,
  validateCatalogStructure,
} from './open-core-25-steps-auditor-helpers';

export interface PhaseCatalogSummary {
  readonly phaseId: OpenCorePhaseId;
  readonly order: number;
  readonly titleVi: string;
  readonly titleEn: string;
  readonly totalSteps: number;
  readonly documentedSteps: number;
  readonly steps: readonly OpenCoreStepDefinition[];
}

export interface OpenCore25StepCatalogInput {
  readonly editionContext?: EditionContextInput;
  /**
   * Existence check for a catalog-relative path. Omit it and the report
   * states that verification was not performed instead of implying coverage.
   */
  readonly artifactExistenceProbe?: ArtifactExistenceProbe | null;
}

export interface OpenCore25StepCatalogReport {
  readonly totalSteps: number;
  readonly documentedSteps: number;
  readonly catalogCompletenessPercentage: number;
  readonly catalogComplete: boolean;
  readonly catalogStructureValid: boolean;
  readonly activeEdition: SophiaEdition;
  readonly communityFeatureCount: number;
  readonly cloudSaasFeatureCount: number;
  readonly enterpriseMasterFeatureCount: number;
  readonly unlockedFeatureCount: number;
  readonly protectedFlowDefinitionsCount: number;
  readonly requiredGovernanceFileDefinitionsCount: number;
  /**
   * Count of the required governance files that were confirmed to exist. The
   * definitions count above records what the catalog promises; this records
   * what was seen on disk, and is null when no probe was available.
   */
  readonly verifiedGovernanceFilesCount: number | null;
  /**
   * Artifacts confirmed to exist on disk. Distinct from `documentedSteps`,
   * which only records that a path was written down. `verificationPerformed`
   * is false when no existence probe was supplied, and the percentage is null
   * in that case so an unchecked state is never rendered as a result.
   */
  readonly verifiedSteps: number;
  readonly verificationPerformed: boolean;
  readonly verifiedArtifactsPercentage: number | null;
  readonly missingVerificationArtifacts: readonly string[];
  readonly missingGovernanceFiles: readonly string[];
  readonly phases: readonly PhaseCatalogSummary[];
  readonly catalogFingerprintHex: string;
}

export async function auditOpenCore25StepCatalog(
  input: OpenCore25StepCatalogInput = {},
): Promise<Result<OpenCore25StepCatalogReport, { code: string; message: string }>> {
  const {
    activeEdition,
    communityFeatureCount,
    cloudSaasFeatureCount,
    enterpriseMasterFeatureCount,
    unlockedFeatureCount,
  } = evaluateEditionFeatureBreakdown(input.editionContext);

  const phases = buildPhaseCatalogSummaries();
  const {
    documentedSteps,
    catalogStructureValid,
    catalogCompletenessPercentage,
  } = validateCatalogStructure();

  const catalogFingerprintHex = await sha256Hex(JSON.stringify({
    phases: OPEN_CORE_PHASES,
    steps: OPEN_CORE_25_STEPS,
  }));

  return success({
    totalSteps: TOTAL_OPEN_CORE_STEPS,
    documentedSteps,
    catalogCompletenessPercentage,
    catalogComplete: catalogStructureValid && documentedSteps === TOTAL_OPEN_CORE_STEPS,
    catalogStructureValid,
    activeEdition,
    communityFeatureCount,
    cloudSaasFeatureCount,
    enterpriseMasterFeatureCount,
    unlockedFeatureCount,
    protectedFlowDefinitionsCount: PROTECTED_OPEN_CORE_FLOWS.length,
    requiredGovernanceFileDefinitionsCount: REQUIRED_GITHUB_COMMUNITY_FILES.length,
    ...(() => {
      const artifacts = evaluateOpenCoreArtifactResolution(
        OPEN_CORE_25_STEPS,
        input.artifactExistenceProbe ?? null,
      );
      const governance = evaluateGovernanceFileResolution(
        REQUIRED_GITHUB_COMMUNITY_FILES,
        input.artifactExistenceProbe ?? null,
      );
      return {
        verifiedGovernanceFilesCount: governance.verificationPerformed
          ? governance.verifiedSteps
          : null,
        verifiedSteps: artifacts.verifiedSteps,
        verificationPerformed: artifacts.verificationPerformed,
        verifiedArtifactsPercentage: artifacts.verifiedArtifactsPercentage,
        missingVerificationArtifacts: artifacts.missingVerificationArtifacts,
        missingGovernanceFiles: governance.missingVerificationArtifacts,
      };
    })(),
    phases,
    catalogFingerprintHex,
  });
}

export const auditOpenCore25StepsReadiness = auditOpenCore25StepCatalog;
