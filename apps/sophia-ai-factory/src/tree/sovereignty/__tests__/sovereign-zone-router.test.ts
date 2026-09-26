/**
 * Unit & Invariance Tests: Sovereign Zone Router & Cross-Border Compliance Policy
 *
 * Verifies:
 * 1. Geo-IP & header-based sovereign zone resolution (VN, EU, APAC_SG, APAC_JP, US, GLOBAL)
 * 2. Regulatory policy parameters (GDPR, PDPD, PDPA, APPI, CCPA)
 * 3. Cross-border transfer gates:
 *    - VN strict prohibition on offshore transfers (Decree 13 / CyberLaw 24)
 *    - EU-Japan mutual adequacy recognition
 *    - Singapore PDPA consent/SCC gates
 *    - US unrestricted cross-border routing
 * 4. Storage region binding (Cloudflare R2 / compute regions)
 */

import { describe, it, expect } from 'vitest';
import {
  resolveSovereignZone,
  extractZoneFromHeaders,
  getZonePolicy,
  validateCrossBorderTransfer,
  getStorageRegionForZone,
  SOVEREIGN_ZONE_CONFIGS,
} from '../sovereign-zone-router';

describe('Sovereign Zone Router', () => {
  describe('Zone Resolution from Country Codes', () => {
    it('resolves Vietnam (VN) to territorial VN residency zone', () => {
      expect(resolveSovereignZone('VN')).toBe('VN');
      expect(resolveSovereignZone('vn')).toBe('VN');
    });

    it('resolves EU member states to EU GDPR zone', () => {
      const euCountries = ['DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'IE', 'PL'];
      for (const country of euCountries) {
        expect(resolveSovereignZone(country)).toBe('EU');
      }
    });

    it('resolves EEA & privacy-aligned European states to EU zone', () => {
      expect(resolveSovereignZone('NO')).toBe('EU');
      expect(resolveSovereignZone('IS')).toBe('EU');
      expect(resolveSovereignZone('CH')).toBe('EU');
      expect(resolveSovereignZone('GB')).toBe('EU');
    });

    it('resolves Japan to APAC_JP sovereign zone', () => {
      expect(resolveSovereignZone('JP')).toBe('APAC_JP');
    });

    it('resolves ASEAN countries to APAC_SG Singapore Hub zone', () => {
      const aseanCountries = ['SG', 'MY', 'ID', 'TH', 'PH'];
      for (const country of aseanCountries) {
        expect(resolveSovereignZone(country)).toBe('APAC_SG');
      }
    });

    it('resolves United States and Canada to US CCPA zone', () => {
      expect(resolveSovereignZone('US')).toBe('US');
      expect(resolveSovereignZone('CA')).toBe('US');
    });

    it('falls back to GLOBAL zone for unspecified or global origins', () => {
      expect(resolveSovereignZone(null)).toBe('GLOBAL');
      expect(resolveSovereignZone(undefined)).toBe('GLOBAL');
      expect(resolveSovereignZone('')).toBe('GLOBAL');
      expect(resolveSovereignZone('BR')).toBe('GLOBAL');
      expect(resolveSovereignZone('ZA')).toBe('GLOBAL');
    });

    it('honors regionCode override when country is generic', () => {
      expect(resolveSovereignZone(null, 'EU')).toBe('EU');
      expect(resolveSovereignZone(null, 'VN')).toBe('VN');
      expect(resolveSovereignZone(null, 'SG')).toBe('APAC_SG');
      expect(resolveSovereignZone(null, 'JP')).toBe('APAC_JP');
      expect(resolveSovereignZone(null, 'US')).toBe('US');
    });
  });

  describe('Edge HTTP Header Extraction', () => {
    it('extracts explicit x-sovereign-zone header when valid', () => {
      const headers = new Headers();
      headers.set('x-sovereign-zone', 'EU');
      headers.set('cf-ipcountry', 'US');
      expect(extractZoneFromHeaders(headers)).toBe('EU');
    });

    it('extracts from cf-ipcountry header', () => {
      const headers = new Headers();
      headers.set('cf-ipcountry', 'VN');
      expect(extractZoneFromHeaders(headers)).toBe('VN');
    });

    it('extracts from x-country-code header if cf-ipcountry is absent', () => {
      const headers = new Headers();
      headers.set('x-country-code', 'JP');
      expect(extractZoneFromHeaders(headers)).toBe('APAC_JP');
    });
  });

  describe('Authoritative Zone Policies & Storage Regions', () => {
    it('configures EU GDPR with mandatory CMEK and weur storage', () => {
      const policy = getZonePolicy('EU');
      expect(policy.regulatoryFramework).toBe('EU_GDPR');
      expect(policy.mandatoryCmek).toBe(true);
      expect(policy.primaryStorageRegion).toBe('weur');
      expect(policy.crossBorderTransferPolicy).toBe('adequacy_only');
    });

    it('configures Vietnam PDPD with mandatory CMEK, 10-year retention, and apac-vn storage', () => {
      const policy = getZonePolicy('VN');
      expect(policy.regulatoryFramework).toBe('VN_PDPD');
      expect(policy.mandatoryCmek).toBe(true);
      expect(policy.primaryStorageRegion).toBe('apac-vn');
      expect(policy.crossBorderTransferPolicy).toBe('strictly_prohibited');
      expect(policy.retentionPeriodDays).toBe(3650);
    });

    it('maps storage regions correctly', () => {
      expect(getStorageRegionForZone('VN')).toEqual({ primary: 'apac-vn', fallback: 'apac-sg' });
      expect(getStorageRegionForZone('EU')).toEqual({ primary: 'weur', fallback: 'eeur' });
      expect(getStorageRegionForZone('APAC_SG')).toEqual({ primary: 'apac-sg', fallback: 'apac-jp' });
      expect(getStorageRegionForZone('US')).toEqual({ primary: 'wnam', fallback: 'enam' });
      expect(getStorageRegionForZone('GLOBAL')).toEqual({ primary: 'auto', fallback: null });
    });
  });

  describe('Cross-Border Data Transfer Validation Gates', () => {
    it('always permits intra-zone data processing', () => {
      const zones: (keyof typeof SOVEREIGN_ZONE_CONFIGS)[] = ['EU', 'VN', 'APAC_SG', 'APAC_JP', 'US', 'GLOBAL'];
      for (const zone of zones) {
        const result = validateCrossBorderTransfer(zone, zone);
        expect(result.allowed).toBe(true);
        expect(result.verdict).toBe('ALLOWED');
      }
    });

    it('strictly prohibits exporting data from Vietnam offshore', () => {
      const destinations: (keyof typeof SOVEREIGN_ZONE_CONFIGS)[] = ['EU', 'APAC_SG', 'APAC_JP', 'US', 'GLOBAL'];
      for (const dest of destinations) {
        const result = validateCrossBorderTransfer('VN', dest, { hasExplicitConsent: true });
        expect(result.allowed).toBe(false);
        expect(result.verdict).toBe('DENIED');
        expect(result.reason).toContain('Decree 13');
      }
    });

    it('permits EU <-> Japan transfers under mutual adequacy recognition', () => {
      const euToJp = validateCrossBorderTransfer('EU', 'APAC_JP');
      expect(euToJp.allowed).toBe(true);
      expect(euToJp.verdict).toBe('ALLOWED');
      expect(euToJp.reason).toContain('mutual adequacy');

      const jpToEu = validateCrossBorderTransfer('APAC_JP', 'EU');
      expect(jpToEu.allowed).toBe(true);
      expect(jpToEu.verdict).toBe('ALLOWED');
      expect(jpToEu.reason).toContain('mutual adequacy');
    });

    it('blocks EU transfer to US without SCC or explicit consent, but permits with SCC', () => {
      const denied = validateCrossBorderTransfer('EU', 'US');
      expect(denied.allowed).toBe(false);
      expect(denied.verdict).toBe('DENIED');

      const allowedWithScc = validateCrossBorderTransfer('EU', 'US', {
        hasStandardContractualClauses: true,
      });
      expect(allowedWithScc.allowed).toBe(true);
      expect(allowedWithScc.verdict).toBe('ALLOWED');
    });

    it('blocks Singapore PDPA transfer without consent/SCC, but permits with consent', () => {
      const denied = validateCrossBorderTransfer('APAC_SG', 'US');
      expect(denied.allowed).toBe(false);
      expect(denied.verdict).toBe('DENIED');

      const allowedWithConsent = validateCrossBorderTransfer('APAC_SG', 'US', {
        hasExplicitConsent: true,
      });
      expect(allowedWithConsent.allowed).toBe(true);
      expect(allowedWithConsent.verdict).toBe('ALLOWED');
    });

    it('permits US and GLOBAL cross-border transfers unconditionally', () => {
      expect(validateCrossBorderTransfer('US', 'EU').allowed).toBe(true);
      expect(validateCrossBorderTransfer('GLOBAL', 'APAC_SG').allowed).toBe(true);
    });
  });
});
