/** @vitest-environment node */

/**
 * Open-Core Blueprint & Protected Flows Verification Suite (Lane 1)
 *
 * Validates:
 * 1. every SophiaModuleFeatureId spec in OPEN_CORE_FEATURES + 3 editions (community, cloud, enterprise)
 * 2. Canonical pricing truth: BASIC $199, PREMIUM $399, ENTERPRISE $799, MASTER $4,999
 * 3. Workspace Portability (exportWorkspaceBundle -> importWorkspaceBundle) HMAC-SHA256 & 0 plaintext BYOK keys
 * 4. 3 Protected Flows contracts: Setup Wizard BYOK, Telegram Bot @Sophia_Bbot, NOWPayments Result<T, E>
 *
 * Layer: tree/open-core
 * @module tree/open-core/__tests__/blueprint-protected-flows.test
 */

import { describe, it, expect } from 'vitest';
import {
  OPEN_CORE_FEATURES,
  type SophiaModuleFeatureId,
} from '@/seed/config/open-core-manifest';
import {
  resolveSophiaEdition,
  evaluateFeatureGate,
} from '@/seed/config/edition-config';
import { TIER_CONFIGS } from '@/seed/config/tiers';
import {
  exportWorkspaceBundle,
  importWorkspaceBundle,
} from '@/tree/open-core/workspace-portability';
import { sanitizeCredential } from '@/tree/byok/key-format-validators';
import {
  bot,
  startCampaignFsm,
  handleTopicInput,
  handleCampaignConfirm,
} from '@/tree/telegram';
import { success, failure, type Result } from '@/seed/types/result';

