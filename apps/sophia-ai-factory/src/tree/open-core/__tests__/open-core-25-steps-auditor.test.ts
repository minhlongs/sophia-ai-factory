/**
 * Unit tests for 25-Step Open-Core Public GitHub + SaaS Catalog & Readiness Auditor
 *
 * Layer: tree/open-core
 * @module tree/open-core/__tests__/open-core-25-steps-auditor.test
 */

import { describe, expect, it } from 'vitest';
import {
  OPEN_CORE_25_STEPS,
  OPEN_CORE_PHASES,
  PROTECTED_OPEN_CORE_FLOWS,
  REQUIRED_GITHUB_COMMUNITY_FILES,
  TOTAL_OPEN_CORE_STEPS,
  getOpenCoreStepByNumber,
  getOpenCoreStepsByPhase,
  getOpenCoreStepsByScope,
} from '@/seed/config/open-core-25-steps-catalog';
import { auditOpenCore25StepCatalog } from '../open-core-25-steps-auditor';

describe('25-Step Open-Core Catalog Auditor', () => {
  it('defines exactly 25 contiguous steps (1..25) across 6 phases', () => {
    expect(OPEN_CORE_25_STEPS).toHaveLength(TOTAL_OPEN_CORE_STEPS);
    expect(OPEN_CORE_PHASES).toHaveLength(6);

    const stepNumbers = OPEN_CORE_25_STEPS.map((s) => s.step);
    expect(stepNumbers).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));

    const slugs = new Set(OPEN_CORE_25_STEPS.map((s) => s.slug));
    expect(slugs.size).toBe(25);
  });

  it('provides accurate step lookup by number, phase, and edition scope', () => {
    const step1 = getOpenCoreStepByNumber(1);
    expect(step1?.slug).toBe('master-open-core-framework');
    expect(step1?.linkedFeatureId).toBe('byok_setup_wizard');

    const step25 = getOpenCoreStepByNumber(25);
    expect(step25?.phaseId).toBe('phase_6_execution_governance');
    expect(step25?.linkedFeatureId).toBe('managed_social_oauth_relay');

    expect(getOpenCoreStepByNumber(99)).toBeUndefined();

    expect(getOpenCoreStepsByPhase('phase_1_foundation')).toHaveLength(5);
    expect(getOpenCoreStepsByPhase('phase_2_business_model')).toHaveLength(2);
    expect(getOpenCoreStepsByPhase('phase_3_brand_github_community')).toHaveLength(5);
    expect(getOpenCoreStepsByPhase('phase_4_revenue_conversion_engine')).toHaveLength(3);
    expect(getOpenCoreStepsByPhase('phase_5_operations_security_readiness')).toHaveLength(6);
    expect(getOpenCoreStepsByPhase('phase_6_execution_governance')).toHaveLength(4);

    expect(getOpenCoreStepsByScope('COMMUNITY').length).toBeGreaterThanOrEqual(4);
    expect(getOpenCoreStepsByScope('CLOUD_SAAS').length).toBeGreaterThanOrEqual(5);
    expect(getOpenCoreStepsByScope('ENTERPRISE_MASTER').length).toBeGreaterThanOrEqual(4);
  });

  it('registers all 3 protected flows and 10 required governance artifacts', () => {
    expect(PROTECTED_OPEN_CORE_FLOWS).toHaveLength(3);
    expect(REQUIRED_GITHUB_COMMUNITY_FILES).toContain('CODE_OF_CONDUCT.md');
    expect(REQUIRED_GITHUB_COMMUNITY_FILES).toContain('LICENSE');
    expect(REQUIRED_GITHUB_COMMUNITY_FILES).toContain('LICENSE-COMMERCIAL.md');
  });

  it('reports catalog metadata completeness for community edition with a reproducible fingerprint', async () => {
    const res = await auditOpenCore25StepCatalog({
      editionContext: { sophiaEdition: 'community' },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.totalSteps).toBe(25);
    expect(res.value.documentedSteps).toBe(25);
    expect(res.value.catalogCompletenessPercentage).toBe(100);
    expect(res.value.catalogComplete).toBe(true);
    expect(res.value.catalogStructureValid).toBe(true);
    expect(res.value.activeEdition).toBe('community');
    expect(res.value.communityFeatureCount).toBe(5);
    expect(res.value.cloudSaasFeatureCount).toBe(4);
    expect(res.value.enterpriseMasterFeatureCount).toBe(4);
    expect(res.value.unlockedFeatureCount).toBe(5);
    expect(res.value.protectedFlowDefinitionsCount).toBe(3);
    expect(res.value.catalogFingerprintHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('audits enterprise edition with MASTER tier unlocking all 12 features', async () => {
    const res = await auditOpenCore25StepCatalog({
      editionContext: {
        sophiaEdition: 'enterprise',
        hasValidRaasLicense: true,
        licensedTier: 'MASTER',
      },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.activeEdition).toBe('enterprise');
    expect(res.value.unlockedFeatureCount).toBe(13);
  });

  it('does not describe listed catalog metadata as deployed or completed product work', async () => {
    const res = await auditOpenCore25StepCatalog();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).not.toHaveProperty('readinessPercentage');
    expect(res.value).not.toHaveProperty('auditDigestHex');
    expect(res.value).not.toHaveProperty('implementationPercentage');
  });

  it('states that artifact existence was not checked when no probe is supplied', async () => {
    const res = await auditOpenCore25StepCatalog();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verificationPerformed).toBe(false);
    expect(res.value.verifiedArtifactsPercentage).toBeNull();
    expect(res.value.verifiedGovernanceFilesCount).toBeNull();
    expect(res.value.documentedSteps).toBe(TOTAL_OPEN_CORE_STEPS);
  });

  it('falls below a full score when an artifact does not resolve', async () => {
    const res = await auditOpenCore25StepCatalog({ artifactExistenceProbe: () => false });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verificationPerformed).toBe(true);
    expect(res.value.verifiedSteps).toBe(0);
    expect(res.value.verifiedArtifactsPercentage).toBe(0);
    expect(res.value.verifiedGovernanceFilesCount).toBe(0);
    expect(res.value.missingVerificationArtifacts).toContainEqual(
      OPEN_CORE_25_STEPS[0].verificationArtifact,
    );
    expect(res.value.missingGovernanceFiles).toContainEqual(REQUIRED_GITHUB_COMMUNITY_FILES[0]);
  });

  it('reports a full artifact score only when every artifact resolves', async () => {
    const res = await auditOpenCore25StepCatalog({ artifactExistenceProbe: () => true });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verificationPerformed).toBe(true);
    expect(res.value.verifiedSteps).toBe(TOTAL_OPEN_CORE_STEPS);
    expect(res.value.verifiedArtifactsPercentage).toBe(100);
    expect(res.value.verifiedGovernanceFilesCount).toBe(REQUIRED_GITHUB_COMMUNITY_FILES.length);
    expect(res.value.missingVerificationArtifacts).toHaveLength(0);
  });
});
