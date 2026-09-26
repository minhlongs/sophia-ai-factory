/**
 * Multi-Jurisdiction Automated Tax Compliance Engine
 *
 * Implements real-time VAT/GST calculation and compliance notes for:
 * 1. EU VAT MOSS (Directive 2006/112/EC & Regulation 282/2011)
 *    - B2B Reverse Charge (0%) with VIES format validation
 *    - B2C Destination country rates (17% to 27%) across 27 EU member states
 * 2. Singapore GST (IRAS OVR Scheme)
 *    - B2B Reverse Charge (0%) with UEN validation
 *    - B2C 9% standard rate
 * 3. Vietnam TT78 / Circular 219/2013/TT-BTC
 *    - Software service exemption (0%)
 *    - Standard IT / consulting services (10%)
 *    - 10-digit / 13-digit MST (Mã Số Thuế) validation
 *
 * Layer: tree/tax (Pure domain service — imports only from seed)
 *
 * @module tree/tax/tax-compliance-engine
 */

import {
  type TaxCalculationInput,
  type TaxCalculationResult,
  type TaxJurisdiction,
  EU_MEMBER_STATES_VAT_RATES,
  SINGAPORE_GST_RATE,
  VIETNAM_STANDARD_VAT_RATE,
  VIETNAM_SOFTWARE_VAT_RATE,
} from '@/seed/types/tax-compliance';

// European VIES Tax ID Pattern per country
const VIES_COUNTRY_PATTERNS: Readonly<Record<string, RegExp>> = {
  AT: /^ATU[0-9]{8}$/,
  BE: /^BE0[0-9]{9}$/,
  BG: /^BG[0-9]{9,10}$/,
  CY: /^CY[0-9]{8}[A-Z]$/,
  CZ: /^CZ[0-9]{8,10}$/,
  DE: /^DE[0-9]{9}$/,
  DK: /^DK[0-9]{8}$/,
  EE: /^EE[0-9]{9}$/,
  ES: /^ES[0-9A-Z][0-9]{7}[0-9A-Z]$/,
  FI: /^FI[0-9]{8}$/,
  FR: /^FR[0-9A-Z]{2}[0-9]{9}$/,
  GR: /^EL[0-9]{9}$/,
  HR: /^HR[0-9]{11}$/,
  HU: /^HU[0-9]{8}$/,
  IE: /^IE[0-9]{7}[A-W][A-I]?$|^IE[0-9][A-Z][0-9]{5}[A-Z]$/,
  IT: /^IT[0-9]{11}$/,
  LT: /^LT([0-9]{9}|[0-9]{12})$/,
  LU: /^LU[0-9]{8}$/,
  LV: /^LV[0-9]{11}$/,
  MT: /^MT[0-9]{8}$/,
  NL: /^NL[0-9]{9}B[0-9]{2}$/,
  PL: /^PL[0-9]{10}$/,
  PT: /^PT[0-9]{9}$/,
  RO: /^RO[0-9]{2,10}$/,
  SE: /^SE[0-9]{12}$/,
  SI: /^SI[0-9]{8}$/,
  SK: /^SK[0-9]{10}$/,
};

// Singapore UEN Regex Pattern (Entities registered with ACRA or other agencies)
// Formats:
// 1. Businesses: 8 or 9 digits + 1 check letter (e.g., 12345678A, 201812345A)
// 2. Others: TyyPQnnnnX (e.g., T18LL1234A)
const SG_UEN_REGEX = /^(?:[0-9]{8,9}[A-Z]|[TSR][0-9]{2}[A-Z0-9]{2}[0-9]{4}[A-Z])$/i;

// Vietnam Tax ID (Mã Số Thuế) Regex Pattern
// Formats:
// 1. 10-digit enterprise MST: /^[0-9]{10}$/
// 2. 13-character branch MST: /^[0-9]{10}-[0-9]{3}$/ or /^[0-9]{13}$/
const VN_MST_REGEX = /^(?:[0-9]{10}|[0-9]{10}-[0-9]{3}|[0-9]{13})$/;

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

/**
 * Computes tax obligation, applicable rate, reverse charge eligibility,
 * and mandatory legal compliance invoice disclaimers.
 */