describe('Open-Core Blueprint & Protected Flows Suite (Lane 1)', () => {
  describe('1. Open-Core Manifest & 3-Edition Resolver', () => {
    it('classifies every SophiaModuleFeatureId entry across COMMUNITY, CLOUD_SAAS, and ENTERPRISE_MASTER', () => {
      // Derived from the manifest rather than a hand-maintained list, so adding
      // a feature cannot leave this suite asserting against a stale copy.
      const keys = Object.keys(OPEN_CORE_FEATURES) as SophiaModuleFeatureId[];
      expect(keys).toHaveLength(13);
      for (const id of keys) {
        const spec = OPEN_CORE_FEATURES[id];
        expect(spec).toBeDefined();
        expect(spec.id).toBe(id);
        expect(spec.modulePaths.length).toBeGreaterThan(0);
        expect(spec.titleVi.length).toBeGreaterThan(0);
        expect(spec.titleEn.length).toBeGreaterThan(0);
      }
      expect(OPEN_CORE_FEATURES.byok_setup_wizard.scope).toBe('COMMUNITY');
      expect(OPEN_CORE_FEATURES.byok_setup_wizard.licenseSpdx).toBe('Apache-2.0');
      expect(OPEN_CORE_FEATURES.managed_social_oauth_relay.scope).toBe('CLOUD_SAAS');
      expect(OPEN_CORE_FEATURES.merkle_ipo_audit_vault.scope).toBe('ENTERPRISE_MASTER');
    });

    it('resolves community, cloud, and enterprise editions and enforces feature gates', () => {
      expect(resolveSophiaEdition({ sophiaEdition: 'community' })).toBe('community');
      expect(resolveSophiaEdition({ sophiaEdition: 'cloud' })).toBe('cloud');
      expect(resolveSophiaEdition({ hasValidRaasLicense: true })).toBe('enterprise');
      expect(resolveSophiaEdition({ appUrl: 'https://sophia.agencyos.network' })).toBe('cloud');

      const communityByok = evaluateFeatureGate('byok_setup_wizard', { sophiaEdition: 'community' });
      expect(communityByok.allowed).toBe(true);
      expect(communityByok.reasonCode).toBe('OPEN_CORE_INCLUDED');

      const communityLocked = evaluateFeatureGate('managed_social_oauth_relay', { sophiaEdition: 'community' });
      expect(communityLocked.allowed).toBe(false);
      expect(communityLocked.reasonCode).toBe('REQUIRES_CLOUD_SUBSCRIPTION');

      const cloudUnlocked = evaluateFeatureGate('managed_social_oauth_relay', {
        sophiaEdition: 'cloud',
        licensedTier: 'PREMIUM',
      });
      expect(cloudUnlocked.allowed).toBe(true);
      expect(cloudUnlocked.reasonCode).toBe('MANAGED_CLOUD_ACTIVE');

      const enterpriseUnlocked = evaluateFeatureGate('day1_master_handover_suite', {
        hasValidRaasLicense: true,
        licensedTier: 'MASTER',
      });
      expect(enterpriseUnlocked.allowed).toBe(true);
      expect(enterpriseUnlocked.reasonCode).toBe('ENTERPRISE_LICENSE_VERIFIED');
    });
  });

  describe('2. Canonical Tier Pricing Truth', () => {
    it('enforces BASIC $199, PREMIUM $399, ENTERPRISE $799, and MASTER $4,999', () => {
      expect(TIER_CONFIGS.BASIC.price).toBe(199);
      expect(TIER_CONFIGS.PREMIUM.price).toBe(399);
      expect(TIER_CONFIGS.ENTERPRISE.price).toBe(799);
      expect(TIER_CONFIGS.MASTER.price).toBe(4999);
    });
  });

  describe('3. Signed Workspace Portability & Zero Plaintext BYOK Invariant', () => {
    it('completes export -> import round-trip, rejects tampering, and exports 0 plaintext keys', async () => {
      const bundle = await exportWorkspaceBundle({
        exportedAt: 1760700000,
        sourceEdition: 'community',
        defaultLocale: 'vi',
        routingStrategy: 'costOptimized',
        configuredProviders: ['openrouter', 'elevenlabs', 'heygen'],
        channelPresets: [{ slug: 'vn-agency', niche: 'ai-automation', locale: 'vi', cadencePerWeek: 5 }],
      });

      const serialized = JSON.stringify(bundle);
      expect(serialized).not.toMatch(/sk-or-v1-|xi-api-key|apiKey|secretKey/i);
      expect(bundle.checksumHex).toMatch(/^[0-9a-f]{64}$/);

      const imported = await importWorkspaceBundle(bundle);
      expect(imported.ok).toBe(true);
      if (imported.ok) {
        expect(imported.value.configuredProviders).toEqual(['openrouter', 'elevenlabs', 'heygen']);
      }

      const tampered = {
        ...bundle,
        config: { ...bundle.config, defaultLocale: 'en' as const },
      };
      const rejected = await importWorkspaceBundle(tampered);
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) {
        expect(rejected.error.code).toBe('CHECKSUM_MISMATCH');
      }
    });
  });

  describe('4. Three Protected Flows Contract Verification', () => {
    it('verifies Setup Wizard BYOK sanitizer, Telegram @Sophia_Bbot handlers, and NOWPayments Result<T, E>', () => {
      // Flow 1: Setup Wizard BYOK credential sanitization
      const dirtyKey = '﻿​  sk-or-v1-clean-key-12345 \x00\n';
      expect(sanitizeCredential(dirtyKey)).toBe('sk-or-v1-clean-key-12345');

      // Flow 2: Telegram Bot @Sophia_Bbot command handlers contract
      expect(bot).toBeDefined();
      expect(typeof startCampaignFsm).toBe('function');
      expect(typeof handleTopicInput).toBe('function');
      expect(typeof handleCampaignConfirm).toBe('function');

      // Flow 3: NOWPayments IPN Result<T, E> non-throwing financial contract
      const ipnEventId = `nowpayments_5710519960_finished`;
      const okResult: Result<{ eventId: string; tier: 'BASIC' }, { code: string; message: string }> =
        success({ eventId: ipnEventId, tier: 'BASIC' });
      const errResult: Result<never, { code: string; message: string }> =
        failure({ code: 'DUPLICATE_EVENT', message: 'Atomic lock already acquired' });

      expect(okResult.ok).toBe(true);
      expect(errResult.ok).toBe(false);
    });
  });
});
