/**
 * Jurisdiction Compliance Guard Vitest Suite
 *
 * Verifies regulatory compliance checks, hard geo-fencing (VN, SG bans for crypto),
 * and jurisdiction-specific disclaimer requirements (US FTC/CFTC, EU MiCA).
 *
 * @module tree/video/compliance/__tests__/jurisdiction-compliance-guard.test
 */

import { describe, it, expect } from 'vitest';
import { evaluateJurisdictionCompliance } from '@/tree/video/compliance/jurisdiction-compliance-guard';

describe('Jurisdiction Compliance Guard', () => {
  describe('SaaS Global Niche', () => {
    it('permits SaaS campaigns globally with universal FTC ad disclosure', () => {
      const usResult = evaluateJurisdictionCompliance('saas_global', 'US');
      expect(usResult.isAllowed).toBe(true);
      expect(usResult.jurisdiction).toBe('US');
      expect(usResult.requiredDisclaimers.requiresFtcDisclosure).toBe(true);
      expect(usResult.requiredDisclaimers.paidPartnershipTag).toBe(true);
      expect(usResult.requiredDisclaimers.requiresCftcDisclaimer).toBe(false);
      expect(usResult.requiredDisclaimers.requiresPersistentBanner).toBe(false);
      expect(usResult.requiredDisclaimers.requiresEndCard15s).toBe(false);

      const vnResult = evaluateJurisdictionCompliance('saas_global', 'VN');
      expect(vnResult.isAllowed).toBe(true);
      expect(vnResult.jurisdiction).toBe('VN');
    });
  });

  describe('Crypto Global Niche — Hard Geo-Fencing Gates', () => {
    it('strictly blocks crypto promotional campaigns targeting Vietnam (Nghị định 52/2024/NĐ-CP)', () => {
      const vnResult = evaluateJurisdictionCompliance('crypto_global', 'VN');
      expect(vnResult.isAllowed).toBe(false);
      expect(vnResult.jurisdiction).toBe('VN');
      expect(vnResult.reason).toBe('VIETNAM_PROMOTIONAL_BAN');
      expect(vnResult.regulatoryRef).toContain('52/2024');
    });

    it('strictly blocks crypto promotional campaigns targeting Singapore (MAS PSN08)', () => {
      const sgResult = evaluateJurisdictionCompliance('crypto_global', 'SG');
      expect(sgResult.isAllowed).toBe(false);
      expect(sgResult.jurisdiction).toBe('SG');
      expect(sgResult.reason).toBe('SINGAPORE_MAS_PSN08_RETAIL_BAN');
      expect(sgResult.regulatoryRef).toContain('MAS Notice PSN08');
    });
  });

  describe('Crypto Global Niche — Permitted Strict Jurisdictions', () => {
    it('allows United States with strict FTC 255 and CFTC 4.41 mandatory end-card & banner', () => {
      const usResult = evaluateJurisdictionCompliance('crypto_global', 'US');
      expect(usResult.isAllowed).toBe(true);
      expect(usResult.jurisdiction).toBe('US');
      expect(usResult.regulatoryRef).toContain('FTC');
      expect(usResult.regulatoryRef).toContain('CFTC');
      expect(usResult.requiredDisclaimers.requiresCftcDisclaimer).toBe(true);
      expect(usResult.requiredDisclaimers.requiresPersistentBanner).toBe(true);
      expect(usResult.requiredDisclaimers.requiresEndCard15s).toBe(true);
      expect(usResult.requiredDisclaimers.requiresMicaNotice).toBe(false);
    });

    it('allows European Union with mandatory MiCA Art. 7/53 disclosures and end-card', () => {
      const euResult = evaluateJurisdictionCompliance('crypto_global', 'EU');
      expect(euResult.isAllowed).toBe(true);
      expect(euResult.jurisdiction).toBe('EU');
      expect(euResult.regulatoryRef).toContain('MiCA');
      expect(euResult.requiredDisclaimers.requiresMicaNotice).toBe(true);
      expect(euResult.requiredDisclaimers.requiresPersistentBanner).toBe(true);
      expect(euResult.requiredDisclaimers.requiresEndCard15s).toBe(true);
      expect(euResult.requiredDisclaimers.requiresCftcDisclaimer).toBe(false);
    });

    it('falls back to default comprehensive protections for unspecified global crypto traffic', () => {
      const globalResult = evaluateJurisdictionCompliance('crypto_global', 'GLOBAL');
      expect(globalResult.isAllowed).toBe(true);
      expect(globalResult.jurisdiction).toBe('GLOBAL');
      expect(globalResult.requiredDisclaimers.requiresPersistentBanner).toBe(true);
      expect(globalResult.requiredDisclaimers.requiresEndCard15s).toBe(true);
    });
  });
});
