/**
 * Regional VAT/GST Calculators for Singapore IRAS OVR and Vietnam TT78.
 * @module tree/tax/compliance/tax-compliance-calculators
 */

import {
  type TaxCalculationResult,
  SINGAPORE_GST_RATE,
  VIETNAM_STANDARD_VAT_RATE,
  VIETNAM_SOFTWARE_VAT_RATE,
} from './types';
import {
  validateSingaporeUen,
  validateVietnameseMst,
} from './rate-resolver';

export function calculateSingaporeTax(
  subtotal: number,
  custType?: string,
  taxId?: string | null,
): TaxCalculationResult {
  if (custType === 'B2B' && taxId) {
    const { isValid, error } = validateSingaporeUen(taxId);
    if (isValid) {
      return {
        jurisdiction: 'SG_GST',
        applicableRate: 0.0,
        taxAmountCents: 0,
        totalAmountCents: subtotal,
        isReverseCharge: true,
        complianceNote:
          'Singapore GST reverse charge: Customer accounts for imported services under IRAS Overseas Vendor Registration (OVR) framework.',
        taxIdValidated: true,
      };
    }
    const tax = Math.round(subtotal * SINGAPORE_GST_RATE);
    return {
      jurisdiction: 'SG_GST',
      applicableRate: SINGAPORE_GST_RATE,
      taxAmountCents: tax,
      totalAmountCents: subtotal + tax,
      isReverseCharge: false,
      complianceNote:
        'Singapore GST 9.0% charged under IRAS OVR digital services regime due to unverified UEN.',
      taxIdValidated: false,
      taxIdError: error,
    };
  }

  const tax = Math.round(subtotal * SINGAPORE_GST_RATE);
  return {
    jurisdiction: 'SG_GST',
    applicableRate: SINGAPORE_GST_RATE,
    taxAmountCents: tax,
    totalAmountCents: subtotal + tax,
    isReverseCharge: false,
    complianceNote:
      'Singapore GST 9.0% charged under IRAS Overseas Vendor Registration (OVR) digital services regime.',
    taxIdValidated: false,
  };
}

export function calculateVietnamTax(
  subtotal: number,
  serviceType: string,
  taxId?: string | null,
): TaxCalculationResult {
  const validation = taxId ? validateVietnameseMst(taxId) : undefined;
  const taxIdValidated = validation?.isValid ?? false;
  const taxIdError = validation?.error;

  if (serviceType === 'software_saas') {
    return {
      jurisdiction: 'VN_TT78',
      applicableRate: VIETNAM_SOFTWARE_VAT_RATE,
      taxAmountCents: 0,
      totalAmountCents: subtotal,
      isReverseCharge: false,
      complianceNote:
        'Dịch vụ phần mềm không chịu thuế GTGT theo Khoản 21 Điều 4 Thông tư 219/2013/TT-BTC và Thông tư 78/2021/TT-BTC.',
      taxIdValidated,
      taxIdError,
    };
  }

  const tax = Math.round(subtotal * VIETNAM_STANDARD_VAT_RATE);
  return {
    jurisdiction: 'VN_TT78',
    applicableRate: VIETNAM_STANDARD_VAT_RATE,
    taxAmountCents: tax,
    totalAmountCents: subtotal + tax,
    isReverseCharge: false,
    complianceNote: 'Thuế GTGT 10% theo Thông tư 78/2021/TT-BTC và Nghị định 123/2020/NĐ-CP.',
    taxIdValidated,
    taxIdError,
  };
}
