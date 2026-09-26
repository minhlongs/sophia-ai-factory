/**
 * Multi-Jurisdiction Tax Compliance Types & Interfaces
 *
 * Covers EU VAT MOSS, Singapore GST OVR, Vietnam TT78 software VAT exemption,
 * and US Sales Tax.
 *
 * Layer: seed/types (Foundational — zero dependencies on upper layers)
 *
 * @module seed/types/tax-compliance
 */

export type TaxJurisdiction =
  | 'EU_MOSS'
  | 'SG_GST'
  | 'VN_TT78'
  | 'US_SALES'
  | 'EXEMPT'
  | 'NONE';

export const ALL_TAX_JURISDICTIONS: readonly TaxJurisdiction[] = [
  'EU_MOSS',
  'SG_GST',
  'VN_TT78',
  'US_SALES',
  'EXEMPT',
  'NONE',
] as const;

export type CustomerType = 'B2B' | 'B2C';
export type ServiceType = 'software_saas' | 'consulting' | 'media_service';

export interface TaxCalculationInput {
  subtotalCents: number;
  countryCode: string; // ISO 3166-1 alpha-2 (e.g. 'DE', 'FR', 'SG', 'VN', 'US')
  taxId?: string | null;
  customerType: CustomerType;
  serviceType?: ServiceType; // Default: 'software_saas'
}

export interface TaxCalculationResult {
  jurisdiction: TaxJurisdiction;
  applicableRate: number;       // e.g. 0.19 for 19%
  taxAmountCents: number;
  totalAmountCents: number;
  isReverseCharge: boolean;
  complianceNote: string;       // Mandatory invoice legal disclaimer
  taxIdValidated: boolean;
  taxIdError?: string;
}

/**
 * Standard EU VAT rates for 27 member states under MOSS/OSS rules
 */
export const EU_MEMBER_STATES_VAT_RATES: Readonly<Record<string, number>> = {
  AT: 0.20,
  BE: 0.21,
  BG: 0.20,
  CY: 0.19,
  CZ: 0.21,
  DE: 0.19,
  DK: 0.25,
  EE: 0.22,
  ES: 0.21,
  FI: 0.255,
  FR: 0.20,
  GR: 0.24,
  HR: 0.25,
  HU: 0.27,
  IE: 0.23,
  IT: 0.22,
  LT: 0.21,
  LU: 0.17,
  LV: 0.21,
  MT: 0.18,
  NL: 0.21,
  PL: 0.23,
  PT: 0.23,
  RO: 0.19,
  SE: 0.25,
  SI: 0.22,
  SK: 0.20,
};

export const SINGAPORE_GST_RATE = 0.09; // 9% GST OVR (2024-2026)
export const VIETNAM_STANDARD_VAT_RATE = 0.10; // 10%
export const VIETNAM_SOFTWARE_VAT_RATE = 0.0;  // 0% software exemption per Circular 219/2013 & TT78
