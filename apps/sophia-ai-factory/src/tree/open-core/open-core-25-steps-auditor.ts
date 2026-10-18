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
    phases,
    catalogFingerprintHex,
  });
}

export const auditOpenCore25StepsReadiness = auditOpenCore25StepCatalog;
