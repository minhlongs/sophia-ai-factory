/**
 * Multi-Jurisdiction Automated Tax Compliance Engine
 *
 * Implements real-time VAT/GST calculation and compliance notes for:
 * 1. EU VAT MOSS (Directive 2006/112/EC & Regulation 282/2011)
 * 2. Singapore GST (IRAS OVR Scheme)
 * 3. Vietnam TT78 / Circular 219/2013/TT-BTC
 * 4. US Foreign digital services nexus safe harbor
 *
 * Layer: tree/tax/compliance
 */

import {
  type TaxCalculationInput,
  type TaxCalculationResult,
  EU_MEMBER_STATES_VAT_RATES,
} from './types';
import { validateEuVatId } from './rate-resolver';
import { calculateSingaporeTax, calculateVietnamTax } from './tax-compliance-calculators';

function calculateEuTax(
  country: string,
  subtotal: number,
  custType?: string,
  taxId?: string | null,
): TaxCalculationResult {
  const rate = EU_MEMBER_STATES_VAT_RATES[country] ?? 0.20;

  if (custType === 'B2B' && taxId) {
    const { isValid, error } = validateEuVatId(taxId, country);
    if (isValid) {
      return {
        jurisdiction: 'EU_MOSS',
        applicableRate: 0.0,
        taxAmountCents: 0,
        totalAmountCents: subtotal,
        isReverseCharge: true,
        complianceNote: 'Reverse charge: VAT to be accounted for by the recipient pursuant to Art. 196 of Council Directive 2006/112/EC.',
        taxIdValidated: true,
      };
    }
    const tax = Math.round(subtotal * rate);
    return {
      jurisdiction: 'EU_MOSS',
      applicableRate: rate,
      taxAmountCents: tax,
      totalAmountCents: subtotal + tax,
      isReverseCharge: false,
      complianceNote: `EU VAT MOSS (${(rate * 100).toFixed(1)}% destination rate) charged under Council Directive 2006/112/EC due to unverified VAT ID.`,
      taxIdValidated: false,
      taxIdError: error,
    };
  }

  const tax = Math.round(subtotal * rate);
  return {
    jurisdiction: 'EU_MOSS',
    applicableRate: rate,
    taxAmountCents: tax,
    totalAmountCents: subtotal + tax,
    isReverseCharge: false,
    complianceNote: `EU VAT MOSS (${(rate * 100).toFixed(1)}% destination rate) charged under Council Directive 2006/112/EC.`,
    taxIdValidated: false,
  };
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

  if (normalizedCountry in EU_MEMBER_STATES_VAT_RATES || normalizedCountry === 'GR') {
    return calculateEuTax(normalizedCountry, subtotalCents, customerType, taxId);
  }

  if (normalizedCountry === 'SG') {
    return calculateSingaporeTax(subtotalCents, customerType, taxId);
  }

  if (normalizedCountry === 'VN') {
    return calculateVietnamTax(subtotalCents, serviceType, taxId);
  }

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
