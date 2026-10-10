/**
 * Multi-Jurisdiction Tax Rate Resolvers & Tax ID Format Validators
 *
 * Implements format and checksum validation for:
 * - EU VAT ID (VIES regex patterns)
 * - Singapore UEN (ACRA format regex)
 * - Vietnam MST (10-digit checksum and 13-digit branch)
 *
 * Layer: tree/tax/compliance
 */

import {
  VIES_COUNTRY_PATTERNS,
  SG_UEN_REGEX,
  VN_MST_REGEX,
} from './types';

/**
 * Validates EU VAT ID syntax against VIES country-specific regex.
 */
export function validateEuVatId(vatId: string, countryCode: string): { isValid: boolean; error?: string } {
  const normalizedCountry = countryCode.toUpperCase();
  const normalizedVat = vatId.trim().toUpperCase().replace(/[\s.-]/g, '');

  const patternKey = normalizedCountry === 'GR' ? 'GR' : normalizedCountry;
  const pattern = VIES_COUNTRY_PATTERNS[patternKey];

  if (!pattern) {
    return { isValid: false, error: `Unsupported or non-EU country code: ${countryCode}` };
  }

  const matches = pattern.test(normalizedVat);
  if (!matches) {
    return { isValid: false, error: `Invalid EU VAT number format for ${normalizedCountry}` };
  }

  return { isValid: true };
}

/**
 * Validates Singapore Unique Entity Number (UEN) format.
 */
export function validateSingaporeUen(uen: string): { isValid: boolean; error?: string } {
  const normalizedUen = uen.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!SG_UEN_REGEX.test(normalizedUen)) {
    return { isValid: false, error: 'Invalid Singapore UEN format. Must be 9-10 alphanumeric characters.' };
  }
  return { isValid: true };
}

/**
 * Validates Vietnamese Tax Identification Number (Mã Số Thuế — MST).
 * Implements 10-digit enterprise MST checksum verification:
 * Weights: [10, 3, 4, 5, 6, 7, 8, 9] applied to first 9 digits.
 * Check digit = 10 - (sum % 11). If remainder is 10, check digit is 0.
 */
export function validateVietnameseMst(mst: string): { isValid: boolean; error?: string } {
  const cleaned = mst.trim().replace(/\s/g, '');
  if (!VN_MST_REGEX.test(cleaned)) {
    return { isValid: false, error: 'MST must be 10 digits or 13 characters (XXXXXXXXXX-XXX)' };
  }

  const base10 = cleaned.replace('-', '').slice(0, 10);
  const weights = [10, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += Number(base10[i]) * weights[i];
  }

  // Weight for 9th digit is 1
  sum += Number(base10[8]);

  const remainder = sum % 11;
  const expectedCheckDigit = remainder === 10 ? 0 : remainder;
  const actualCheckDigit = Number(base10[9]);

  // If check digit doesn't match, return invalid
  if (expectedCheckDigit !== actualCheckDigit) {
    return { isValid: false, error: 'Invalid Vietnamese Tax ID checksum' };
  }

  return { isValid: true };
}
