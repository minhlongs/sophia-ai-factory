/**
 * Multi-Jurisdiction Tax Compliance Types & Validation Patterns
 *
 * Layer: tree/tax/compliance
 */

export type {
  TaxJurisdiction,
  CustomerType,
  CustomerType as CustomerTaxType,
  ServiceType,
  TaxCalculationInput,
  TaxCalculationResult,
} from '@/seed/types/tax-compliance';

export {
  EU_MEMBER_STATES_VAT_RATES,
  SINGAPORE_GST_RATE,
  VIETNAM_STANDARD_VAT_RATE,
  VIETNAM_SOFTWARE_VAT_RATE,
} from '@/seed/types/tax-compliance';

// European VIES Tax ID Pattern per country
export const VIES_COUNTRY_PATTERNS: Readonly<Record<string, RegExp>> = {
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
export const SG_UEN_REGEX = /^(?:[0-9]{8,9}[A-Z]|[TSR][0-9]{2}[A-Z0-9]{2}[0-9]{4}[A-Z])$/i;

// Vietnam Tax ID (Mã Số Thuế) Regex Pattern
export const VN_MST_REGEX = /^(?:[0-9]{10}|[0-9]{10}-[0-9]{3}|[0-9]{13})$/;