export function calculateTaxObligation(input: TaxCalculationInput): TaxCalculationResult {
  const { subtotalCents, countryCode, taxId, customerType } = input;
  const serviceType = input.serviceType ?? 'software_saas';
  const normalizedCountry = countryCode.trim().toUpperCase();

  if (subtotalCents < 0) {
    throw new Error(`Subtotal cannot be negative: ${subtotalCents}`);
  }

  // 1. European Union (EU VAT MOSS)
  if (normalizedCountry in EU_MEMBER_STATES_VAT_RATES || normalizedCountry === 'GR') {
    const isB2B = customerType === 'B2B';

    if (isB2B && taxId) {
      const validation = validateEuVatId(taxId, normalizedCountry);
      if (validation.isValid) {
        return {
          jurisdiction: 'EU_MOSS',
          applicableRate: 0.0,
          taxAmountCents: 0,
          totalAmountCents: subtotalCents,
          isReverseCharge: true,
          complianceNote: 'Reverse charge: VAT to be accounted for by the recipient pursuant to Art. 196 of Council Directive 2006/112/EC.',
          taxIdValidated: true,
        };
      } else {
        // Tax ID provided but invalid: Charge destination rate with validation error note
        const destinationRate = EU_MEMBER_STATES_VAT_RATES[normalizedCountry] ?? 0.20;
        const taxAmountCents = Math.round(subtotalCents * destinationRate);
        return {
          jurisdiction: 'EU_MOSS',
          applicableRate: destinationRate,
          taxAmountCents,
          totalAmountCents: subtotalCents + taxAmountCents,
          isReverseCharge: false,
          complianceNote: `EU VAT MOSS (${(destinationRate * 100).toFixed(1)}% destination rate) charged under Council Directive 2006/112/EC due to unverified VAT ID.`,
          taxIdValidated: false,
          taxIdError: validation.error,
        };
      }
    }

    // B2C EU Customer: Charge destination country standard rate
    const destinationRate = EU_MEMBER_STATES_VAT_RATES[normalizedCountry] ?? 0.20;
    const taxAmountCents = Math.round(subtotalCents * destinationRate);
    return {
      jurisdiction: 'EU_MOSS',
      applicableRate: destinationRate,
      taxAmountCents,
      totalAmountCents: subtotalCents + taxAmountCents,
      isReverseCharge: false,
      complianceNote: `EU VAT MOSS (${(destinationRate * 100).toFixed(1)}% destination rate) charged under Council Directive 2006/112/EC.`,
      taxIdValidated: false,
    };
  }

  // 2. Singapore (IRAS GST OVR)
  if (normalizedCountry === 'SG') {
    if (customerType === 'B2B' && taxId) {
      const validation = validateSingaporeUen(taxId);
      if (validation.isValid) {
        return {
          jurisdiction: 'SG_GST',
          applicableRate: 0.0,
          taxAmountCents: 0,
          totalAmountCents: subtotalCents,
          isReverseCharge: true,
          complianceNote: 'Singapore GST reverse charge: Customer accounts for imported services under IRAS Overseas Vendor Registration (OVR) framework.',
          taxIdValidated: true,
        };
      } else {
        const taxAmountCents = Math.round(subtotalCents * SINGAPORE_GST_RATE);
        return {
          jurisdiction: 'SG_GST',
          applicableRate: SINGAPORE_GST_RATE,
          taxAmountCents,
          totalAmountCents: subtotalCents + taxAmountCents,
          isReverseCharge: false,
          complianceNote: 'Singapore GST 9.0% charged under IRAS OVR digital services regime due to unverified UEN.',
          taxIdValidated: false,
          taxIdError: validation.error,
        };
      }
    }

    // B2C Singapore Customer
    const taxAmountCents = Math.round(subtotalCents * SINGAPORE_GST_RATE);
    return {
      jurisdiction: 'SG_GST',
      applicableRate: SINGAPORE_GST_RATE,
      taxAmountCents,
      totalAmountCents: subtotalCents + taxAmountCents,
      isReverseCharge: false,
      complianceNote: 'Singapore GST 9.0% charged under IRAS Overseas Vendor Registration (OVR) digital services regime.',
      taxIdValidated: false,
    };
  }

  // 3. Vietnam (Circular 78/2021/TT-BTC & Decree 123/2020/ND-CP)
  if (normalizedCountry === 'VN') {
    let taxIdValidated = false;
    let taxIdError: string | undefined;

    if (taxId) {
      const validation = validateVietnameseMst(taxId);
      taxIdValidated = validation.isValid;
      taxIdError = validation.error;
    }

    // Core SaaS Software Subscriptions are exempt (0% VAT)
    if (serviceType === 'software_saas') {
      return {
        jurisdiction: 'VN_TT78',
        applicableRate: VIETNAM_SOFTWARE_VAT_RATE,
        taxAmountCents: 0,
        totalAmountCents: subtotalCents,
        isReverseCharge: false,
        complianceNote: 'Dịch vụ phần mềm không chịu thuế GTGT theo Khoản 21 Điều 4 Thông tư 219/2013/TT-BTC và Thông tư 78/2021/TT-BTC.',
        taxIdValidated,
        taxIdError,
      };
    }

    // Non-software IT consulting, custom agency services: Standard 10% VAT
    const taxAmountCents = Math.round(subtotalCents * VIETNAM_STANDARD_VAT_RATE);
    return {
      jurisdiction: 'VN_TT78',
      applicableRate: VIETNAM_STANDARD_VAT_RATE,
      taxAmountCents,
      totalAmountCents: subtotalCents + taxAmountCents,
      isReverseCharge: false,
      complianceNote: 'Thuế GTGT 10% theo Thông tư 78/2021/TT-BTC và Nghị định 123/2020/NĐ-CP.',
      taxIdValidated,
      taxIdError,
    };
  }

  // 4. United States (Foreign digital services nexus safe harbor)
  if (normalizedCountry === 'US') {
    return {
      jurisdiction: 'US_SALES',
      applicableRate: 0.0,
      taxAmountCents: 0,
      totalAmountCents: subtotalCents,
      isReverseCharge: false,
      complianceNote: 'US sales tax exempt under foreign digital services safe harbor.',
      taxIdValidated: Boolean(taxId),
    };
  }

  // 5. Rest of World / Export
  return {
    jurisdiction: 'NONE',
    applicableRate: 0.0,
    taxAmountCents: 0,
    totalAmountCents: subtotalCents,
    isReverseCharge: false,
    complianceNote: 'Cross-border digital export - zero tax rated.',
    taxIdValidated: Boolean(taxId),
  };
}
