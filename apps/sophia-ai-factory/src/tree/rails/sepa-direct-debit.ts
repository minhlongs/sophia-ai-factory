/**
 * SEPA Direct Debit Payment Rail (Core & B2B Scheme)
 *
 * Implements:
 * 1. ISO 13616 International Bank Account Number (IBAN) MOD-97-10 checksum validation
 * 2. ISO 9362 Business Identifier Code (BIC / SWIFT) validation
 * 3. EPC SEPA Rulebook compliant e-Mandate generator with Unique Mandate Reference (UMR)
 *
 * Layer: tree/rails (Pure domain service — imports only from seed)
 *
 * @module tree/rails/sepa-direct-debit
 */

import { type SepaMandateInput, type SepaMandate } from '@/seed/types/localized-rails';

// Standard IBAN lengths per ISO 13616 country
const IBAN_COUNTRY_LENGTHS: Readonly<Record<string, number>> = {
  AL: 28, AD: 24, AT: 20, AZ: 28, BH: 22, BE: 16, BA: 20, BR: 29, BG: 22, CR: 22,
  HR: 21, CY: 28, CZ: 24, DK: 18, DO: 28, EE: 20, FO: 18, FI: 18, FR: 27, GE: 22,
  DE: 22, GI: 23, GR: 27, GL: 18, GT: 28, HU: 28, IS: 26, IE: 22, IL: 23, IT: 27,
  JO: 30, KZ: 20, XK: 20, KW: 30, LV: 21, LB: 28, LI: 21, LT: 20, LU: 20, MK: 19,
  MT: 31, MR: 27, MU: 30, MD: 24, MC: 27, ME: 22, NL: 18, NO: 15, PK: 24, PS: 29,
  PL: 28, PT: 25, QA: 29, RO: 24, LC: 32, SM: 27, ST: 25, SA: 24, RS: 22, SC: 31,
  SK: 24, SI: 19, ES: 24, SE: 24, CH: 21, TL: 23, TN: 24, TR: 26, AE: 23, GB: 22,
  VG: 24,
};

// BIC / SWIFT Regex: 4 alpha (bank) + 2 alpha (country) + 2 alphanumeric (location) + optional 3 alphanumeric (branch)
const BIC_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/**
 * Validates an IBAN using the ISO 7064 MOD-97-10 algorithm.
 */
export function validateIban(iban: string): { isValid: boolean; error?: string; normalizedIban?: string } {
  const cleaned = iban.toUpperCase().replace(/[\s-]/g, '');

  if (cleaned.length < 14 || cleaned.length > 34) {
    return { isValid: false, error: 'IBAN length must be between 14 and 34 characters' };
  }

  const countryCode = cleaned.slice(0, 2);
  const expectedLength = IBAN_COUNTRY_LENGTHS[countryCode];

  if (!expectedLength) {
    return { isValid: false, error: `Unrecognized IBAN country code: ${countryCode}` };
  }

  if (cleaned.length !== expectedLength) {
    return {
      isValid: false,
      error: `IBAN for ${countryCode} must be exactly ${expectedLength} characters (received ${cleaned.length})`,
    };
  }

  // Rearrange: move first 4 characters to end
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);

  // Convert letters to digits: A = 10, B = 11, ..., Z = 35
  let numericString = '';
  for (let i = 0; i < rearranged.length; i++) {
    const char = rearranged[i];
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numericString += String(code - 55);
    } else if (code >= 48 && code <= 57) {
      numericString += char;
    } else {
      return { isValid: false, error: `Invalid character in IBAN: ${char}` };
    }
  }

  // Modulo 97 on large numeric string via chunking
  let remainder = 0;
  for (let i = 0; i < numericString.length; i += 7) {
    const chunk = String(remainder) + numericString.substring(i, i + 7);
    remainder = Number(chunk) % 97;
  }

  if (remainder !== 1) {
    return { isValid: false, error: 'IBAN failed MOD-97 checksum verification' };
  }

  return { isValid: true, normalizedIban: cleaned };
}

/**
 * Validates ISO 9362 BIC (SWIFT code).
 */
export function validateBic(bic: string): { isValid: boolean; error?: string; normalizedBic?: string } {
  const cleaned = bic.trim().toUpperCase().replace(/\s/g, '');
  if (!BIC_REGEX.test(cleaned)) {
    return { isValid: false, error: 'BIC must be 8 or 11 alphanumeric characters (ISO 9362)' };
  }
  return { isValid: true, normalizedBic: cleaned };
}

/**
 * Masks an IBAN for display (showing first 4 characters and last 4 characters).
 * e.g., DE89 **** **** **** **01 23
 */
export function maskIban(iban: string): string {
  const cleaned = iban.toUpperCase().replace(/\s/g, '');
  if (cleaned.length <= 8) return cleaned;

  const prefix = cleaned.slice(0, 4);
  const suffix = cleaned.slice(-4);
  const maskedMiddle = '*'.repeat(cleaned.length - 8);

  const combined = prefix + maskedMiddle + suffix;
  // Format into 4-character blocks
  return combined.match(/.{1,4}/g)?.join(' ') ?? combined;
}

/**
 * Generates an EPC SEPA Core Direct Debit Mandate.
 */
export function generateSepaMandate(input: SepaMandateInput): SepaMandate {
  const { creditorId, creditorName, debtorName, debtorIban, debtorBic } = input;

  const ibanValidation = validateIban(debtorIban);
  if (!ibanValidation.isValid || !ibanValidation.normalizedIban) {
    throw new Error(`Cannot generate mandate: ${ibanValidation.error}`);
  }

  if (debtorBic) {
    const bicValidation = validateBic(debtorBic);
    if (!bicValidation.isValid) {
      throw new Error(`Cannot generate mandate: ${bicValidation.error}`);
    }
  }

  // Generate Unique Mandate Reference (UMR): Max 35 chars, EPC compliant
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const rawUmr = input.mandateReference ?? `SAF-SEPA-${timestamp}-${randomSuffix}`;
  const umr = rawUmr.replace(/[^A-Za-z0-9\-+?/:().,']/g, '').slice(0, 35);

  const signatureDate = input.signatureDate ?? new Date().toISOString().slice(0, 10);

  return {
    mandateReference: umr,
    umr,
    creditorId,
    creditorName,
    debtorName: debtorName.trim(),
    maskedIban: maskIban(ibanValidation.normalizedIban),
    bic: debtorBic ? debtorBic.trim().toUpperCase() : undefined,
    signatureDate,
    status: 'active',
  };
}
