/**
 * 25-Step Open-Core catalog metadata auditor
 *
 * Checks catalog structure and required documentation fields. This does not
 * claim that the listed work, verification artifacts, or product flows ship.
 *
 * Layer: tree/open-core
 * @module tree/open-core/open-core-25-steps-auditor
 */

import {
  OPEN_CORE_FEATURES,
  type SophiaEdition,
  type SophiaModuleFeatureId,
} from '@/seed/config/open-core-manifest';
import {
  OPEN_CORE_25_STEPS,
  OPEN_CORE_PHASES,
  PROTECTED_OPEN_CORE_FLOWS,
  REQUIRED_GITHUB_COMMUNITY_FILES,
  TOTAL_OPEN_CORE_STEPS,
  type OpenCorePhaseId,
  type OpenCoreStepDefinition,
} from '@/seed/config/open-core-25-steps-catalog';
import { evaluateFeatureGate, type EditionContextInput } from '@/seed/config/edition-config';
import { sha256Hex } from '@/seed/security/token-hash';
import { success, type Result } from '@/seed/types/result';

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

function hasCompleteCatalogMetadata(step: OpenCoreStepDefinition): boolean {
  return (
    step.step >= 1 &&
    step.step <= TOTAL_OPEN_CORE_STEPS &&
    step.slug.trim().length > 0 &&
    step.titleVi.trim().length > 0 &&
    step.titleEn.trim().length > 0 &&
    step.businessRule.trim().length > 0 &&
    step.agenticRole.trim().length > 0 &&
    step.governanceGate.trim().length > 0 &&
    step.verificationArtifact.trim().length > 0
  );
}

export async function auditOpenCore25StepCatalog(
  input: OpenCore25StepCatalogInput = {},
): Promise<Result<OpenCore25StepCatalogReport, { code: string; message: string }>> {
  const featureIds = Object.keys(OPEN_CORE_FEATURES) as SophiaModuleFeatureId[];
  const gateEvaluations = featureIds.map((id) => evaluateFeatureGate(id, input.editionContext));
  const activeEdition = gateEvaluations[0]?.activeEdition ?? 'community';

  let communityFeatureCount = 0;
  let cloudSaasFeatureCount = 0;
  let enterpriseMasterFeatureCount = 0;
  let unlockedFeatureCount = 0;

  for (const gate of gateEvaluations) {
    if (gate.feature.scope === 'COMMUNITY') communityFeatureCount++;
    else if (gate.feature.scope === 'CLOUD_SAAS') cloudSaasFeatureCount++;
    else if (gate.feature.scope === 'ENTERPRISE_MASTER') enterpriseMasterFeatureCount++;
    if (gate.allowed) unlockedFeatureCount++;
  }

  const phases: PhaseCatalogSummary[] = OPEN_CORE_PHASES.map((phase) => {
    const phaseSteps = OPEN_CORE_25_STEPS.filter((s) => s.phaseId === phase.id);
    const documentedInPhase = new Set(
      phaseSteps.filter(hasCompleteCatalogMetadata).map((step) => step.step),
    ).size;
    return {
      phaseId: phase.id,
      order: phase.order,
      titleVi: phase.titleVi,
      titleEn: phase.titleEn,
      totalSteps: phaseSteps.length,
      documentedSteps: documentedInPhase,
      steps: phaseSteps,
    };
  });

  const stepNumbers = OPEN_CORE_25_STEPS.map((step) => step.step);
  const slugs = OPEN_CORE_25_STEPS.map((step) => step.slug);
  const phaseById = new Map(OPEN_CORE_PHASES.map((phase) => [phase.id, phase]));
  const documentedNumbers = new Set(
    OPEN_CORE_25_STEPS.filter(hasCompleteCatalogMetadata).map((step) => step.step),
  );
  const documentedSteps = documentedNumbers.size;
  const catalogStructureValid =
    OPEN_CORE_25_STEPS.length === TOTAL_OPEN_CORE_STEPS &&
    new Set(stepNumbers).size === TOTAL_OPEN_CORE_STEPS &&
    stepNumbers.every((step, index) => step === index + 1) &&
    new Set(slugs).size === TOTAL_OPEN_CORE_STEPS &&
    OPEN_CORE_PHASES.length === 6 &&
    new Set(OPEN_CORE_PHASES.map((phase) => phase.id)).size === OPEN_CORE_PHASES.length &&
    OPEN_CORE_25_STEPS.every((step) => {
      const phase = phaseById.get(step.phaseId);
      return phase !== undefined && step.step >= phase.stepRange[0] && step.step <= phase.stepRange[1];
    });
  const catalogCompletenessPercentage = Math.min(
    100,
    Math.round((documentedSteps / TOTAL_OPEN_CORE_STEPS) * 100),
  );
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
