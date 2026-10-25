/**
 * Unit tests for the server-side commercial feature gate
 *
 * @module seed/config/__tests__/require-commercial-feature.test
 */

import { describe, expect, it } from 'vitest';
import { requireCommercialFeature, buildEditionContext } from '../require-commercial-feature';
import type { SophiaModuleFeatureId } from '../open-core-manifest-types';

const CLOUD_FEATURE: SophiaModuleFeatureId = 'affiliate_attribution_payouts';
const COMMUNITY_FEATURE: SophiaModuleFeatureId = 'byok_setup_wizard';
const MASTER_FEATURE: SophiaModuleFeatureId = 'day1_master_handover_suite';

describe('requireCommercialFeature', () => {
  it('allows a COMMUNITY feature with no tier and no license', () => {
    const result = requireCommercialFeature(COMMUNITY_FEATURE, buildEditionContext({}));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.reasonCode).toBe('OPEN_CORE_INCLUDED');
  });

  it('denies a CLOUD_SAAS feature on a community context', () => {
    const result = requireCommercialFeature(CLOUD_FEATURE, buildEditionContext({}));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reasonCode).toBe('REQUIRES_CLOUD_SUBSCRIPTION');
      expect(result.error.messageEn).toContain('Cloud subscription');
      expect(result.error.messageVi.length).toBeGreaterThan(0);
      expect(result.error.upgradeUrl).toContain('pricing');
    }
  });

  it('denies a CLOUD feature to a BASIC tenant when it requires PREMIUM', () => {
    const result = requireCommercialFeature(
      'managed_social_oauth_relay',
      buildEditionContext({ licensedTier: 'BASIC', sophiaEdition: 'cloud' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reasonCode).toBe('REQUIRES_CLOUD_SUBSCRIPTION');
  });

  it('allows a CLOUD feature to a matching paid tier on the official host', () => {
    const result = requireCommercialFeature(
      CLOUD_FEATURE,
      buildEditionContext({
        licensedTier: 'BASIC',
        appUrl: 'https://sophia.agencyos.network',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.reasonCode).toBe('MANAGED_CLOUD_ACTIVE');
  });

  it('allows a MASTER feature only when a valid RaaS license is present', () => {
    const denied = requireCommercialFeature(
      MASTER_FEATURE,
      buildEditionContext({ licensedTier: 'MASTER', hasValidRaasLicense: false }),
    );
    expect(denied.ok).toBe(false);

    const granted = requireCommercialFeature(
      MASTER_FEATURE,
      buildEditionContext({ licensedTier: 'MASTER', hasValidRaasLicense: true }),
    );
    expect(granted.ok).toBe(true);
    if (granted.ok) expect(granted.value.reasonCode).toBe('ENTERPRISE_LICENSE_VERIFIED');
  });

  it('does not grant commercial access from a spoofed subdomain', () => {
    const result = requireCommercialFeature(
      CLOUD_FEATURE,
      buildEditionContext({
        licensedTier: 'ENTERPRISE',
        appUrl: 'https://evil-sophia.agencyos.network.attacker.test',
      }),
    );

    expect(result.ok).toBe(false);
  });
});
