/**
 * 25-Step Open-Core Catalog Auditor Helpers
 *
 * Layer: tree/open-core
 * @module tree/open-core/open-core-25-steps-auditor-helpers
 */

import {
  OPEN_CORE_FEATURES,
  type SophiaEdition,
  type SophiaModuleFeatureId,
} from '@/seed/config/open-core-manifest';
import {
  OPEN_CORE_25_STEPS,
  OPEN_CORE_PHASES,
  TOTAL_OPEN_CORE_STEPS,
  type OpenCoreStepDefinition,
} from '@/seed/config/open-core-25-steps-catalog';
import { evaluateFeatureGate, type EditionContextInput } from '@/seed/config/edition-config';
import type { PhaseCatalogSummary } from './open-core-25-steps-auditor';

export function hasCompleteCatalogMetadata(step: OpenCoreStepDefinition): boolean {
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

export function evaluateEditionFeatureBreakdown(editionContext?: EditionContextInput): {
  activeEdition: SophiaEdition;
  communityFeatureCount: number;
  cloudSaasFeatureCount: number;
  enterpriseMasterFeatureCount: number;
  unlockedFeatureCount: number;
} {
  const featureIds = Object.keys(OPEN_CORE_FEATURES) as SophiaModuleFeatureId[];
  const gateEvaluations = featureIds.map((id) => evaluateFeatureGate(id, editionContext));
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

  return {
    activeEdition,
    communityFeatureCount,
    cloudSaasFeatureCount,
    enterpriseMasterFeatureCount,
    unlockedFeatureCount,
  };
}

export function buildPhaseCatalogSummaries(): PhaseCatalogSummary[] {
  return OPEN_CORE_PHASES.map((phase) => {
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
}

export function validateCatalogStructure(): {
  documentedSteps: number;
  catalogStructureValid: boolean;
  catalogCompletenessPercentage: number;
} {
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
  return { documentedSteps, catalogStructureValid, catalogCompletenessPercentage };
}
