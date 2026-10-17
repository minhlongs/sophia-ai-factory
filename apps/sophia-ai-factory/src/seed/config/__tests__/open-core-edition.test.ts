/**
 * Unit tests for Open-Core Manifest & Edition Resolver
 *
 * @module seed/config/__tests__/open-core-edition.test
 */

import { describe, expect, it } from 'vitest';
import { OPEN_CORE_FEATURES } from '../open-core-manifest';
import {
  evaluateFeatureGate,
  isCommercialFeatureEnabled,
  resolveSophiaEdition,
} from '../edition-config';

describe('Open-Core Manifest & Edition Resolver', () => {
  it('classifies all 12 canonical features across COMMUNITY, CLOUD_SAAS, and ENTERPRISE_MASTER', () => {
    const allFeatures = Object.values(OPEN_CORE_FEATURES);
    expect(allFeatures.length).toBe(12);

    const community = allFeatures.filter((f) => f.scope === 'COMMUNITY');
    const cloud = allFeatures.filter((f) => f.scope === 'CLOUD_SAAS');
    const enterprise = allFeatures.filter((f) => f.scope === 'ENTERPRISE_MASTER');

    expect(community.length).toBe(4);
    expect(cloud.length).toBe(4);
    expect(enterprise.length).toBe(4);
  });

  it('resolves community edition by default on localhost and rejects spoofed query/subdomain URLs', () => {
    expect(
      resolveSophiaEdition({
        sophiaEdition: '',
        appUrl: 'http://localhost:3000?ref=sophia.agencyos.network',
        hasValidRaasLicense: false,
      }),
    ).toBe('community');

    expect(
      resolveSophiaEdition({
        sophiaEdition: '',
        appUrl: 'https://evil-sophia.agencyos.network.attacker.com',
        hasValidRaasLicense: false,
      }),
    ).toBe('community');
  });

  it('resolves cloud edition automatically on official sophia.agencyos.network domain', () => {
    expect(
      resolveSophiaEdition({
        sophiaEdition: '',
        appUrl: 'https://sophia.agencyos.network/vi/dashboard',
      }),
    ).toBe('cloud');
  });

  it('resolves enterprise edition when a valid RaaS license is present', () => {
    expect(
      resolveSophiaEdition({
        sophiaEdition: 'community',
        appUrl: 'https://custom.agency.io',
        hasValidRaasLicense: true,
      }),
    ).toBe('enterprise');
  });

  it('allows COMMUNITY features in all editions including self-hosted community mode', () => {
    const gate = evaluateFeatureGate('byok_setup_wizard', {
      sophiaEdition: 'community',
      appUrl: 'http://localhost:3000',
    });
    expect(gate.allowed).toBe(true);
    expect(gate.reasonCode).toBe('OPEN_CORE_INCLUDED');
    expect(isCommercialFeatureEnabled('bilingual_ask_router', { sophiaEdition: 'community' })).toBe(
      true,
    );
  });

  it('gates CLOUD_SAAS and ENTERPRISE_MASTER features in community mode with upgrade CTA', () => {
    const cloudGate = evaluateFeatureGate('growth_triad_bandit_kelly', {
      sophiaEdition: 'community',
      appUrl: 'http://localhost:3000',
    });
    expect(cloudGate.allowed).toBe(false);
    expect(cloudGate.reasonCode).toBe('REQUIRES_CLOUD_SUBSCRIPTION');
    expect(cloudGate.upgradeUrl).toContain('https://sophia.agencyos.network/pricing');

    const enterpriseGate = evaluateFeatureGate('white_label_agency_portal', {
      sophiaEdition: 'community',
      appUrl: 'http://localhost:3000',
    });
    expect(enterpriseGate.allowed).toBe(false);
    expect(enterpriseGate.reasonCode).toBe('REQUIRES_ENTERPRISE_OR_MASTER_LICENSE');
  });

  it('enforces licensedTier rank so a BASIC license cannot unlock MASTER features', () => {
    const basicAttempt = evaluateFeatureGate('day1_master_handover_suite', {
      sophiaEdition: 'enterprise',
      hasValidRaasLicense: true,
      licensedTier: 'BASIC',
    });
    expect(basicAttempt.allowed).toBe(false);

    const masterAttempt = evaluateFeatureGate('day1_master_handover_suite', {
      sophiaEdition: 'enterprise',
      hasValidRaasLicense: true,
      licensedTier: 'MASTER',
    });
    expect(masterAttempt.allowed).toBe(true);
    expect(masterAttempt.reasonCode).toBe('ENTERPRISE_LICENSE_VERIFIED');
  });
});
