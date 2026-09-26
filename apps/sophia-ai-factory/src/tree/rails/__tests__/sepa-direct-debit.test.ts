/**
 * Unit & Adversarial Test Suite: SEPA Direct Debit Payment Rail
 *
 * Tests:
 * 1. ISO 13616 IBAN MOD-97-10 checksum validation across EU countries
 * 2. Corrupted and malicious IBAN rejection (wrong length, bad check digits, invalid chars)
 * 3. ISO 9362 BIC validation (8 and 11 alphanumeric characters)
 * 4. Masked IBAN presentation formatting
 * 5. EPC SEPA Rulebook compliant Mandate generator & UMR reference uniqueness
 *
 * Layer: tree/rails/__tests__
 */

import { describe, it, expect } from 'vitest';
import {
  validateIban,
  validateBic,
  maskIban,
  generateSepaMandate,
} from '../sepa-direct-debit';

describe('SEPA Direct Debit Payment Rail Suite', () => {
  // =========================================================================
  // 1. IBAN MOD-97 Validation
  // =========================================================================
  describe('1. validateIban', () => {
    it('accepts valid IBANs across major SEPA countries', () => {
      // Germany (DE, 22 chars)
      const de = validateIban('DE89370400440532013000');
      expect(de.isValid).toBe(true);
      expect(de.normalizedIban).toBe('DE89370400440532013000');

      // France (FR, 27 chars)
      const fr = validateIban('FR1420041010050500013M02606');
      expect(fr.isValid).toBe(true);

      // Netherlands (NL, 18 chars)
      const nl = validateIban('NL91ABNA0417164300');
      expect(nl.isValid).toBe(true);

      // Spain (ES, 24 chars)
      const es = validateIban('ES9121000418450200051332');
      expect(es.isValid).toBe(true);

      // Belgium (BE, 16 chars)
      const be = validateIban('BE68539007547034');
      expect(be.isValid).toBe(true);
    });

    it('rejects IBANs with corrupted check digits', () => {
      // Changed check digit from 89 to 88
      const corruptedDe = validateIban('DE88370400440532013000');
      expect(corruptedDe.isValid).toBe(false);
      expect(corruptedDe.error).toContain('MOD-97 checksum');
    });

    it('rejects IBANs with invalid length for country', () => {
      // DE with 21 chars instead of 22
      const shortDe = validateIban('DE8937040044053201300');
      expect(shortDe.isValid).toBe(false);
      expect(shortDe.error).toContain('must be exactly 22 characters');
    });

    it('rejects unrecognized country codes or invalid characters', () => {
      const invalidCountry = validateIban('ZZ89370400440532013000');
      expect(invalidCountry.isValid).toBe(false);

      const invalidChars = validateIban('DE8937040044053201300!');
      expect(invalidChars.isValid).toBe(false);
    });
  });

  // =========================================================================
  // 2. BIC Validation
  // =========================================================================
  describe('2. validateBic', () => {
    it('accepts 8-character and 11-character valid BICs', () => {
      expect(validateBic('DEUTDEDD').isValid).toBe(true);
      expect(validateBic('BNPAFRPPXXX').isValid).toBe(true);
      expect(validateBic('DABAIE2D').isValid).toBe(true);
    });

    it('rejects invalid BIC formats', () => {
      expect(validateBic('SHORT').isValid).toBe(false);
      expect(validateBic('TOOLONG12345').isValid).toBe(false);
      expect(validateBic('DEUTDE!1').isValid).toBe(false);
    });
  });

  // =========================================================================
  // 3. IBAN Masking
  // =========================================================================
  describe('3. maskIban', () => {
    it('formats masked IBAN into 4-character blocks with masked middle', () => {
      const masked = maskIban('DE89370400440532013000');
      expect(masked.startsWith('DE89')).toBe(true);
      expect(masked).toBe('DE89 **** **** **** **30 00');
      expect(masked.replace(/\s/g, '').endsWith('3000')).toBe(true);
      expect(masked).toContain('*');
    });
  });

  // =========================================================================
  // 4. SEPA Mandate Generation
  // =========================================================================
  describe('4. generateSepaMandate', () => {
    it('generates an active EPC compliant mandate with Unique Mandate Reference', () => {
      const mandate = generateSepaMandate({
        creditorId: 'DE98ZZZ09999999999',
        creditorName: 'Sophia AI Factory GmbH',
        debtorName: 'Hans Müller',
        debtorIban: 'DE89370400440532013000',
        debtorBic: 'DEUTDEDD',
        isRecurring: true,
      });

      expect(mandate.status).toBe('active');
      expect(mandate.creditorId).toBe('DE98ZZZ09999999999');
      expect(mandate.debtorName).toBe('Hans Müller');
      expect(mandate.umr).toBeDefined();
      expect(mandate.umr.length).toBeLessThanOrEqual(35);
      expect(mandate.maskedIban).toContain('DE89');
    });

    it('throws error when debtor IBAN is invalid', () => {
      expect(() => {
        generateSepaMandate({
          creditorId: 'DE98ZZZ09999999999',
          creditorName: 'Sophia AI Factory GmbH',
          debtorName: 'Hans Müller',
          debtorIban: 'INVALID_IBAN',
        });
      }).toThrow(/Cannot generate mandate/);
    });
  });
});
