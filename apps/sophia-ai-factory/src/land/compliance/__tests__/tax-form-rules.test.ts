import { describe, it, expect } from 'vitest';
import {
  resolveTaxFormRequirement,
  isTaxFormResolved,
  taxFormInputSchema,
  type TaxFormInput,
} from '../tax-form-rules';

describe('resolveTaxFormRequirement', () => {
  describe('US boundary', () => {
    it('maps a US partner to W-9', () => {
      const result = resolveTaxFormRequirement({ country: 'US' });
      expect(result.formType).toBe('W9');
      if (result.formType !== 'W9') throw new Error('unreachable');
      expect(result.country).toBe('US');
      expect(result.requiresTaxIdentifier).toBe(true);
      expect(result.reason.en).toContain('W-9');
    });

    it('normalises lowercase and padded US input to the same requirement', () => {
      const padded = resolveTaxFormRequirement({ country: '  us  ' });
      expect(padded.formType).toBe('W9');
      if (padded.formType !== 'W9') throw new Error('unreachable');
      expect(padded.country).toBe('US');
    });
  });

  describe('W-8BEN boundary', () => {
    it('maps a non-US, non-VN country to W-8BEN', () => {
      const result = resolveTaxFormRequirement({ country: 'DE' });
      expect(result.formType).toBe('W8BEN');
      if (result.formType !== 'W8BEN') throw new Error('unreachable');
      expect(result.country).toBe('DE');
      expect(result.requiresTaxIdentifier).toBe(true);
      expect(result.reason.en).toContain('W-8BEN');
    });

    it('maps every two-letter non-US, non-VN code to W-8BEN', () => {
      for (const country of ['BR', 'JP', 'GB', 'ZA', 'AU']) {
        expect(resolveTaxFormRequirement({ country }).formType).toBe('W8BEN');
      }
    });
  });

  describe('Vietnam mapping', () => {
    it('maps Vietnam to local self-declaration, not an IRS form', () => {
      const result = resolveTaxFormRequirement({ country: 'VN' });
      expect(result.formType).toBe('VN_SELF_DECLARATION');
      if (result.formType !== 'VN_SELF_DECLARATION') throw new Error('unreachable');
      expect(result.country).toBe('VN');
      expect(result.requiresTaxIdentifier).toBe(true);
      expect(result.reason.en).toContain('W-9');
    });

    it('never returns W-9 or W-8BEN for Vietnam', () => {
      const result = resolveTaxFormRequirement({ country: 'vn' });
      expect(['W9', 'W8BEN']).not.toContain(result.formType);
    });
  });

  describe('unknown country handling', () => {
    it('returns an unknown result for an empty country', () => {
      const result = resolveTaxFormRequirement({ country: '' });
      expect(result.formType).toBe('UNKNOWN');
      if (result.formType !== 'UNKNOWN') throw new Error('unreachable');
      expect(result.country).toBe('');
      expect(result.countryProvided).toBe(false);
      expect(result.requiresTaxIdentifier).toBe(false);
    });

    it('returns an unknown result when the field is missing entirely', () => {
      const result = resolveTaxFormRequirement({});
      expect(result.formType).toBe('UNKNOWN');
      if (result.formType !== 'UNKNOWN') throw new Error('unreachable');
      expect(result.countryProvided).toBe(false);
    });

    it('returns an unknown result for a malformed code rather than defaulting to W-9', () => {
      const result = resolveTaxFormRequirement({ country: 'USA' });
      expect(result.formType).toBe('UNKNOWN');
      if (result.formType !== 'UNKNOWN') throw new Error('unreachable');
      expect(result.countryProvided).toBe(true);
      expect(result.requiresTaxIdentifier).toBe(false);
    });

    it('never silently falls back to W-9 for any unknown input', () => {
      const unknownInputs: TaxFormInput[] = [
        { country: '' },
        {},
        { country: 'XX' },
        { country: '12' },
        { country: 'usa' },
      ];
      for (const input of unknownInputs) {
        const result = resolveTaxFormRequirement(input);
        if (result.formType === 'UNKNOWN') {
          expect(result.formType).not.toBe('W9');
          expect(result.formType).not.toBe('W8BEN');
        }
      }
    });
  });

  describe('reason coverage', () => {
    it('provides a bilingual reason for every resolved mapping', () => {
      for (const country of ['US', 'VN', 'FR']) {
        const result = resolveTaxFormRequirement({ country });
        expect(result.reason.vi.length).toBeGreaterThan(0);
        expect(result.reason.en.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isTaxFormResolved', () => {
    it('is true for settled mappings and false for unknown ones', () => {
      expect(isTaxFormResolved(resolveTaxFormRequirement({ country: 'US' }))).toBe(true);
      expect(isTaxFormResolved(resolveTaxFormRequirement({ country: 'VN' }))).toBe(true);
      expect(isTaxFormResolved(resolveTaxFormRequirement({ country: 'BR' }))).toBe(true);
      expect(isTaxFormResolved(resolveTaxFormRequirement({ country: '' }))).toBe(false);
      expect(isTaxFormResolved(resolveTaxFormRequirement({ country: 'USA' }))).toBe(false);
    });
  });

  describe('purity', () => {
    it('does not mutate the input object', () => {
      const input = { country: ' us ' };
      const snapshot = { ...input };
      resolveTaxFormRequirement(input);
      expect(input).toEqual(snapshot);
    });

    it('accepts only a string country through the schema', () => {
      expect(taxFormInputSchema.safeParse({ country: 42 }).success).toBe(false);
      expect(taxFormInputSchema.safeParse({ country: 'US' }).success).toBe(true);
    });
  });
});
