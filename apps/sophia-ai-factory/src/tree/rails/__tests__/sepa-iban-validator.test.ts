import { describe, expect, it } from 'vitest';
import { maskIban, validateBic, validateIban } from '../sepa-iban-validator';

describe('SEPA IBAN and BIC validator helpers', () => {
  it('normalizes a valid IBAN with spaces and separators before checking MOD-97', () => {
    expect(validateIban('de89 3704-0044 0532 0130 00')).toEqual({
      isValid: true,
      normalizedIban: 'DE89370400440532013000',
    });
  });

  it('rejects IBANs outside global length bounds and unknown countries', () => {
    expect(validateIban('DE89')).toEqual({
      isValid: false, error: 'IBAN length must be between 14 and 34 characters',
    });
    expect(validateIban(`GB${'1'.repeat(33)}`)).toEqual({
      isValid: false, error: 'IBAN length must be between 14 and 34 characters',
    });
    expect(validateIban('ZZ89370400440532013000').error).toBe('Unrecognized IBAN country code: ZZ');
  });

  it('rejects a known country with the wrong exact length before checksum work', () => {
    expect(validateIban('DE8937040044053201300')).toEqual({
      isValid: false,
      error: 'IBAN for DE must be exactly 22 characters (received 21)',
    });
  });

  it('rejects invalid characters and failed MOD-97 checksums', () => {
    expect(validateIban('DE89370400440532013!00')).toEqual({
      isValid: false, error: 'Invalid character in IBAN: !',
    });
    expect(validateIban('DE88370400440532013000')).toEqual({
      isValid: false, error: 'IBAN failed MOD-97 checksum verification',
    });
  });

  it('accepts 8 and 11 character BICs after trimming and case normalization', () => {
    expect(validateBic(' deutdedd ')).toEqual({ isValid: true, normalizedBic: 'DEUTDEDD' });
    expect(validateBic('BNPA FRPP XXX')).toEqual({ isValid: true, normalizedBic: 'BNPAFRPPXXX' });
  });

  it('rejects malformed BICs and masks only the middle of an IBAN', () => {
    expect(validateBic('DEUTDE1')).toEqual({
      isValid: false, error: 'BIC must be 8 or 11 alphanumeric characters (ISO 9362)',
    });
    expect(maskIban('abc12345')).toBe('ABC12345');
    expect(maskIban('de89 3704 0044 0532 0130 00')).toBe('DE89 **** **** **** **30 00');
  });
});
